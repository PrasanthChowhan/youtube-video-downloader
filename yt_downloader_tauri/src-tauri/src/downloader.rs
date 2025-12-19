// src-tauri/src/downloader.rs
//! yt-dlp sidecar management using Tauri Shell plugin.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;
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
    // Clean URL: remove playlist parameters that can cause yt-dlp to hang
    let cleaned_url = clean_youtube_url(url);
    
    let command = app.shell().sidecar("yt-dlp")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .args([
            "--dump-json",
            "--no-download",
            "--no-warnings",
            "--no-playlist", // Ensure we don't process playlists
            &cleaned_url,
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
    concurrent_fragments: u8,
    use_throttle_protection: bool,
    use_aria2c: bool,
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
        // Use simpler progress template without underscore prefixes
        "--progress-template".to_string(), "download:%(progress.percent)s|%(progress.speed)s|%(progress.eta)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s".to_string(),
    ];
    
    // Add aria2c as external downloader if enabled
    if use_aria2c {
        args.push("--external-downloader".to_string());
        args.push("aria2c".to_string());
        args.push("--external-downloader-args".to_string());
        // Conservative aria2c settings to avoid triggering YouTube throttling
        // -x 4: max 4 connections per server (safer than 16)
        // -s 4: split into 4 parts
        // -k 1M: minimum split size 1MB
        // -c: continue partial downloads
        args.push("-x 4 -s 4 -k 1M -c".to_string());
    }
    
    // Add concurrent fragments for acceleration (only if not using aria2c)
    // aria2c handles splitting internally
    if concurrent_fragments > 1 && !use_aria2c {
        args.push("-N".to_string());
        args.push(concurrent_fragments.to_string());
    }
    
    // Add throttle protection if enabled (detects YouTube rate limiting)
    if use_throttle_protection {
        args.push("--throttled-rate".to_string());
        args.push("100K".to_string()); // If speed drops below 100KB/s, yt-dlp will detect throttling
    }
    
    args.push(url.to_string());

    eprintln!("yt-dlp args: {:?}", args);

    let command = app.shell().sidecar("yt-dlp")
        .map_err(|e| format!("Failed to create sidecar: {}", e))?
        .args(&args);
        
    let (mut rx, _) = command.spawn().map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    // Read events
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line_bytes) => {
                let line = String::from_utf8_lossy(&line_bytes);
                let line_str = line.trim();
                
                // Parse progress data - yt-dlp may output with or without "download:" prefix
                // Format: [download:]percent|speed|eta|downloaded_bytes|total_bytes
                let progress_data = if line_str.starts_with("download:") {
                    Some(&line_str[9..])
                } else if line_str.contains("|") && !line_str.starts_with("[") {
                    // Likely raw progress data without prefix
                    Some(line_str)
                } else {
                    None
                };
                
                if let Some(data) = progress_data {
                    let parts: Vec<&str> = data.split('|').collect();
                    if parts.len() >= 5 {
                        let downloaded: u64 = parts[3].parse().unwrap_or(0);
                        let total: Option<u64> = parts[4].parse().ok();
                        
                        // Calculate percent from bytes if yt-dlp returns "NA"
                        let percent_str = parts[0].trim().trim_end_matches('%');
                        let percent: f64 = if percent_str == "NA" || percent_str == "N/A" {
                            // Calculate from downloaded/total
                            if let Some(total_bytes) = total {
                                if total_bytes > 0 {
                                    (downloaded as f64 / total_bytes as f64) * 100.0
                                } else {
                                    0.0
                                }
                            } else {
                                0.0
                            }
                        } else {
                            percent_str.parse().unwrap_or(0.0)
                        };
                        
                        // Parse speed - might be in bytes/sec, convert to human readable
                        let speed_str = parts[1].trim();
                        let speed = if speed_str == "NA" || speed_str == "N/A" {
                            "".to_string()
                        } else {
                            // Try to parse as bytes/sec and convert to readable format
                            if let Ok(speed_bytes) = speed_str.parse::<f64>() {
                                format_speed(speed_bytes)
                            } else {
                                speed_str.to_string()
                            }
                        };
                        
                        // Parse ETA - might be in seconds, convert to readable format
                        let eta_str = parts[2].trim();
                        let eta = if eta_str == "NA" || eta_str == "N/A" {
                            "".to_string()
                        } else {
                            // Try to parse as seconds and convert to readable format
                            if let Ok(eta_secs) = eta_str.parse::<u64>() {
                                format_eta(eta_secs)
                            } else {
                                eta_str.to_string()
                            }
                        };
                        
                        on_progress(DownloadProgress {
                            status: "downloading".to_string(),
                            percent,
                            speed,
                            eta,
                            downloaded_bytes: downloaded,
                            total_bytes: total,
                            filename: None,
                        });
                    }
                }
                // Fallback: Parse standard yt-dlp progress output like "[download] 12.5% of 100.00MiB at 1.23MiB/s ETA 01:23"
                else if line_str.contains("[download]") && line_str.contains("%") {
                    // Extract percentage
                    if let Some(percent_pos) = line_str.find("%") {
                        if let Some(start) = line_str[..percent_pos].rfind(char::is_whitespace) {
                            let percent_str = &line_str[start+1..percent_pos];
                            if let Ok(percent) = percent_str.parse::<f64>() {
                                // Extract speed if available
                                let speed = if let Some(at_pos) = line_str.find(" at ") {
                                    if let Some(speed_end) = line_str[at_pos+4..].find(char::is_whitespace) {
                                        line_str[at_pos+4..at_pos+4+speed_end].to_string()
                                    } else {
                                        "".to_string()
                                    }
                                } else {
                                    "".to_string()
                                };
                                
                                // Extract ETA if available
                                let eta = if let Some(eta_pos) = line_str.find("ETA ") {
                                    line_str[eta_pos+4..].trim().to_string()
                                } else {
                                    "".to_string()
                                };
                                
                                on_progress(DownloadProgress {
                                    status: "downloading".to_string(),
                                    percent,
                                    speed,
                                    eta,
                                    downloaded_bytes: 0,
                                    total_bytes: None,
                                    filename: None,
                                });
                            }
                        }
                    }
                } 
                else if line_str.contains("[download] Destination:") {
                    let filename = line_str.split(":").last().unwrap_or("").trim().to_string();
                    on_progress(DownloadProgress {
                        status: "downloading".to_string(),
                        percent: 0.0,
                        speed: "".to_string(),
                        eta: "".to_string(),
                        downloaded_bytes: 0,
                        total_bytes: None,
                        filename: Some(filename),
                    });
                } else if line_str.contains("[Merger]") || line_str.contains("Merging") {
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
            CommandEvent::Stderr(line_bytes) => {
                // Silently ignore stderr to reduce noise
                let _line = String::from_utf8_lossy(&line_bytes);
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


/// Format duration in seconds to human-readable format
fn format_duration(secs: u64) -> String {
    let hours = secs / 3600;
    let minutes = (secs % 3600) / 60;
    let seconds = secs % 60;
    
    if hours > 0 {
        format!("{}h {}m {}s", hours, minutes, seconds)
    } else if minutes > 0 {
        format!("{}m {}s", minutes, seconds)
    } else {
        format!("{}s", seconds)
    }
}

/// Clean YouTube URL by removing playlist and other problematic parameters
/// This prevents yt-dlp from hanging on playlist URLs
fn clean_youtube_url(url: &str) -> String {
    // If it's a YouTube URL with query parameters
    if url.contains("youtube.com/watch?v=") || url.contains("youtu.be/") {
        // Extract just the video ID
        if let Some(v_pos) = url.find("v=") {
            let after_v = &url[v_pos + 2..];
            let video_id = after_v.split('&').next().unwrap_or(after_v);
            // Return clean URL with just the video ID
            return format!("https://www.youtube.com/watch?v={}", video_id);
        } else if url.contains("youtu.be/") {
            // Handle youtu.be short URLs
            if let Some(id_start) = url.find("youtu.be/") {
                let after_domain = &url[id_start + 9..];
                let video_id = after_domain.split('?').next().unwrap_or(after_domain);
                return format!("https://www.youtube.com/watch?v={}", video_id);
            }
        }
    }
    // Return original URL if not a YouTube URL or can't parse
    url.to_string()
}


/// Format speed in bytes/sec to human-readable string
fn format_speed(bytes_per_sec: f64) -> String {
    const UNITS: [&str; 6] = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s", "PB/s"];
    let mut size = bytes_per_sec;
    let mut unit_index = 0;
    
    while size >= 1000.0 && unit_index < UNITS.len() - 1 {
        size /= 1000.0;
        unit_index += 1;
    }
    
    format!("{:.2}{}", size, UNITS[unit_index])
}

/// Format ETA in seconds to MM:SS or HH:MM:SS format
fn format_eta(seconds: u64) -> String {
    let hours = seconds / 3600;
    let minutes = (seconds % 3600) / 60;
    let secs = seconds % 60;
    
    if hours > 0 {
        format!("{:02}:{:02}:{:02}", hours, minutes, secs)
    } else {
        format!("{:02}:{:02}", minutes, secs)
    }
}
