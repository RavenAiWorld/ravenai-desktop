use crate::AppState;
use lmfpd::{Api, Challenge, DetectConfig, Detector, LoadOptions, Output};
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{Emitter, State};

fn cache_path(state: &AppState) -> PathBuf {
    state.directory.join("lmfpd-data.bin")
}

async fn load_detector(state: &AppState) -> Result<Arc<Detector>, String> {
    {
        let guard = state.detector.lock().await;
        if let Some(detector) = guard.as_ref() {
            return Ok(Arc::clone(detector));
        }
    }
    let cache = cache_path(state);
    let loaded = tokio::task::spawn_blocking(move || {
        let mut opts = LoadOptions::default();
        opts.cache = cache;
        Detector::load(&opts)
    })
    .await
    .map_err(|_| "模型指纹检测引擎初始化中断。".to_string())?
    .map_err(|e| format!("无法加载模型指纹参考库（{e}）。请检查网络连接后重试。"))?;
    let arc = Arc::new(loaded);
    let mut guard = state.detector.lock().await;
    *guard = Some(Arc::clone(&arc));
    Ok(arc)
}

fn validate_endpoint(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.len() > 2048 {
        return Err("请输入有效的 API Base URL。".into());
    }
    let parsed = url::Url::parse(trimmed).map_err(|_| "API Base URL 格式无效。".to_string())?;
    let host = parsed.host_str().unwrap_or("");
    let ok = match parsed.scheme() {
        "https" => !host.is_empty(),
        "http" => matches!(host, "localhost" | "127.0.0.1" | "::1"),
        _ => false,
    };
    if !ok {
        return Err("仅支持 HTTPS 接口地址（或本地 localhost 调试地址）。".into());
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("API 地址不能包含内嵌凭据。".into());
    }
    Ok(trimmed.to_string())
}

fn parse_api(name: &str) -> Api {
    match name {
        "chat_completions" => Api::ChatCompletions,
        "messages" => Api::Messages,
        _ => Api::Responses,
    }
}

#[derive(Deserialize)]
pub struct DetectInput {
    pub run_id: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    #[serde(default)]
    pub api: String,
    #[serde(default)]
    pub effort: String,
    #[serde(default)]
    pub service_tier: String,
    #[serde(default = "default_stream")]
    pub stream: bool,
    #[serde(default)]
    pub strict: bool,
    #[serde(default = "default_count")]
    pub count: usize,
}

fn default_stream() -> bool {
    true
}

fn default_count() -> usize {
    3
}

#[tauri::command]
pub async fn detector_status(state: State<'_, AppState>) -> Result<Value, String> {
    let cache = cache_path(&state);
    let cached = cache.exists();
    let guard = state.detector.lock().await;
    Ok(json!({
        "loaded": guard.is_some(),
        "built_at": guard.as_ref().map(|d| d.built_at()),
        "cached": cached,
    }))
}

#[tauri::command]
pub async fn detector_challenges(count: Option<usize>) -> Result<Vec<Challenge>, String> {
    let n = count.unwrap_or(3).clamp(1, 3);
    lmfpd::generate_challenges(n).map_err(|e| format!("生成测试题失败：{e}"))
}

#[tauri::command]
pub async fn detector_analyze(
    state: State<'_, AppState>,
    outputs: Vec<Output>,
    strict: Option<bool>,
) -> Result<Value, String> {
    if outputs.is_empty() || outputs.len() > 3 {
        return Err("请提供 1 到 3 组模型回答。".into());
    }
    let detector = load_detector(&state).await?;
    let strict = strict.unwrap_or(false);
    let built_at = detector.built_at().to_string();
    let analysis = tokio::task::spawn_blocking(move || detector.analyze(&outputs, strict))
        .await
        .map_err(|_| "评分任务中断。".to_string())?
        .map_err(|e| format!("指纹分析失败：{e}"))?;
    Ok(json!({
        "built_at": built_at,
        "analysis": analysis,
    }))
}

#[tauri::command]
pub async fn detector_detect(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    input: DetectInput,
) -> Result<Value, String> {
    if state.verify_studio {
        return Err("Verification permits read-only requests.".into());
    }
    let base_url = validate_endpoint(&input.base_url)?;
    let api_key = input.api_key.trim().to_string();
    if api_key.is_empty() {
        return Err("请选择或输入有效的 API 密钥。".into());
    }
    let model = input.model.trim().to_string();
    if model.is_empty() || model.len() > 200 {
        return Err("请选择或输入有效的目标模型名称。".into());
    }
    let count = input.count.clamp(1, 3);
    let mut config = DetectConfig::new(base_url, api_key, model);
    config.api = parse_api(&input.api);
    config.effort = input.effort.trim().to_string();
    config.service_tier = if input.service_tier.trim().is_empty() {
        "default".into()
    } else {
        input.service_tier.trim().to_string()
    };
    config.stream = input.stream;
    config.strict = input.strict && count == 3;
    config.count = count;
    config.parallel = count;
    config.timeout = 90.0;

    let detector = load_detector(&state).await?;
    let built_at = detector.built_at().to_string();
    let run_id = input.run_id;
    let result = tokio::task::spawn_blocking(move || {
        detector.detect_with(&config, |index, sample| {
            let _ = app.emit(
                "detector-progress",
                json!({
                    "run_id": run_id,
                    "index": index,
                    "sample": sample,
                }),
            );
        })
    })
    .await
    .map_err(|_| "模型指纹检测任务异常终止。".to_string())?
    .map_err(|e| format!("检测配置无效：{e}"))?;

    Ok(json!({
        "built_at": built_at,
        "result": result,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn endpoint_validation_allows_https_and_loopback_only() {
        assert!(validate_endpoint("https://api.ravenaiworld.org/v1").is_ok());
        assert!(validate_endpoint("https://api.ravenaiworld.org").is_ok());
        assert!(validate_endpoint("http://127.0.0.1:8080/v1").is_ok());
        assert!(validate_endpoint("http://example.com/v1").is_err());
        assert!(validate_endpoint("file:///etc/passwd").is_err());
        assert!(validate_endpoint("https://user:pass@api.ravenaiworld.org/v1").is_err());
        assert!(validate_endpoint("").is_err());
    }

    #[test]
    fn challenges_match_expected_range() {
        let list = lmfpd::generate_challenges(3).expect("generate 3 challenges");
        assert_eq!(list.len(), 3);
        for item in list {
            assert!((292..=332).contains(&item.expected_count));
            assert!(!item.prompt.is_empty());
        }
    }
}
