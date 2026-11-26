use crate::{vault, AppState, Session};
use reqwest::Method;
use serde_json::{json, Value};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub const SITE: &str = "https://ravenaiworld.org";
pub const API: &str = "https://ravenaiworld.org/api/v1";
pub fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

pub fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .connect_timeout(Duration::from_secs(12))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("RavenaiDesktop/3.0.0 (Windows)")
        .build()
        .map_err(|_| "Could not initialize the connection".into())
}

#[derive(Debug)]
pub struct ApiError {
    pub status: u16,
    pub message: String,
}

pub async fn send(
    client: &reqwest::Client,
    method: Method,
    path: &str,
    body: Option<Value>,
    token: Option<&str>,
) -> Result<Value, ApiError> {
    let mut request = client
        .request(method, format!("{API}{path}"))
        .header("Accept", "application/json")
        .header("Accept-Language", "zh-CN")
        .header("X-User-UI-Request", "1");
    if let Some(token) = token {
        request = request.bearer_auth(token);
    }
    if let Some(body) = body {
        request = request.json(&body);
    }
    let mut response = request.send().await.map_err(|_| ApiError {
        status: 0,
        message: "无法连接 Ravenai，请检查网络后重试。".into(),
    })?;
    let status = response.status().as_u16();
    if response.content_length().unwrap_or(0) > 16 * 1024 * 1024 {
        return Err(ApiError {
            status: 502,
            message: "服务器响应过大。".into(),
        });
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| ApiError {
        status,
        message: "连接中断，请重试。".into(),
    })? {
        if bytes.len() + chunk.len() > 16 * 1024 * 1024 {
            return Err(ApiError {
                status: 502,
                message: "服务器响应过大。".into(),
            });
        }
        bytes.extend_from_slice(&chunk);
    }
    let value: Value = serde_json::from_slice(&bytes).map_err(|_| ApiError {
        status,
        message: "服务器没有返回有效数据，请稍后重试。".into(),
    })?;
    if !(200..300).contains(&status) || value.get("code").and_then(Value::as_i64) != Some(0) {
        return Err(ApiError {
            status,
            message: value
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("请求失败，请重试。")
                .chars()
                .take(300)
                .collect(),
        });
    }
    Ok(value.get("data").cloned().unwrap_or(Value::Null))
}

fn numeric(value: &str) -> bool {
    !value.is_empty() && value.len() < 20 && value.bytes().all(|b| b.is_ascii_digit())
}

pub fn allowed(method: &str, path: &str) -> bool {
    if path.len() > 4096 || !path.starts_with('/') || path.contains(['\\', '#']) {
        return false;
    }
    let plain = path.split('?').next().unwrap_or("");
    if plain.contains('%') || plain.contains("..") || plain.contains("//") {
        return false;
    }
    let parts: Vec<_> = plain.split('/').skip(1).collect();
    match (method, parts.as_slice()) {
        (
            "GET",
            ["auth", "me"]
            | ["user", "profile"]
            | ["user", "aff"]
            | ["user", "platform-quotas"]
            | ["keys"]
            | ["groups", "available"]
            | ["groups", "rates"]
            | ["usage"]
            | ["usage", "errors"]
            | ["model-plaza"]
            | ["announcements"]
            | ["redeem", "history"]
            | ["support-tickets"]
            | ["support-tickets", "summary"]
            | ["payment", "config"]
            | ["payment", "checkout-info"]
            | ["payment", "plans"]
            | ["payment", "orders", "my"]
            | ["subscriptions", "active"]
            | ["subscriptions", "summary"]
            | ["subscriptions", "progress"],
        ) => true,
        ("GET", ["usage", "dashboard", name]) => {
            ["stats", "trend", "models", "groups"].contains(name)
        }
        (
            "GET",
            ["keys", id]
            | ["usage", id]
            | ["usage", "errors", id]
            | ["support-tickets", id]
            | ["payment", "orders", id],
        ) => numeric(id),
        ("POST", ["keys"] | ["redeem"] | ["support-tickets"] | ["user", "aff", "transfer"]) => true,
        ("PUT", ["user"]) => true,
        ("PUT" | "DELETE", ["keys", id]) => numeric(id),
        ("PATCH", ["support-tickets", id]) => numeric(id),
        ("POST", ["support-tickets", id, action]) => {
            numeric(id) && ["replies", "read"].contains(action)
        }
        ("POST", ["payment", "orders", id, "cancel"]) => numeric(id),
        _ => false,
    }
}

pub async fn request(
    state: &AppState,
    method: &str,
    path: &str,
    body: Option<Value>,
) -> Result<Value, String> {
    if !allowed(method, path) {
        return Err("此操作不在客户端的授权范围内。".into());
    }
    if body
        .as_ref()
        .is_some_and(|b| b.to_string().len() > 2 * 1024 * 1024)
    {
        return Err("提交内容过大。".into());
    }
    let mut guard = state.session.lock().await;
    let mut session = guard.as_ref().cloned().ok_or("请先登录 Ravenai。")?;
    if session.expires_at <= now() + 45 {
        match refresh(state, &session).await {
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
    let verb = Method::from_bytes(method.as_bytes()).map_err(|_| "无效请求")?;
    let mut result = send(
        &state.http,
        verb.clone(),
        path,
        body.clone(),
        Some(&session.access_token),
    )
    .await;
    if result.as_ref().err().is_some_and(|e| e.status == 401) {
        match refresh(state, &session).await {
            Ok(updated) => {
                session = updated;
                *guard = Some(session.clone());
                result = send(&state.http, verb, path, body, Some(&session.access_token)).await;
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
    result.map_err(|e| e.message)
}

async fn refresh(state: &AppState, session: &Session) -> Result<Session, ApiError> {
    let response = send(
        &state.http,
        Method::POST,
        "/auth/refresh",
        Some(json!({"refresh_token": session.refresh_token})),
        None,
    )
    .await?;
    let mut updated = Session::from_response(&response).map_err(|message| ApiError {
        status: 502,
        message,
    })?;
    updated.user = session.user.clone();
    vault::write(&state.directory, &updated).map_err(|message| ApiError {
        status: 500,
        message,
    })?;
    Ok(updated)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_user_workflows_can_reach_the_server() {
        for (method, path) in [
            ("GET", "/keys?page=1"),
            ("PUT", "/keys/3"),
            ("GET", "/usage/errors/7"),
            ("POST", "/support-tickets/5/replies"),
        ] {
            assert!(allowed(method, path));
        }
        for (method, path) in [
            ("GET", "https://evil.example"),
            ("GET", "//evil.example"),
            ("GET", "/keys/../admin/users"),
            ("GET", "/keys/%2e%2e/admin"),
            ("POST", "/auth/login"),
            ("GET", "/admin/users"),
            ("POST", "/payment/orders"),
            ("DELETE", "/user"),
            ("GET", "/keys/1\\admin"),
        ] {
            assert!(!allowed(method, path), "{method} {path}");
        }
    }
}
