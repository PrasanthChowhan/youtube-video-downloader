//! Downloader module for YouTube video downloads.

pub mod formats;
pub mod types;
pub mod youtube;

pub use formats::{format_bytes, format_eta, format_speed};
pub use types::{DownloadProgress, VideoInfo};
pub use youtube::clean_youtube_url;

use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

/// Returns the default download directory.
pub fn get_download_dir() -> PathBuf {
    if let Some(download_dir) = dirs::download_dir() {
        download_dir.join("YouTube")
    } else if let Some(home_dir) = dirs::home_dir() {
        home_dir.join("Downloads").join("YouTube")
    } else {
        PathBuf::from(".")
    }
}

/// Fetches video information from a YouTube URL.
pub async fn fetch_video_info(app: &AppHandle, url: &str) -> Result<VideoInfo, String> {
    let cleaned_url = clean_youtube_url(url);

    let command = app
        .shell()
        .sidecar("yt-dlp")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .args(["--dump-json", "--no-download", "--no-warnings", "--no-playlist", &cleaned_url]);

    let output = command
        .output()
        .await
        .map_err(|e| format!("Failed to run yt-dlp sidecar: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp error: {}", stderr));
    }

    let json_str = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value =
        serde_json::from_str(&json_str).map_err(|e| format!("Failed to parse yt-dlp output: {}", e))?;

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

/// Downloads a video with progress updates.
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
    let (mut rx, _child) = download_video_with_child(
        app,
        url,
        output_dir,
        filename_template,
        concurrent_fragments,
        use_throttle_protection,
        use_aria2c,
    )
    .await?;

    use tauri_plugin_shell::process::CommandEvent;
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line_bytes) => {
                let line = String::from_utf8_lossy(&line_bytes);
                if let Some(progress) = parse_progress_line(&line) {
                    on_progress(progress);
                }
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
                            ..Default::default()
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

/// Downloads a video and returns the receiver and child process for external control.
pub async fn download_video_with_child(
    app: &AppHandle,
    url: &str,
    output_dir: PathBuf,
    filename_template: &str,
    concurrent_fragments: u8,
    use_throttle_protection: bool,
    use_aria2c: bool,
) -> Result<(tokio::sync::mpsc::Receiver<tauri_plugin_shell::process::CommandEvent>, tauri_plugin_shell::process::CommandChild), String> {
    std::fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Failed to create output directory: {}", e))?;

    let output_template = output_dir.join(filename_template).to_string_lossy().to_string();

    let mut args = vec![
        "-f".to_string(), "bestvideo[height<=2160]+bestaudio/best".to_string(),
        "--merge-output-format".to_string(), "mp4".to_string(),
        "-o".to_string(), output_template,
        "--newline".to_string(),
        "--progress-template".to_string(),
        "download:%(progress.percent)s|%(progress.speed)s|%(progress.eta)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s".to_string(),
    ];

    if use_aria2c {
        args.extend([
            "--external-downloader".to_string(), "aria2c".to_string(),
            "--external-downloader-args".to_string(), "-x 4 -s 4 -k 1M -c".to_string(),
        ]);
    }

    if concurrent_fragments > 1 && !use_aria2c {
        args.extend(["-N".to_string(), concurrent_fragments.to_string()]);
    }

    if use_throttle_protection {
        args.extend(["--throttled-rate".to_string(), "100K".to_string()]);
    }

    args.push(url.to_string());

    let command = app
        .shell()
        .sidecar("yt-dlp")
        .map_err(|e| format!("Failed to create sidecar: {}", e))?
        .args(&args);

    let (rx, child) = command.spawn().map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    Ok((rx, child))
}

/// Parse progress from yt-dlp output line
pub fn parse_progress_line(line: &str) -> Option<DownloadProgress> {
    let line = line.trim();
    
    let data = if line.starts_with("download:") {
        Some(&line[9..])
    } else if line.contains("|") && !line.starts_with("[") {
        Some(line)
    } else {
        None
    };

    if let Some(data) = data {
        let parts: Vec<&str> = data.split('|').collect();
        if parts.len() >= 5 {
            let downloaded: u64 = parts[3].parse().unwrap_or(0);
            let total: Option<u64> = parts[4].parse().ok();
            
            let percent_str = parts[0].trim().trim_end_matches('%');
            let percent: f64 = if percent_str == "NA" || percent_str == "N/A" {
                total.filter(|&t| t > 0).map(|t| (downloaded as f64 / t as f64) * 100.0).unwrap_or(0.0)
            } else {
                percent_str.parse().unwrap_or(0.0)
            };

            let speed_str = parts[1].trim();
            let speed = if speed_str == "NA" || speed_str == "N/A" {
                String::new()
            } else if let Ok(speed_bytes) = speed_str.parse::<f64>() {
                format_speed(speed_bytes)
            } else {
                speed_str.to_string()
            };

            let eta_str = parts[2].trim();
            let eta = if eta_str == "NA" || eta_str == "N/A" {
                String::new()
            } else if let Ok(eta_secs) = eta_str.parse::<u64>() {
                format_eta(eta_secs)
            } else {
                eta_str.to_string()
            };

            return Some(DownloadProgress {
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

    if line.contains("[Merger]") || line.contains("Merging") {
        return Some(DownloadProgress {
            status: "merging".to_string(),
            percent: 100.0,
            ..Default::default()
        });
    }

    None
}
