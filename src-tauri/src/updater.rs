use crate::AppState;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{Emitter, State};
use tauri_plugin_opener::OpenerExt;

pub const GITHUB_OWNER: &str = "RavenAiWorld";
pub const GITHUB_REPO_NAME: &str = "ravenai-desktop";
pub const GITHUB_RELEASES_URL: &str = "https://github.com/RavenAiWorld/ravenai-desktop/releases";
const SITE_RELEASE_ENDPOINT: &str = "https://ravenaiworld.org/api/v1/desktop-release";
const GITHUB_API_LATEST: &str =
    "https://api.github.com/repos/RavenAiWorld/ravenai-desktop/releases/latest";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReleaseInfo {
    pub current_version: String,
    pub latest_version: String,
    pub display_version: String,
    pub has_update: bool,
    pub release_url: String,
    pub download_url: String,
    pub asset_name: String,
    pub file_size: u64,
    pub sha256: Option<String>,
    pub release_notes: String,
    pub published_at: String,
    pub source: String,
}

#[derive(Clone, Debug, Serialize)]
struct UpdateProgress {
    phase: String,
    downloaded: u64,
    total: u64,
    percent: u8,
}

#[derive(Deserialize)]
pub struct InstallUpdateInput {
    download_url: String,
    asset_name: String,
    sha256: Option<String>,
}

#[derive(Deserialize)]
struct SiteReleaseEnvelope {
    code: Option<i64>,
    data: Option<SiteReleasePayload>,
}

#[derive(Deserialize)]
struct SiteReleasePayload {
    version: String,
    display_version: Option<String>,
    release_url: String,
    download_url: String,
    asset_name: String,
    file_size: Option<u64>,
    sha256: Option<String>,
    release_notes: Option<String>,
    published_at: Option<String>,
}

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
    html_url: String,
    body: Option<String>,
    published_at: Option<String>,
    assets: Vec<GitHubAsset>,
}

#[derive(Deserialize)]
struct GitHubAsset {
    name: String,
    size: u64,
    browser_download_url: String,
}

fn parse_semver(raw: &str) -> Option<(u64, u64, u64)> {
    let clean = raw
        .trim()
        .trim_start_matches('v')
        .trim_start_matches('V')
        .split(['-', '+'])
        .next()?;
    let parts: Vec<&str> = clean.split('.').collect();
    if parts.len() < 2 || parts.len() > 3 {
        return None;
    }
    let major = parts[0].parse::<u64>().ok()?;
    let minor = parts[1].parse::<u64>().ok()?;
    let patch = if parts.len() == 3 {
        parts[2].parse::<u64>().ok()?
    } else {
        0
    };
    Some((major, minor, patch))
}

pub fn is_newer_version(current: &str, latest: &str) -> bool {
    match (parse_semver(current), parse_semver(latest)) {
        (Some(c), Some(l)) => l > c,
        _ => false,
    }
}

pub fn format_display_version(version: &str) -> String {
    let clean = version.trim().trim_start_matches(['v', 'V']);
    if clean == "1.0.0" {
        "v1.00".into()
    } else {
        format!("v{clean}")
    }
}

pub fn validate_release_url(raw: &str) -> Result<String, String> {
    let url = url::Url::parse(raw.trim()).map_err(|_| "更新地址格式无效。")?;
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() {
        return Err("更新地址仅允许安全的 HTTPS 链接。".into());
    }
    let host = url.host_str().unwrap_or("");
    let path = url.path();
    let allowed = (host == "github.com"
        && path.starts_with(&format!("/{GITHUB_OWNER}/{GITHUB_REPO_NAME}")))
        || (host == "ravenaiworld.org" && path.starts_with("/download"));
    if !allowed {
        return Err("更新页面地址不在官方仓库白名单内。".into());
    }
    Ok(url.to_string())
}

pub fn validate_download_url(raw: &str) -> Result<String, String> {
    let url = url::Url::parse(raw.trim()).map_err(|_| "安装包下载地址无效。")?;
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() {
        return Err("安装包仅允许通过 HTTPS 官方地址下载。".into());
    }
    let host = url.host_str().unwrap_or("");
    let path = url.path();
    let allowed = host == "github.com"
        && path.starts_with(&format!("/{GITHUB_OWNER}/{GITHUB_REPO_NAME}/releases/download/"))
        && path.to_ascii_lowercase().ends_with("-setup.exe");
    if !allowed {
        return Err("安装包地址不属于 Ravenai 官方 GitHub Releases。".into());
    }
    Ok(url.to_string())
}

fn sanitize_asset_name(name: &str) -> Result<String, String> {
    let clean = name.trim();
    if clean.is_empty()
        || clean.contains(['/', '\\', ':', '*', '?', '"', '<', '>', '|'])
        || clean.contains("..")
        || !clean.to_ascii_lowercase().ends_with("-setup.exe")
    {
        return Err("安装包文件名无效。".into());
    }
    Ok(clean.to_string())
}

pub fn parse_sha256sums(content: &str, asset_name: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let mut parts = trimmed.split_whitespace();
        let hash = parts.next()?;
        let file = parts.next().map(|s| s.trim_start_matches('*'))?;
        if file.eq_ignore_ascii_case(asset_name)
            && hash.len() == 64
            && hash.chars().all(|c| c.is_ascii_hexdigit())
        {
            return Some(hash.to_ascii_lowercase());
        }
    }
    None
}

async fn fetch_from_site(http: &reqwest::Client, current: &str) -> Result<ReleaseInfo, String> {
    let resp = http
        .get(SITE_RELEASE_ENDPOINT)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|_| "官网更新源暂不可达。".to_string())?;
    if !resp.status().is_success() {
        return Err(format!("官网更新接口返回 HTTP {}。", resp.status().as_u16()));
    }
    let env = resp
        .json::<SiteReleaseEnvelope>()
        .await
        .map_err(|_| "官网更新信息解析失败。".to_string())?;
    if env.code.unwrap_or(0) != 0 {
        return Err("官网更新接口返回异常状态。".into());
    }
    let payload = env.data.ok_or("官网暂未返回版本数据。")?;
    let latest = payload
        .version
        .trim()
        .trim_start_matches(['v', 'V'])
        .to_string();
    let release_url = validate_release_url(&payload.release_url)?;
    let download_url = validate_download_url(&payload.download_url)?;
    let asset_name = sanitize_asset_name(&payload.asset_name)?;
    Ok(ReleaseInfo {
        current_version: current.to_string(),
        display_version: payload
            .display_version
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| format_display_version(&latest)),
        has_update: is_newer_version(current, &latest),
        latest_version: latest,
        release_url,
        download_url,
        asset_name,
        file_size: payload.file_size.unwrap_or(0),
        sha256: payload
            .sha256
            .map(|s| s.trim().to_ascii_lowercase())
            .filter(|s| s.len() == 64 && s.chars().all(|c| c.is_ascii_hexdigit())),
        release_notes: payload.release_notes.unwrap_or_default(),
        published_at: payload.published_at.unwrap_or_default(),
        source: "ravenai".into(),
    })
}

async fn fetch_from_github(http: &reqwest::Client, current: &str) -> Result<ReleaseInfo, String> {
    let resp = http
        .get(GITHUB_API_LATEST)
        .header("Accept", "application/vnd.github+json")
        .header(
            "User-Agent",
            format!("RavenaiDesktop/{}", env!("CARGO_PKG_VERSION")),
        )
        .timeout(std::time::Duration::from_secs(12))
        .send()
        .await
        .map_err(|_| "无法连接 GitHub Releases，请检查网络或稍后重试。".to_string())?;
    if !resp.status().is_success() {
        return Err(format!(
            "GitHub Releases 检查失败（HTTP {}）。",
            resp.status().as_u16()
        ));
    }
    let rel = resp
        .json::<GitHubRelease>()
        .await
        .map_err(|_| "无法解析 GitHub Release 元数据。".to_string())?;
    let latest = rel
        .tag_name
        .trim()
        .trim_start_matches(['v', 'V'])
        .to_string();
    let installer = rel
        .assets
        .iter()
        .find(|a| a.name.to_ascii_lowercase().ends_with("-setup.exe"))
        .ok_or("最新 Release 中未找到 Windows 安装包资产。")?;
    let release_url = validate_release_url(&rel.html_url)?;
    let download_url = validate_download_url(&installer.browser_download_url)?;
    let asset_name = sanitize_asset_name(&installer.name)?;

    let mut sha256 = None;
    if let Some(sum_asset) = rel
        .assets
        .iter()
        .find(|a| a.name.eq_ignore_ascii_case("SHA256SUMS.txt"))
    {
        if let Ok(sum_resp) = http
            .get(&sum_asset.browser_download_url)
            .header(
                "User-Agent",
                format!("RavenaiDesktop/{}", env!("CARGO_PKG_VERSION")),
            )
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
        {
            if sum_resp.status().is_success() {
                if let Ok(text) = sum_resp.text().await {
                    sha256 = parse_sha256sums(&text, &asset_name);
                }
            }
        }
    }

    Ok(ReleaseInfo {
        current_version: current.to_string(),
        display_version: format_display_version(&latest),
        has_update: is_newer_version(current, &latest),
        latest_version: latest,
        release_url,
        download_url,
        asset_name,
        file_size: installer.size,
        sha256,
        release_notes: rel.body.unwrap_or_default(),
        published_at: rel.published_at.unwrap_or_default(),
        source: "github".into(),
    })
}

#[tauri::command]
pub async fn check_update(state: State<'_, AppState>) -> Result<ReleaseInfo, String> {
    let current = env!("CARGO_PKG_VERSION");
    if let Ok(info) = fetch_from_site(&state.http, current).await {
        return Ok(info);
    }
    fetch_from_github(&state.http, current).await
}

#[tauri::command]
pub async fn open_release_page(app: tauri::AppHandle, url: Option<String>) -> Result<(), String> {
    let target = match url {
        Some(raw) if !raw.trim().is_empty() => validate_release_url(&raw)?,
        _ => GITHUB_RELEASES_URL.to_string(),
    };
    app.opener()
        .open_url(target, None::<String>)
        .map_err(|_| "无法打开浏览器访问更新页面。".into())
}

pub fn validate_ecosystem_url(raw: &str) -> Result<String, String> {
    let url = url::Url::parse(raw.trim()).map_err(|_| "推荐项目链接格式无效。")?;
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() {
        return Err("仅允许打开安全的 HTTPS 推荐链接。".into());
    }
    let host = url.host_str().unwrap_or("");
    let path = url.path();
    let allowed = (host == "github.com"
        && (path.starts_with("/BigPizzaV3/CodexPlusPlus")
            || path.starts_with("/jlcodes99/cockpit-tools")
            || path.starts_with("/farion1231/cc-switch")
            || path.starts_with("/BytePioneer-AI/codex-host")
            || path.starts_with(&format!("/{GITHUB_OWNER}/{GITHUB_REPO_NAME}"))))
        || host == "codexpp.cc"
        || host == "ccswitch.io";
    if !allowed {
        return Err("该外链不在官方推荐应用白名单内。".into());
    }
    Ok(url.to_string())
}

#[tauri::command]
pub async fn open_ecosystem_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let target = validate_ecosystem_url(&url)?;
    app.opener()
        .open_url(target, None::<String>)
        .map_err(|_| "无法在浏览器中打开该项目链接。".into())
}

#[tauri::command]
pub async fn install_update(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    input: InstallUpdateInput,
) -> Result<(), String> {
    if state.verify_studio || state.verify_report.is_some() {
        return Err("只读验证模式下禁止执行自动更新。".into());
    }
    let download_url = validate_download_url(&input.download_url)?;
    let asset_name = sanitize_asset_name(&input.asset_name)?;
    let expected_sha = input
        .sha256
        .map(|s| s.trim().to_ascii_lowercase())
        .filter(|s| !s.is_empty());
    if let Some(ref hash) = expected_sha {
        if hash.len() != 64 || !hash.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err("更新包的 SHA256 校验值格式无效。".into());
        }
    }

    let _ = app.emit(
        "update-progress",
        UpdateProgress {
            phase: "downloading".into(),
            downloaded: 0,
            total: 0,
            percent: 0,
        },
    );

    let mut resp = state
        .http
        .get(&download_url)
        .header(
            "User-Agent",
            format!("RavenaiDesktop/{}", env!("CARGO_PKG_VERSION")),
        )
        .timeout(std::time::Duration::from_secs(300))
        .send()
        .await
        .map_err(|_| "下载更新安装包失败，请检查网络连接或选择前往 GitHub 手动下载。".to_string())?;
    if !resp.status().is_success() {
        return Err(format!(
            "下载更新包返回 HTTP {}，请稍后重试或手动下载。",
            resp.status().as_u16()
        ));
    }
    let total = resp.content_length().unwrap_or(0);
    if total > 250 * 1024 * 1024 {
        return Err("安装包体积超出安全限制。".into());
    }

    let update_dir = std::env::temp_dir().join("ravenai-update");
    std::fs::create_dir_all(&update_dir).map_err(|_| "无法创建临时更新目录。")?;
    let target_path = update_dir.join(&asset_name);
    let mut file =
        std::fs::File::create(&target_path).map_err(|_| "无法写入临时更新安装包。")?;
    let mut hasher = Sha256::new();
    let mut downloaded: u64 = 0;
    let mut last_percent: u8 = 0;

    use std::io::Write;
    while let Some(chunk) = resp
        .chunk()
        .await
        .map_err(|_| "下载更新包过程中连接中断，请重试。".to_string())?
    {
        downloaded = downloaded.saturating_add(chunk.len() as u64);
        if downloaded > 250 * 1024 * 1024 {
            drop(file);
            let _ = std::fs::remove_file(&target_path);
            return Err("安装包体积超出安全限制。".into());
        }
        file.write_all(&chunk)
            .map_err(|_| "写入临时更新安装包失败。")?;
        hasher.update(&chunk);
        let pct = if total > 0 {
            ((downloaded * 100) / total).min(100) as u8
        } else {
            0
        };
        if pct != last_percent || downloaded == total {
            last_percent = pct;
            let _ = app.emit(
                "update-progress",
                UpdateProgress {
                    phase: "downloading".into(),
                    downloaded,
                    total,
                    percent: pct,
                },
            );
        }
    }
    drop(file);

    let _ = app.emit(
        "update-progress",
        UpdateProgress {
            phase: "verifying".into(),
            downloaded,
            total: total.max(downloaded),
            percent: 100,
        },
    );

    let actual_hash = format!("{:x}", hasher.finalize());
    if let Some(expected) = expected_sha {
        if actual_hash != expected {
            let _ = std::fs::remove_file(&target_path);
            return Err("安装包 SHA256 完整性校验未通过，已中止更新并清理临时文件。".into());
        }
    }

    let _ = app.emit(
        "update-progress",
        UpdateProgress {
            phase: "launching".into(),
            downloaded,
            total: total.max(downloaded),
            percent: 100,
        },
    );

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let current_exe = std::env::current_exe().ok();
        let script_path = update_dir.join("apply-update.cmd");
        let relaunch = current_exe
            .as_ref()
            .and_then(|p| p.to_str())
            .map(|p| format!("start \"\" \"{p}\""))
            .unwrap_or_default();
        let installer_str = target_path
            .to_str()
            .ok_or("安装包路径包含不支持的字符。")?;
        let script = format!(
            "@echo off\r\ntimeout /t 2 /nobreak >nul\r\n\"{installer_str}\" /S\r\n{relaunch}\r\n"
        );
        std::fs::write(&script_path, script).map_err(|_| "无法生成更新启动脚本。")?;
        std::process::Command::new("cmd.exe")
            .args(["/C", script_path.to_str().unwrap_or("")])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|_| "无法启动更新安装程序，请前往 GitHub 手动下载安装。")?;
        app.exit(0);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = target_path;
        return Err("自动安装仅支持 Windows 平台。".into());
    }

    #[allow(unreachable_code)]
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn semver_comparison_handles_v_prefix_and_numeric_ordering() {
        assert!(is_newer_version("1.0.0", "1.0.1"));
        assert!(is_newer_version("1.0.0", "v1.1.0"));
        assert!(is_newer_version("1.9.0", "1.10.0"));
        assert!(!is_newer_version("1.0.0", "v1.0.0"));
        assert!(!is_newer_version("1.2.0", "1.1.9"));
        assert_eq!(format_display_version("1.0.0"), "v1.00");
        assert_eq!(format_display_version("1.0.1"), "v1.0.1");
    }

    #[test]
    fn download_url_allowlist_blocks_untrusted_hosts_and_non_exe() {
        assert!(validate_download_url(
            "https://github.com/RavenAiWorld/ravenai-desktop/releases/download/v1.0.1/Ravenai_1.0.1_x64-setup.exe"
        )
        .is_ok());
        assert!(validate_download_url(
            "https://github.com/OtherUser/ravenai-desktop/releases/download/v1.0.1/Ravenai_1.0.1_x64-setup.exe"
        )
        .is_err());
        assert!(validate_download_url(
            "http://github.com/RavenAiWorld/ravenai-desktop/releases/download/v1.0.1/Ravenai_1.0.1_x64-setup.exe"
        )
        .is_err());
        assert!(validate_download_url(
            "https://github.com/RavenAiWorld/ravenai-desktop/releases/download/v1.0.1/payload.zip"
        )
        .is_err());
        assert!(validate_release_url(
            "https://github.com/RavenAiWorld/ravenai-desktop/releases/tag/v1.0.0"
        )
        .is_ok());
        assert!(validate_release_url("https://evil.example/releases").is_err());
        assert!(validate_ecosystem_url("https://github.com/BigPizzaV3/CodexPlusPlus").is_ok());
        assert!(validate_ecosystem_url("https://github.com/jlcodes99/cockpit-tools").is_ok());
        assert!(validate_ecosystem_url("https://github.com/farion1231/cc-switch").is_ok());
        assert!(validate_ecosystem_url("https://github.com/BytePioneer-AI/codex-host").is_ok());
        assert!(validate_ecosystem_url("https://evil.example/phish").is_err());
    }

    #[test]
    fn parse_sha256sums_extracts_matching_asset_hash() {
        let sample = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef  Ravenai_1.0.0_x64-setup.exe\n";
        assert_eq!(
            parse_sha256sums(sample, "Ravenai_1.0.0_x64-setup.exe").as_deref(),
            Some("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
        );
        assert!(parse_sha256sums(sample, "other.exe").is_none());
    }
}
