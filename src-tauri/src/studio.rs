use crate::{api, vault, AppState};
use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::{Method, Response};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, time::Duration};
use tauri::{ipc::Channel, State};
use tokio::sync::oneshot;

const MAX_BODY: usize = 32 * 1024 * 1024;
const MAX_RESPONSE: usize = 128 * 1024 * 1024;

fn identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 80
        && value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
}

pub fn allowed(method: &str, path: &str) -> bool {
    if path.len() > 512 || path.contains(['?', '#', '%', '\\']) || path.contains("..") {
        return false;
    }
    let parts: Vec<_> = path.split('/').collect();
    match (method, parts.as_slice()) {
        (
            "GET",
            ["", "auth", "me"] | ["", "channels", "available"] | ["", "image-studio", "catalog"],
        ) => true,
        ("GET", ["", "image-studio", "nova", action]) => {
            ["queue-status", "prompts", "blacklist", "config", "plugins"].contains(action)
        }
        ("GET", ["", "image-studio", "nova", "tasks", id]) => identifier(id),
        ("GET", ["", "image-studio", "nova", "images", id, index]) => {
            identifier(id)
                && !index.is_empty()
                && index.len() <= 6
                && index.bytes().all(|c| c.is_ascii_digit())
        }
        (
            "POST",
            ["", "image-studio", "nova", "tasks"]
            | ["", "image-studio", "nova", "prompt-gallery", "verify"],
        ) => true,
        ("POST", ["", "image-studio", "nova", "proxy", action]) => {
            ["text", "models", "image-edit"].contains(action)
        }
        ("POST", ["", "image-studio", "nova", "tasks", id, "ack"]) => identifier(id),
        _ => false,
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioRequest {
    pub id: String,
    pub user_id: i64,
    pub method: String,
    pub path: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum StudioEvent {
    Headers {
        status: u16,
        headers: HashMap<String, String>,
    },
    Chunk {
        data: String,
    },
    End,
}

fn validate(input: &StudioRequest) -> Result<Vec<u8>, String> {
    if !identifier(&input.id) || input.user_id <= 0 || !allowed(&input.method, &input.path) {
        return Err("无效的工作台请求。".into());
    }
    for (name, value) in &input.headers {
        if !["content-type", "x-nova-base-url", "x-nova-expected-price"].contains(&name.as_str())
            || value.len() > 256
            || value.contains(['\r', '\n'])
        {
            return Err("无效的工作台请求头。".into());
        }
    }
    let encoded = input.body.as_deref().unwrap_or("");
    if encoded.len() > (MAX_BODY + 2) / 3 * 4 {
        return Err("提交内容不能超过 32 MB。".into());
    }
    let body = STANDARD.decode(encoded).map_err(|_| "提交内容编码无效。")?;
    if body.len() > MAX_BODY || (input.method == "GET" && !body.is_empty()) {
        return Err("提交内容过大或请求方式无效。".into());
    }
    Ok(body)
}

async fn send(state: &AppState, input: &StudioRequest, body: Vec<u8>) -> Result<Response, String> {
    let mut guard = state.session.lock().await;
    let mut session = guard.as_ref().cloned().ok_or("请先登录 Ravenai。")?;
    if session.user["id"].as_i64() != Some(input.user_id) {
        return Err("账户已切换，请重新打开工作台。".into());
    }
    if session.expires_at <= api::now() + 45 {
        match api::refresh(state, &session).await {
            Ok(updated) => {
                session = updated;
                *guard = Some(session.clone());
            }
            Err(error) => {
                if error.status == 401 {
                    vault::clear(&state.directory)?;
                    *guard = None;
                }
                return Err(error.message);
            }
        }
    }
    let build = |token: &str| {
        let mut request = state
            .http
            .request(
                Method::from_bytes(input.method.as_bytes()).unwrap(),
                format!("{}{}", api::API, input.path),
            )
            .timeout(Duration::from_secs(300))
            .bearer_auth(token)
            .header("Accept-Language", "zh-CN")
            .header("X-User-UI-Request", "1");
        for (name, value) in &input.headers {
            request = request.header(name, value);
        }
        if !body.is_empty() {
            request = request.body(body.clone());
        }
        request
    };
    // Serialize refresh only. A long generation must not block logout or other pages.
    drop(guard);
    let response = build(&session.access_token)
        .send()
        .await
        .map_err(|_| "工作台连接中断，请检查任务记录后再决定是否重新提交。")?;
    if response.status() != 401 {
        return Ok(response);
    }
    let mut guard = state.session.lock().await;
    let current = guard.as_ref().cloned().ok_or("登录已结束。")?;
    if current.user["id"].as_i64() != Some(input.user_id) {
        return Err("账户已切换。".into());
    }
    if current.access_token != session.access_token {
        session = current;
    } else {
        match api::refresh(state, &current).await {
            Ok(updated) => {
                session = updated;
                *guard = Some(session.clone());
            }
            Err(error) => {
                if error.status == 401 {
                    vault::clear(&state.directory)?;
                    *guard = None;
                }
                return Err(error.message);
            }
        }
    }
    drop(guard);
    // Replay only a rejected JWT, preserving the existing server request ID.
    let retried = build(&session.access_token)
        .send()
        .await
        .map_err(|_| "工作台连接中断，请检查任务记录。")?;
    if retried.status() == 401 {
        let mut guard = state.session.lock().await;
        if guard
            .as_ref()
            .is_some_and(|current| current.access_token == session.access_token)
        {
            vault::clear(&state.directory)?;
            *guard = None;
        }
    }
    Ok(retried)
}

async fn stream(
    state: &AppState,
    input: &StudioRequest,
    body: Vec<u8>,
    events: &Channel<StudioEvent>,
) -> Result<(), String> {
    let mut response = send(state, input, body).await?;
    let status = response.status().as_u16();
    if response.content_length().unwrap_or(0) > MAX_RESPONSE as u64 {
        return Err("工作台响应过大。".into());
    }
    let headers = ["content-type", "content-length", "retry-after"]
        .iter()
        .filter_map(|name| {
            response
                .headers()
                .get(*name)
                .and_then(|v| v.to_str().ok())
                .map(|v| (name.to_string(), v.to_string()))
        })
        .collect();
    events
        .send(StudioEvent::Headers {
            status: response.status().as_u16(),
            headers,
        })
        .map_err(|_| "工作台已关闭。")?;
    let mut length = 0;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "工作台响应中断，请检查任务记录。")?
    {
        length += chunk.len();
        if length > MAX_RESPONSE {
            return Err("工作台响应过大。".into());
        }
        for part in chunk.chunks(64 * 1024) {
            events
                .send(StudioEvent::Chunk {
                    data: STANDARD.encode(part),
                })
                .map_err(|_| "工作台已关闭。")?;
        }
    }
    if state.verify_studio {
        state
            .verified_reads
            .lock()
            .await
            .insert(input.path.clone(), status);
    }
    events
        .send(StudioEvent::End)
        .map_err(|_| "工作台已关闭。".into())
}

#[tauri::command]
pub async fn studio_request(
    state: State<'_, AppState>,
    input: StudioRequest,
    events: Channel<StudioEvent>,
) -> Result<(), String> {
    if state.verify_studio && input.method != "GET" {
        return Err("Verification permits read-only requests.".into());
    }
    let body = validate(&input)?;
    let (cancel, cancelled) = oneshot::channel();
    {
        let mut requests = state.studio_requests.lock().await;
        if requests.len() >= 32 || requests.contains_key(&input.id) {
            return Err("工作台请求过多，请稍后再试。".into());
        }
        requests.insert(input.id.clone(), cancel);
    }
    let result = tokio::select! {
        result = stream(&state, &input, body, &events) => result,
        _ = cancelled => Err("请求已停止。".into()),
    };
    state.studio_requests.lock().await.remove(&input.id);
    result
}

#[tauri::command]
pub async fn studio_cancel(state: State<'_, AppState>, id: String) -> Result<(), String> {
    if let Some(cancel) = state.studio_requests.lock().await.remove(&id) {
        let _ = cancel.send(());
    }
    Ok(())
}

pub async fn cancel_all(state: &AppState) {
    for (_, cancel) in state.studio_requests.lock().await.drain() {
        let _ = cancel.send(());
    }
}

#[tauri::command]
pub async fn studio_save(
    app: tauri::AppHandle,
    name: String,
    data: String,
) -> Result<bool, String> {
    use tauri_plugin_dialog::DialogExt;
    let name = std::path::Path::new(&name)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("ravenai-image.png");
    let ext = std::path::Path::new(name)
        .extension()
        .and_then(|v| v.to_str())
        .unwrap_or("")
        .to_lowercase();
    if ![
        "png", "jpg", "jpeg", "webp", "gif", "svg", "zip", "json", "html", "txt", "md",
    ]
    .contains(&ext.as_str())
        || name.len() > 180
    {
        return Err("不支持的导出格式。".into());
    }
    if data.len() > (MAX_RESPONSE + 2) / 3 * 4 {
        return Err("导出文件过大。".into());
    }
    let bytes = STANDARD.decode(data).map_err(|_| "导出数据无效。")?;
    if bytes.len() > MAX_RESPONSE {
        return Err("导出文件过大。".into());
    }
    let (tx, rx) = oneshot::channel();
    app.dialog()
        .file()
        .set_file_name(name)
        .add_filter("作品", &[ext.as_str()])
        .save_file(move |path| {
            let _ = tx.send(path);
        });
    let Some(path) = rx.await.map_err(|_| "保存窗口已关闭。")? else {
        return Ok(false);
    };
    std::fs::write(path.into_path().map_err(|_| "无效保存路径。")?, bytes)
        .map_err(|_| "无法保存文件，请选择其他位置。")?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn studio_routes_are_tenant_scoped_and_cannot_forward_credentials() {
        for (method, path) in [
            ("GET", "/image-studio/catalog"),
            ("GET", "/channels/available"),
            ("POST", "/image-studio/nova/tasks"),
            ("POST", "/image-studio/nova/proxy/image-edit"),
            ("GET", "/image-studio/nova/images/abc-123/0"),
            ("POST", "/image-studio/nova/tasks/abc-123/ack"),
        ] {
            assert!(allowed(method, path), "{path}");
        }
        for (method, path) in [
            ("GET", "/admin/users"),
            ("GET", "/image-studio/nova/tasks/../config"),
            ("GET", "/image-studio/nova/tasks/%2fconfig"),
            ("POST", "/image-studio/nova/config"),
            ("GET", "/image-studio/nova/ws"),
            ("GET", "/image-studio/nova/images/a/0?ticket=x"),
            ("GET", "https://evil.invalid"),
        ] {
            assert!(!allowed(method, path), "{path}");
        }
        let mut input = StudioRequest {
            id: "qa-request".into(),
            user_id: 1,
            method: "POST".into(),
            path: "/image-studio/nova/tasks".into(),
            headers: HashMap::new(),
            body: Some(STANDARD.encode(b"{}")),
        };
        assert_eq!(validate(&input).unwrap(), b"{}");
        input
            .headers
            .insert("authorization".into(), "Bearer unwanted".into());
        assert!(validate(&input).is_err());
        input.headers.clear();
        input.headers.insert(
            "content-type".into(),
            "application/json\r\nx-bad: yes".into(),
        );
        assert!(validate(&input).is_err());
    }
}
