mod api;
mod auth;
mod detector;
mod studio;
mod updater;
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
    studio_requests: Mutex<std::collections::HashMap<String, oneshot::Sender<()>>>,
    verify_studio: bool,
    verified_reads: Mutex<std::collections::HashMap<String, u16>>,
    detector: Mutex<Option<std::sync::Arc<lmfpd::Detector>>>,
}

#[tauri::command]
async fn client_state(state: State<'_, AppState>) -> Result<Value, String> {
    let session = state.session.lock().await;
    Ok(
        json!({
            "version": env!("CARGO_PKG_VERSION"),
            "platform": std::env::consts::OS,
            "arch": std::env::consts::ARCH,
            "server": api::SITE,
            "user": session.as_ref().map(|s| s.user.clone()),
            "authenticated": session.is_some(),
            "verify_studio": state.verify_studio
        }),
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
    if state.verify_studio {
        return Ok(());
    }
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
    if state.verify_studio && method != "GET" {
        return Err("Verification permits read-only requests.".into());
    }
    api::request(&state, &method, &path, body).await
}

#[tauri::command]
async fn studio_ready(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    tools: usize,
    width: u32,
    height: u32,
    preview: bool,
) -> Result<(), String> {
    if !state.verify_studio {
        return Ok(());
    }
    let report = state.verify_report.as_ref().ok_or("Missing report")?;
    let required = [
        "/auth/me",
        "/image-studio/catalog",
        "/channels/available",
        "/image-studio/nova/queue-status",
    ];
    let mut passed_reads = false;
    for _ in 0..100 {
        passed_reads = required.iter().all(|path| {
            state
                .verified_reads
                .try_lock()
                .is_ok_and(|reads| reads.get(*path) == Some(&200))
        });
        if passed_reads {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    let visible = app
        .get_webview_window("main")
        .ok_or("Missing window")?
        .is_visible()
        .map_err(|_| "Cannot read visibility")?;
    let passed = passed_reads && !visible && tools >= 8 && width > 500 && height > 400 && preview;
    let reads = state.verified_reads.lock().await.clone();
    let result = json!({"version":env!("CARGO_PKG_VERSION"),"passed":passed,"studio":"bundled Nova 3.4.0","tools":tools,"width":width,"height":height,"preview_sandbox":preview,"window_visible":visible,"authenticated":true,"isolated_webview":true,"read_only":true,"http_statuses":reads});
    std::fs::write(
        report,
        serde_json::to_vec_pretty(&result).map_err(|_| "Cannot encode report")?,
    )
    .map_err(|_| "Cannot save report")?;
    app.exit(if passed { 0 } else { 1 });
    Ok(())
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
    studio::cancel_all(&state).await;
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
    app.opener()
        .open_url(website_url(&page)?, None::<&str>)
        .map_err(|_| "无法打开默认浏览器。".into())
}

fn website_url(page: &str) -> Result<String, String> {
    let allowed = [
        "/",
        "/register",
        "/profile",
        "/buy-credits",
        "/purchase",
        "/image-studio",
        "/model-trace",
        "/channel-status",
        "/model-plaza",
        "/support",
        "/legal/terms",
        "/legal/privacy",
    ];
    if !allowed.contains(&page) {
        return Err("无效的网站入口。".into());
    }
    Ok(if page == "/buy-credits" {
        "https://wzyp.cn/shop/ravenai".to_string()
    } else {
        format!("{}{page}", api::SITE)
    })
}

#[cfg(test)]
mod website_tests {
    use super::website_url;
    #[test]
    fn purchase_uses_approved_shop_and_other_entries_remain_scoped() {
        assert_eq!(
            website_url("/buy-credits").unwrap(),
            "https://wzyp.cn/shop/ravenai"
        );
        assert_eq!(
            website_url("/profile").unwrap(),
            "https://ravenaiworld.org/profile"
        );
        assert!(website_url("https://untrusted.invalid").is_err());
        assert!(website_url("/buy-credits?redirect=elsewhere").is_err());
    }
}

#[tauri::command]
async fn set_window_theme(app: tauri::AppHandle, theme: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let next = match theme.as_str() {
            "dark" => Some(tauri::Theme::Dark),
            "light" => Some(tauri::Theme::Light),
            _ => None,
        };
        let _ = window.set_theme(next);
    }
    Ok(())
}

#[tauri::command]
async fn window_control(app: tauri::AppHandle, action: String) -> Result<bool, String> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(false);
    };
    match action.as_str() {
        "drag" => {
            let _ = window.start_dragging();
            Ok(true)
        }
        "minimize" => {
            let _ = window.minimize();
            Ok(true)
        }
        "toggle_maximize" => {
            let maximized = window.is_maximized().unwrap_or(false);
            if maximized {
                let _ = window.unmaximize();
            } else {
                let _ = window.maximize();
            }
            Ok(!maximized)
        }
        "is_maximized" => Ok(window.is_maximized().unwrap_or(false)),
        "close" => {
            let _ = window.close();
            Ok(true)
        }
        _ => Err("无效的窗口操作。".into()),
    }
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
        .register_uri_scheme_protocol("raven-preview", |_context, request| {
            let valid = request.method() == "GET" && request.uri().path() == "/preview";
            tauri::http::Response::builder()
                .status(if valid { 200 } else { 404 })
                .header("Content-Type", "text/html; charset=utf-8")
                .header("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; sandbox allow-scripts")
                .body(if valid { include_str!("../preview.html").as_bytes().to_vec() } else { Vec::new() })
                .unwrap()
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            let verify_studio = args.iter().any(|arg| arg == "--verify-studio");
            let verifying = verify_studio || args.iter().any(|arg| arg == "--verify-install");
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
            let directory = if verifying && !verify_studio {
                std::env::temp_dir().join(format!("ravenai-tauri-verify-{}", std::process::id()))
            } else {
                app.path().app_data_dir()?
            };
            let session = if verifying && !verify_studio {
                None
            } else {
                vault::read::<Session>(&directory).unwrap_or(None)
            };
            let http = api::http_client().map_err(std::io::Error::other)?;
            let browser_data = if verify_studio {
                std::env::temp_dir().join(format!("ravenai-studio-verify-{}", std::process::id()))
            } else {
                directory.join("webview")
            };
            app.manage(AppState {
                http,
                directory,
                session: Mutex::new(session),
                pending: Mutex::new(None),
                verify_report: verify_report.clone(),
                studio_requests: Mutex::new(std::collections::HashMap::new()),
                verify_studio,
                verified_reads: Mutex::new(std::collections::HashMap::new()),
                detector: Mutex::new(None),
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
            #[cfg(target_os = "macos")]
            {
                if let Ok(menu) = tauri::menu::Menu::default(app.handle()) {
                    let _ = app.set_menu(menu);
                }
            }
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
            set_window_theme,
            window_control,
            export_csv,
            studio::studio_request,
            studio::studio_cancel,
            studio::studio_save,
            studio_ready,
            detector::detector_status,
            detector::detector_challenges,
            detector::detector_analyze,
            detector::detector_detect,
            updater::check_update,
            updater::install_update,
            updater::open_release_page,
            updater::open_ecosystem_url
        ])
        .run(tauri::generate_context!())
        .expect("Ravenai application runtime failed");
}
