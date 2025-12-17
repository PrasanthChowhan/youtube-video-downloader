// src-tauri/src/updater.rs
//! Auto-update logic for yt-dlp binary.

use reqwest;
use std::path::PathBuf;
use tokio::fs;
use tokio::io::AsyncWriteExt;

/// yt-dlp release information
#[derive(Debug)]
pub struct ReleaseInfo {
    pub version: String,
    pub download_url: String,
}

/// Get the yt-dlp installation directory
fn get_ytdlp_install_dir() -> PathBuf {
    if let Some(data_dir) = dirs::data_local_dir() {
        data_dir.join("yt-downloader")
    } else {
        PathBuf::from(".")
    }
}

/// Get the yt-dlp binary path
pub fn get_ytdlp_binary_path() -> PathBuf {
    #[cfg(target_os = "windows")]
    let binary_name = "yt-dlp.exe";
    #[cfg(not(target_os = "windows"))]
    let binary_name = "yt-dlp";
    
    get_ytdlp_install_dir().join(binary_name)
}

/// Get the latest yt-dlp release info from GitHub
async fn get_latest_release() -> Result<ReleaseInfo, String> {
    let client = reqwest::Client::new();
    
    let response = client
        .get("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest")
        .header("User-Agent", "yt-downloader-tauri")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch release info: {}", e))?;

    let release: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse release info: {}", e))?;

    let version = release["tag_name"]
        .as_str()
        .unwrap_or("unknown")
        .to_string();

    // Find the appropriate binary for the platform
    #[cfg(target_os = "windows")]
    let asset_name = "yt-dlp.exe";
    #[cfg(target_os = "macos")]
    let asset_name = "yt-dlp_macos";
    #[cfg(target_os = "linux")]
    let asset_name = "yt-dlp";

    let assets = release["assets"].as_array()
        .ok_or("No assets found in release")?;

    let download_url = assets
        .iter()
        .find(|a| a["name"].as_str() == Some(asset_name))
        .and_then(|a| a["browser_download_url"].as_str())
        .ok_or(format!("Asset {} not found in release", asset_name))?
        .to_string();

    Ok(ReleaseInfo {
        version,
        download_url,
    })
}

/// Get the currently installed yt-dlp version
async fn get_installed_version() -> Option<String> {
    let binary_path = get_ytdlp_binary_path();
    
    if !binary_path.exists() {
        return None;
    }

    let output = tokio::process::Command::new(&binary_path)
        .arg("--version")
        .output()
        .await
        .ok()?;

    if output.status.success() {
        Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        None
    }
}

/// Download a file from URL
async fn download_file(url: &str, dest: &PathBuf) -> Result<(), String> {
    let client = reqwest::Client::new();
    
    let response = client
        .get(url)
        .header("User-Agent", "yt-downloader-tauri")
        .send()
        .await
        .map_err(|e| format!("Failed to download: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    // Create parent directory
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Write file
    let mut file = fs::File::create(dest)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    file.write_all(&bytes)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(dest).await
            .map_err(|e| format!("Failed to get metadata: {}", e))?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(dest, perms).await
            .map_err(|e| format!("Failed to set permissions: {}", e))?;
    }

    Ok(())
}

/// Check and update yt-dlp if necessary
pub async fn check_and_update() -> Result<String, String> {
    let binary_path = get_ytdlp_binary_path();
    
    // If binary doesn't exist, download it
    if !binary_path.exists() {
        println!("yt-dlp not found, downloading...");
        let release = get_latest_release().await?;
        download_file(&release.download_url, &binary_path).await?;
        return Ok(format!("Downloaded yt-dlp {}", release.version));
    }

    // Check if update is available
    let installed = get_installed_version().await;
    let latest = get_latest_release().await?;

    match installed {
        Some(ref installed_version) if installed_version == &latest.version => {
            Ok(format!("yt-dlp is up to date ({})", installed_version))
        }
        Some(installed_version) => {
            println!("Updating yt-dlp from {} to {}...", installed_version, latest.version);
            download_file(&latest.download_url, &binary_path).await?;
            Ok(format!("Updated yt-dlp from {} to {}", installed_version, latest.version))
        }
        None => {
            println!("Downloading yt-dlp {}...", latest.version);
            download_file(&latest.download_url, &binary_path).await?;
            Ok(format!("Downloaded yt-dlp {}", latest.version))
        }
    }
}

/// Ensure yt-dlp is available (download if missing)
pub async fn ensure_ytdlp() -> Result<PathBuf, String> {
    let binary_path = get_ytdlp_binary_path();
    
    if !binary_path.exists() {
        check_and_update().await?;
    }
    
    Ok(binary_path)
}
