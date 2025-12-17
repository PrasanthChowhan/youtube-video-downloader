// src-tauri/src/downloader.rs
//! yt-dlp sidecar management for downloading YouTube videos.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;
use tauri::AppHandle;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

/// Video information extracted from YouTube
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoInfo {
    pub id: String,
    pub title: String,
    pub uploader: String,
    pub duration: u64,
    pub duration_string: String,
    pub thumbnail: Option<String>,
    pub view_count: Option<u64>,
    pub filesize_approx: Option<u64>,
    pub url: String,
}

/// Download progress information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub status: String,
    pub percent: f64,
    pub speed: String,
    pub eta: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub filename: Option<String>,
}

/// Get the path to the yt-dlp binary
pub fn get_ytdlp_path() -> PathBuf {
    #[cfg(target_os = "windows")]
    let binary_name = "yt-dlp.exe";
    #[cfg(not(target_os = "windows"))]
    let binary_name = "yt-dlp";

    // First check in app data directory
    if let Some(data_dir) = dirs::data_local_dir() {
        let app_dir = data_dir.join("yt-downloader");
        let binary_path = app_dir.join(binary_name);
        if binary_path.exists() {
            return binary_path;
        }
    }

    // Fall back to PATH
    PathBuf::from(binary_name)
}

/// Check if yt-dlp is installed
pub async fn is_ytdlp_installed() -> bool {
    let path = get_ytdlp_path();
    if path.exists() {
        return true;
    }
    
    // Check if it's in PATH
    Command::new("yt-dlp")
        .arg("--version")
        .output()
        .await
        .is_ok()
}

/// Get the download directory
pub fn get_download_dir() -> PathBuf {
    if let Some(download_dir) = dirs::download_dir() {
        download_dir.join("YouTube")
    } else if let Some(home_dir) = dirs::home_dir() {
        home_dir.join("Downloads").join("YouTube")
    } else {
        PathBuf::from(".")
    }
}

/// Fetch video information from a YouTube URL
pub async fn fetch_video_info(url: &str) -> Result<VideoInfo, String> {
    let ytdlp_path = get_ytdlp_path();
    
    let output = Command::new(&ytdlp_path)
        .args([
            "--dump-json",
            "--no-download",
            "--no-warnings",
            url,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run yt-dlp: {}. Is yt-dlp installed?", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp error: {}", stderr));
    }

    let json_str = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse yt-dlp output: {}", e))?;

    Ok(VideoInfo {
        id: json["id"].as_str().unwrap_or("").to_string(),
        title: json["title"].as_str().unwrap_or("Unknown").to_string(),
        uploader: json["uploader"].as_str().unwrap_or("Unknown").to_string(),
        duration: json["duration"].as_u64().unwrap_or(0),
        duration_string: json["duration_string"].as_str().unwrap_or("0:00").to_string(),
        thumbnail: json["thumbnail"].as_str().map(|s| s.to_string()),
        view_count: json["view_count"].as_u64(),
        filesize_approx: json["filesize_approx"].as_u64(),
        url: url.to_string(),
    })
}

/// Download a video with progress updates
pub async fn download_video<F>(
    url: &str,
    output_dir: PathBuf,
    on_progress: F,
) -> Result<String, String>
where
    F: Fn(DownloadProgress) + Send + 'static,
{
    let ytdlp_path = get_ytdlp_path();
    
    // Create output directory
    std::fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Failed to create output directory: {}", e))?;

    let output_template = output_dir
        .join("%(uploader)s")
        .join("%(title)s.%(ext)s")
        .to_string_lossy()
        .to_string();

    let mut child = Command::new(&ytdlp_path)
        .args([
            "-f", "bestvideo[height<=2160]+bestaudio/best",
            "--merge-output-format", "mp4",
            "-o", &output_template,
            "--newline",
            "--progress-template", "download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s",
            url,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start yt-dlp: {}", e))?;

    let stdout = child.stdout.take().expect("Failed to get stdout");
    let mut reader = BufReader::new(stdout).lines();

    // Read progress updates
    while let Ok(Some(line)) = reader.next_line().await {
        if line.starts_with("download:") {
            let parts: Vec<&str> = line[9..].split('|').collect();
            if parts.len() >= 5 {
                let percent_str = parts[0].trim().trim_end_matches('%');
                let percent: f64 = percent_str.parse().unwrap_or(0.0);
                
                let downloaded: u64 = parts[3].parse().unwrap_or(0);
                let total: Option<u64> = parts[4].parse().ok();
                
                on_progress(DownloadProgress {
                    status: "downloading".to_string(),
                    percent,
                    speed: parts[1].to_string(),
                    eta: parts[2].to_string(),
                    downloaded_bytes: downloaded,
                    total_bytes: total,
                    filename: None,
                });
            }
        } else if line.contains("[download] Destination:") {
            let filename = line.split(":").last().unwrap_or("").trim().to_string();
            on_progress(DownloadProgress {
                status: "downloading".to_string(),
                percent: 0.0,
                speed: "".to_string(),
                eta: "".to_string(),
                downloaded_bytes: 0,
                total_bytes: None,
                filename: Some(filename),
            });
        } else if line.contains("[Merger]") || line.contains("Merging") {
            on_progress(DownloadProgress {
                status: "merging".to_string(),
                percent: 100.0,
                speed: "".to_string(),
                eta: "".to_string(),
                downloaded_bytes: 0,
                total_bytes: None,
                filename: None,
            });
        }
    }

    let status = child.wait().await
        .map_err(|e| format!("yt-dlp process error: {}", e))?;

    if status.success() {
        on_progress(DownloadProgress {
            status: "finished".to_string(),
            percent: 100.0,
            speed: "".to_string(),
            eta: "".to_string(),
            downloaded_bytes: 0,
            total_bytes: None,
            filename: None,
        });
        Ok("Download completed successfully".to_string())
    } else {
        Err("Download failed".to_string())
    }
}

/// Format bytes to human-readable string
pub fn format_bytes(bytes: u64) -> String {
    const UNITS: [&str; 6] = ["B", "KB", "MB", "GB", "TB", "PB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;
    
    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }
    
    format!("{:.1} {}", size, UNITS[unit_index])
}
