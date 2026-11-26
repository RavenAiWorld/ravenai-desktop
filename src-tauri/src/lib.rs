mod api;
mod auth;
mod vault;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;
use tauri::{Manager, State};
use tauri_plugin_opener::OpenerExt;
use tokio::sync::{oneshot, Mutex};

#[derive(Clone, Serialize, Deserialize)]
struct Session {
    access_token: String,
    refresh_token: String,
    expires_at: u64,
    user: Value,
}
impl Session {
    fn from_response(value: &Value) -> Result<Self, String> {
        let access = value["access_token"]
            .as_str()
            .filter(|s| !s.is_empty())
            .ok_or("登录响应缺少会话，请重新授权。")?;
        let refresh = value["refresh_token"]
            .as_str()
            .filter(|s| s.starts_with("rt_"))
            .ok_or("登录响应缺少刷新会话，请重新授权。")?;
        let expires = value["expires_in"]
            .as_u64()
            .filter(|v| *v > 0 && *v <= 31_536_000)
            .ok_or("登录有效期无效。")?;
        Ok(Self {
            access_token: access.into(),
            refresh_token: refresh.into(),
            expires_at: api::now() + expires,
            user: value.get("user").cloned().unwrap_or(Value::Null),
        })
    }
}
struct Pending {
    id: String,
    url: String,
    cancel: oneshot::Sender<()>,
}
struct AppState {
    http: reqwest::Client,
    directory: PathBuf,
    session: Mutex<Option<Session>>,
    pending: Mutex<Option<Pending>>,
    verify_report: Option<PathBuf>,
}

#[tauri::command]
async fn client_state(state: State<'_, AppState>) -> Result<Value, String> {
    let session = state.session.lock().await;
    Ok(
        json!({"version":env!("CARGO_PKG_VERSION"),"server":api::SITE,"user":session.as_ref().map(|s|s.user.clone()),"authenticated":session.is_some()}),
    )
}

#[tauri::command]
async fn frontend_ready(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    phase: String,
) -> Result<(), String> {
    let Some(report) = &state.verify_report else {
        return Ok(());
    };
    if phase != "login" {
        return Err("Unexpected verification state".into());
    }
    let window = app
        .get_webview_window("main")
        .ok_or("Missing application window")?;
    let visible = window
        .is_visible()
        .map_err(|_| "Cannot inspect application window")?;
    let public = api::send(
        &state.http,
        reqwest::Method::GET,
        "/settings/public",
        None,
        None,
    )
    .await
    .map_err(|e| e.message)?;
    let result = json!({"version":env!("CARGO_PKG_VERSION"),"runtime":"Tauri 2 / Rust / React","webview":tauri::webview_version().unwrap_or_default(),"frontend":phase,"window_visible":visible,"isolated_storage":true,"site_name":public["site_name"],"server_version":public["version"],"authenticated":false,"passed":!visible});
    std::fs::write(
        report,
        serde_json::to_vec_pretty(&result).map_err(|_| "Cannot encode verification")?,
    )
    .map_err(|_| "Cannot save verification")?;
    app.exit(if visible { 1 } else { 0 });
    Ok(())
}

#[tauri::command]
async fn public_settings(state: State<'_, AppState>) -> Result<Value, String> {
    api::send(
        &state.http,
        reqwest::Method::GET,
        "/settings/public",
        None,
        None,
    )
    .await
    .map_err(|e| e.message)
}

#[tauri::command]
async fn api_request(
    state: State<'_, AppState>,
    method: String,
    path: String,
    body: Option<Value>,
) -> Result<Value, String> {
    api::request(&state, &method, &path, body).await
}

#[tauri::command]
async fn login(app: tauri::AppHandle) -> Result<(), String> {
    auth::start(app).await
}

#[tauri::command]
async fn reopen_login(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let pending = state.pending.lock().await;
    let url = &pending.as_ref().ok_or("请重新发起登录。")?.url;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|_| "无法打开默认浏览器。".into())
}

#[tauri::command]
async fn cancel_login(state: State<'_, AppState>) -> Result<(), String> {
    if let Some(pending) = state.pending.lock().await.take() {
        let _ = pending.cancel.send(());
    }
    Ok(())
}

#[tauri::command]
async fn logout(state: State<'_, AppState>) -> Result<(), String> {
    cancel_login(state.clone()).await?;
    let mut guard = state.session.lock().await;
    vault::clear(&state.directory)?;
    let session = guard.take();
    if let Some(session) = session {
        // Clear local access even if the network is offline; report revocation failure.
        api::send(
            &state.http,
            reqwest::Method::POST,
            "/auth/logout",
            Some(json!({"refresh_token":session.refresh_token})),
            None,
        )
        .await
        .map_err(|_| "已退出本机登录。服务器会话撤销未完成，可在官网撤销全部会话。".to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn open_site(app: tauri::AppHandle, page: String) -> Result<(), String> {
    let allowed = [
        "/",
        "/register",
        "/profile",
        "/buy-credits",
        "/purchase",
        "/image-studio",
        "/model-trace",
        "/support",
        "/legal/terms",
        "/legal/privacy",
    ];
    if !allowed.contains(&page.as_str()) {
        return Err("无效的网站入口。".into());
    }
    app.opener()
        .open_url(format!("{}{page}", api::SITE), None::<&str>)
        .map_err(|_| "无法打开默认浏览器。".into())
}

#[tauri::command]
async fn export_csv(app: tauri::AppHandle, content: String) -> Result<bool, String> {
    use tauri_plugin_dialog::DialogExt;
    if content.len() > 10 * 1024 * 1024 {
        return Err("导出内容过大，请缩小日期范围。".into());
    }
    let (tx, rx) = oneshot::channel();
    app.dialog()
        .file()
        .set_file_name("ravenai-usage.csv")
        .add_filter("CSV", &["csv"])
        .save_file(move |path| {
            let _ = tx.send(path);
        });
    let Some(path) = rx.await.map_err(|_| "文件对话框已关闭。")? else {
        return Ok(false);
    };
    let path = path.into_path().map_err(|_| "无效保存路径。")?;
    std::fs::write(path, format!("\u{feff}{content}"))
        .map_err(|_| "无法保存文件，请选择其他位置。")?;
    Ok(true)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            let verifying = args.iter().any(|arg| arg == "--verify-install");
            let verify_report = if verifying {
                Some(
                    args.windows(2)
                        .find(|pair| pair[0] == "--verify-report")
                        .map(|pair| PathBuf::from(&pair[1]))
                        .ok_or_else(|| {
                            std::io::Error::other("Verification requires a report path")
                        })?,
                )
            } else {
                None
            };
            let directory = if verifying {
                std::env::temp_dir().join(format!("ravenai-tauri-verify-{}", std::process::id()))
            } else {
                app.path().app_data_dir()?
            };
            let session = if verifying {
                None
            } else {
                vault::read::<Session>(&directory).unwrap_or(None)
            };
            let http = api::http_client().map_err(std::io::Error::other)?;
            let browser_data = directory.join("webview");
            app.manage(AppState {
                http,
                directory,
                session: Mutex::new(session),
                pending: Mutex::new(None),
                verify_report: verify_report.clone(),
            });
            let window =
                tauri::WebviewWindowBuilder::from_config(app, &app.config().app.windows[0])?
                    .data_directory(browser_data)
                    .visible(false)
                    .on_navigation(|url| {
                        url.scheme() == "tauri"
                            || (url.scheme() == "http" && url.host_str() == Some("tauri.localhost"))
                            || (cfg!(debug_assertions)
                                && url.scheme() == "http"
                                && url.host_str() == Some("127.0.0.1")
                                && url.port() == Some(1420))
                    })
                    .build()?;
            if !verifying {
                window.show()?;
            }
            if let Some(report) = verify_report {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_secs(45)).await;
                    if !report.exists() {
                        let _ = std::fs::write(
                            report,
                            b"{\"passed\":false,\"error\":\"Frontend verification timed out\"}",
                        );
                        handle.exit(1);
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            client_state,
            frontend_ready,
            public_settings,
            api_request,
            login,
            reopen_login,
            cancel_login,
            logout,
            open_site,
            export_csv
        ])
        .run(tauri::generate_context!())
        .expect("Ravenai application runtime failed");
}
