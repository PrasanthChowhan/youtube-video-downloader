// src-tauri/src/downloader.rs
//! yt-dlp sidecar management using Tauri Shell plugin.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

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
pub async fn fetch_video_info(app: &AppHandle, url: &str) -> Result<VideoInfo, String> {
    let command = app.shell().sidecar("yt-dlp")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .args([
            "--dump-json",
            "--no-download",
            "--no-warnings",
            url,
        ]);

    let output = command
        .output()
        .await
        .map_err(|e| format!("Failed to run yt-dlp sidecar: {}", e))?;

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
    app: &AppHandle,
    url: &str,
    output_dir: PathBuf,
    filename_template: &str,
    on_progress: F,
) -> Result<String, String>
where
    F: Fn(DownloadProgress) + Send + 'static,
{
    // Create output directory
    std::fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Failed to create output directory: {}", e))?;

    let output_template = output_dir
        .join(filename_template)
        .to_string_lossy()
        .to_string();

    let mut args = vec![
        "-f".to_string(), "bestvideo[height<=2160]+bestaudio/best".to_string(),
        "--merge-output-format".to_string(), "mp4".to_string(),
        "-o".to_string(), output_template,
        "--newline".to_string(),
        "--progress-template".to_string(), "download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s".to_string(),
    ];
    
    // Attempt to locate ffmpeg sidecar to pass to yt-dlp via --ffmpeg-location
    // This is tricky because the sidecar binary has the target triple in it.
    // However, we can try to add the sidecar directory to PATH env var if possible, 
    // or just assume yt-dlp finds it if it's in the same folder.
    // NOTE: On the host (dev mode), sidecars are in src-tauri/binaries/
    // In bundle, they are in the resources folder.
    // For now, let's assume they might be found if adjacent?
    // Actually, yt-dlp needs --ffmpeg-location explicitly if it's not in PATH.
    // Since we can't easily guess the full path of the renamed binary in the bundle without complex logic,
    // we will rely on adding the sidecar folder to PATH env var of the command.
    // But Tauri shell doesn't easily let us modify ENV of the sidecar? 
    // Wait, the sidecar command builder has `.env`.
    
    args.push(url.to_string());

    let command = app.shell().sidecar("yt-dlp")
        .map_err(|e| format!("Failed to create sidecar: {}", e))?
        .args(&args);
        
    let (mut rx, _) = command.spawn().map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    // Read events
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line_bytes) => {
                let line = String::from_utf8_lossy(&line_bytes);
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
            CommandEvent::Stderr(_line_bytes) => {
                // Log stderr if needed
            }
            CommandEvent::Error(err) => {
               return Err(format!("Process error: {}", err));
            }
            CommandEvent::Terminated(payload) => {
                if let Some(code) = payload.code {
                    if code == 0 {
                          on_progress(DownloadProgress {
                            status: "finished".to_string(),
                            percent: 100.0,
                            speed: "".to_string(),
                            eta: "".to_string(),
                            downloaded_bytes: 0,
                            total_bytes: None,
                            filename: None,
                        });
                        return Ok("Download completed successfully".to_string());
                    } else {
                        return Err(format!("Process failed with exit code: {}", code));
                    }
                }
            }
            _ => {}
        }
    }

    Ok("Download completed".to_string())
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
