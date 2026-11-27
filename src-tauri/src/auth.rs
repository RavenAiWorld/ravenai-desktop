use crate::{api, vault, AppState, Pending, Session};
use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::Html,
    routing::get,
    Router,
};
use oauth2::{CsrfToken, PkceCodeChallenge};
use serde::Deserialize;
use serde_json::json;
use std::{sync::Arc, time::Duration};
use subtle::ConstantTimeEq;
use tauri::{Emitter, Manager};
use tauri_plugin_opener::OpenerExt;
use tokio::{
    net::TcpListener,
    sync::{oneshot, Mutex},
};
use url::Url;

#[derive(Clone)]
struct CallbackState {
    state: String,
    host: String,
    result: Arc<Mutex<Option<oneshot::Sender<Result<String, String>>>>>,
}
#[derive(Deserialize)]
struct Callback {
    state: String,
    code: Option<String>,
    error: Option<String>,
}

fn validate_callback(input: &Callback, expected: &str) -> Result<String, String> {
    if input.state.len() != expected.len()
        || !bool::from(input.state.as_bytes().ct_eq(expected.as_bytes()))
    {
        return Err("invalid_state".into());
    }
    if input.error.as_deref() == Some("access_denied") && input.code.is_none() {
        return Err("你已取消官网授权。".into());
    }
    if input.error.is_some() {
        return Err("授权请求无效，请重新登录。".into());
    }
    let code = input.code.as_deref().unwrap_or("");
    if code.len() != 43
        || !code
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        return Err("授权码无效，请重新登录。".into());
    }
    Ok(code.into())
}

async fn callback(
    State(shared): State<CallbackState>,
    headers: HeaderMap,
    Query(input): Query<Callback>,
) -> (StatusCode, [(String, String); 3], Html<&'static str>) {
    let safe_headers = [
        ("Cache-Control".into(), "no-store".into()),
        ("Referrer-Policy".into(), "no-referrer".into()),
        (
            "Content-Security-Policy".into(),
            "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'".into(),
        ),
    ];
    if headers.get("host").and_then(|h| h.to_str().ok()) != Some(shared.host.as_str()) {
        return (
            StatusCode::BAD_REQUEST,
            safe_headers,
            Html("Invalid callback"),
        );
    }
    let result = validate_callback(&input, &shared.state);
    if result.as_ref().err().is_some_and(|e| e == "invalid_state") {
        return (
            StatusCode::BAD_REQUEST,
            safe_headers,
            Html("Invalid callback"),
        );
    }
    let approved = result.is_ok();
    if let Some(sender) = shared.result.lock().await.take() {
        let _ = sender.send(result);
    } else {
        return (
            StatusCode::CONFLICT,
            safe_headers,
            Html("This authorization callback has already been used"),
        );
    }
    let html = if approved {
        "<!doctype html><html lang='zh-CN'><meta charset='utf-8'><title>Ravenai</title><style>body{font:16px system-ui;margin:12vh auto;padding:32px;max-width:520px;color:#242a2c}h1{font-size:26px}p{line-height:1.8;color:#60686c}</style><h1>已返回 Ravenai 客户端</h1><p>客户端正在确认登录。你可以关闭此页面。</p></html>"
    } else {
        "<!doctype html><html lang='zh-CN'><meta charset='utf-8'><title>Ravenai</title><style>body{font:16px system-ui;margin:12vh auto;padding:32px;max-width:520px}</style><h1>本次授权已结束</h1><p>请返回 Ravenai 客户端查看结果。</p></html>"
    };
    (StatusCode::OK, safe_headers, Html(html))
}

pub async fn start(app: tauri::AppHandle) -> Result<(), String> {
    let managed = app.state::<AppState>();
    if managed.verify_report.is_some() {
        return Err("Login is disabled during installation verification".into());
    }
    if managed.session.lock().await.is_some() {
        return Err("已经登录，请先退出当前账号。".into());
    }
    let mut pending = managed.pending.lock().await;
    if let Some(old) = pending.take() {
        let _ = old.cancel.send(());
    }
    let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
        .await
        .map_err(|_| "无法建立本机登录回调，请重试。")?;
    let address = listener.local_addr().map_err(|_| "无法建立登录回调")?;
    let redirect = format!("http://{address}/oauth/callback");
    let (challenge, verifier) = PkceCodeChallenge::new_random_sha256();
    let state = CsrfToken::new_random_len(32).secret().to_owned();
    let (result_tx, result_rx) = oneshot::channel();
    let (cancel_tx, cancel_rx) = oneshot::channel();
    let (stop_tx, stop_rx) = oneshot::channel::<()>();
    let router = Router::new()
        .route("/oauth/callback", get(callback))
        .with_state(CallbackState {
            state: state.clone(),
            host: address.to_string(),
            result: Arc::new(Mutex::new(Some(result_tx))),
        });
    let server = tokio::spawn(async move {
        let _ = axum::serve(listener, router)
            .with_graceful_shutdown(async {
                let _ = stop_rx.await;
            })
            .await;
    });
    let mut url = Url::parse(&format!("{}/oauth/desktop/authorize", api::SITE))
        .map_err(|_| "授权地址无效")?;
    url.query_pairs_mut().extend_pairs([
        ("client_id", "ravenai-desktop"),
        ("response_type", "code"),
        ("redirect_uri", redirect.as_str()),
        ("code_challenge", challenge.as_str()),
        ("code_challenge_method", "S256"),
        ("state", state.as_str()),
    ]);
    *pending = Some(Pending {
        id: state.clone(),
        url: url.to_string(),
        cancel: cancel_tx,
    });
    // Opening the browser occurs only in response to the user's Login action.
    if app.opener().open_url(url.as_str(), None::<&str>).is_err() {
        pending.take();
        let _ = stop_tx.send(());
        return Err("无法打开默认浏览器，请检查系统默认浏览器设置。".into());
    }
    drop(pending);
    tauri::async_runtime::spawn(async move {
        let outcome = tokio::select! {
            _ = cancel_rx => Err("本次登录已取消。".to_string()),
            _ = tokio::time::sleep(Duration::from_secs(300)) => Err("授权已超时，请重新登录。".to_string()),
            result = result_rx => result.unwrap_or_else(|_| Err("授权连接已结束，请重试。".into())),
        };
        let _ = stop_tx.send(());
        let _ = tokio::time::timeout(Duration::from_secs(2), server).await;
        let managed = app.state::<AppState>();
        if managed
            .pending
            .lock()
            .await
            .as_ref()
            .is_none_or(|p| p.id != state)
        {
            return;
        }
        let exchanged = match outcome {
            Ok(code) => {
                match api::send(&managed.http, reqwest::Method::POST, "/auth/desktop/token", Some(json!({"client_id":"ravenai-desktop","grant_type":"authorization_code","code":code,"code_verifier":verifier.secret(),"redirect_uri":redirect})), None).await {
                    Ok(value) => Session::from_response(&value), Err(error) => Err(error.message),
                }
            }, Err(error) => Err(error),
        };
        let (result, discarded) = commit_login(&managed, &state, exchanged).await;
        if let Some(session) = discarded {
            let _ = api::send(
                &managed.http,
                reqwest::Method::POST,
                "/auth/logout",
                Some(json!({"refresh_token":session.refresh_token})),
                None,
            )
            .await;
        }
        if let Some(result) = result {
            let _ = app.emit(
                "auth-complete",
                json!({"success":result.is_ok(),"error":result.err()}),
            );
        }
    });
    Ok(())
}

// The HTTPS exchange runs without this lock. A cancelled or superseded flow
// cannot commit credentials; its separate server session is then revoked.
async fn commit_login(
    managed: &AppState,
    id: &str,
    exchanged: Result<Session, String>,
) -> (Option<Result<(), String>>, Option<Session>) {
    let mut pending = managed.pending.lock().await;
    if pending.as_ref().is_none_or(|p| p.id != id) {
        return (None, exchanged.ok());
    }
    let mut discarded = None;
    let result = match exchanged {
        Ok(session) => {
            let mut guard = managed.session.lock().await;
            match vault::write(&managed.directory, &session) {
                Ok(()) => {
                    *guard = Some(session);
                    Ok(())
                }
                Err(error) => {
                    discarded = Some(session);
                    Err(error)
                }
            }
        }
        Err(error) => Err(error),
    };
    pending.take();
    (Some(result), discarded)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn callback_rejects_swapped_state_missing_code_and_errors() {
        assert_eq!(CsrfToken::new_random_len(32).secret().len(), 43);
        let state = "s".repeat(43);
        let code = "c".repeat(43);
        assert_eq!(
            validate_callback(
                &Callback {
                    state: state.clone(),
                    code: Some(code.clone()),
                    error: None
                },
                &state
            )
            .unwrap(),
            code
        );
        assert!(validate_callback(
            &Callback {
                state: "other".into(),
                code: Some(code),
                error: None
            },
            &state
        )
        .is_err());
        assert!(validate_callback(
            &Callback {
                state: state.clone(),
                code: None,
                error: None
            },
            &state
        )
        .is_err());
        assert!(validate_callback(
            &Callback {
                state: state.clone(),
                code: None,
                error: Some("access_denied".into())
            },
            &state
        )
        .is_err());
    }

    #[tokio::test]
    async fn loopback_rejects_wrong_host_state_and_replay() {
        let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
            .await
            .unwrap();
        let address = listener.local_addr().unwrap();
        let expected = "s".repeat(43);
        let code = "c".repeat(43);
        let (tx, mut rx) = oneshot::channel();
        let router = Router::new()
            .route("/oauth/callback", get(callback))
            .with_state(CallbackState {
                state: expected.clone(),
                host: address.to_string(),
                result: Arc::new(Mutex::new(Some(tx))),
            });
        let server = tokio::spawn(async move { axum::serve(listener, router).await.unwrap() });
        let client = reqwest::Client::builder().no_proxy().build().unwrap();
        let url = format!("http://{address}/oauth/callback");
        let wrong_host = client
            .get(&url)
            .header("host", "attacker.invalid")
            .query(&[("state", &expected), ("code", &code)])
            .send()
            .await
            .unwrap();
        assert_eq!(wrong_host.status(), 400);
        let wrong_state = client
            .get(&url)
            .query(&[("state", "wrong"), ("code", code.as_str())])
            .send()
            .await
            .unwrap();
        assert_eq!(wrong_state.status(), 400);
        assert!(rx.try_recv().is_err());
        let valid = client
            .get(&url)
            .query(&[("state", &expected), ("code", &code)])
            .send()
            .await
            .unwrap();
        assert_eq!(valid.status(), 200);
        assert_eq!(valid.headers()["cache-control"], "no-store");
        assert_eq!(rx.await.unwrap().unwrap(), code);
        let replay = client
            .get(&url)
            .query(&[("state", &expected), ("code", &code)])
            .send()
            .await
            .unwrap();
        assert_eq!(replay.status(), 409);
        server.abort();
    }

    #[tokio::test]
    async fn cancelled_and_superseded_exchanges_never_store_credentials() {
        let directory = std::env::temp_dir().join(format!(
            "ravenai-commit-test-{}-{}",
            std::process::id(),
            rand::random::<u64>()
        ));
        let state = AppState {
            http: api::http_client().unwrap(),
            directory: directory.clone(),
            session: Mutex::new(None),
            pending: Mutex::new(None),
            verify_report: None,
            studio_requests: Mutex::new(std::collections::HashMap::new()),
            verify_studio: false,
            verified_reads: Mutex::new(std::collections::HashMap::new()),
            detector: Mutex::new(None),
        };
        let session = Session {
            access_token: "disposable-access".into(),
            refresh_token: "rt_disposable-refresh".into(),
            expires_at: api::now() + 900,
            user: json!({"id":7}),
        };
        let (result, discarded) = commit_login(&state, "cancelled", Ok(session.clone())).await;
        assert!(result.is_none());
        assert!(discarded.is_some());
        assert!(!directory.exists());
        assert!(state.session.lock().await.is_none());
        let (tx, _rx) = oneshot::channel();
        *state.pending.lock().await = Some(Pending {
            id: "current".into(),
            url: String::new(),
            cancel: tx,
        });
        let (result, discarded) = commit_login(&state, "previous", Ok(session.clone())).await;
        assert!(result.is_none());
        assert!(discarded.is_some());
        assert_eq!(state.pending.lock().await.as_ref().unwrap().id, "current");
        assert!(!directory.exists());
        let (result, discarded) = commit_login(&state, "current", Ok(session)).await;
        assert!(result.unwrap().is_ok());
        assert!(discarded.is_none());
        assert!(state.pending.lock().await.is_none());
        assert_eq!(
            vault::read::<Session>(&directory).unwrap().unwrap().user["id"],
            7
        );
        vault::clear(&directory).unwrap();
        assert!(vault::read::<Session>(&directory).unwrap().is_none());
        std::fs::remove_dir_all(directory).unwrap();
    }
}
