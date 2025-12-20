//! YouTube Downloader Tauri Application
//!
//! Main module providing Tauri command handlers for the frontend.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod acceleration_config;
mod binary_downloader;
mod downloader;
mod response;
mod settings;

use acceleration_config::AccelerationConfig;
use downloader::{fetch_video_info, get_download_dir, DownloadProgress, VideoInfo};
use response::CommandResponse;
use settings::{load_settings, save_settings as save_settings_to_file, AppSettings};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_shell::process::CommandChild;
use std::sync::Mutex;

/// Global state to track active download process
pub struct DownloadState {
    pub active_child: Mutex<Option<(CommandChild, u32)>>, // (child, pid)
}

impl Default for DownloadState {
    fn default() -> Self {
        Self {
            active_child: Mutex::new(None),
        }
    }
}

/// Fetch video information from URL
#[tauri::command]
async fn get_video_info(app: AppHandle, url: String) -> CommandResponse<VideoInfo> {
    fetch_video_info(&app, &url).await.into()
}

/// Start downloading a video
#[tauri::command]
async fn start_download(
    app: AppHandle,
    state: State<'_, DownloadState>,
    url: String,
    output_path: Option<String>,
    filename_template: Option<String>,
) -> Result<String, String> {
    let output_dir = output_path
        .map(PathBuf::from)
        .unwrap_or_else(get_download_dir);

    let template =
        filename_template.unwrap_or_else(|| "%(uploader)s/%(title)s.%(ext)s".to_string());

    let accel_config = AccelerationConfig::load();

    let filesize = match fetch_video_info(&app, &url).await {
        Ok(info) => info.filesize_approx,
        Err(_) => None,
    };

    let (concurrent_fragments, aria2_split_size) = accel_config.get_optimized_params(filesize);

    let use_throttle = accel_config.use_throttle_protection;
    let use_aria2c = accel_config.use_aria2c;

    // Spawn the download process
    let (mut rx, child) = downloader::download_video_with_child(
        &app,
        &url,
        output_dir,
        &template,
        concurrent_fragments,
        use_throttle,
        use_aria2c,
        Some(aria2_split_size),
    )
    .await?;

    // Get the PID for process tree killing
    let pid = child.pid();

    // Store child and PID in state for cancellation
    {
        let mut guard = state.active_child.lock().unwrap();
        *guard = Some((child, pid));
    }

    let app_handle = Arc::new(app);
    
    // Process events
    use tauri_plugin_shell::process::CommandEvent;
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line_bytes) => {
                let line = String::from_utf8_lossy(&line_bytes);
                if let Some(progress) = downloader::parse_progress_line(&line) {
                    let _ = app_handle.emit("download-progress", progress);
                }
            }
            CommandEvent::Error(err) => {
                // Clear state
                let mut guard = state.active_child.lock().unwrap();
                *guard = None;
                return Err(format!("Process error: {}", err));
            }
            CommandEvent::Terminated(payload) => {
                // Clear state
                let mut guard = state.active_child.lock().unwrap();
                *guard = None;

                if let Some(code) = payload.code {
                    if code == 0 {
                        let _ = app_handle.emit(
                            "download-progress",
                            DownloadProgress {
                                status: "finished".to_string(),
                                percent: 100.0,
                                ..Default::default()
                            },
                        );
                        return Ok("Download completed successfully".to_string());
                    } else {
                        // Check if cancelled
                        return Err(format!("Download stopped (code: {})", code));
                    }
                }
            }
            _ => {}
        }
    }

    // Clear state
    let mut guard = state.active_child.lock().unwrap();
    *guard = None;
    Ok("Download completed".to_string())
}

/// Cancel the active download - kills entire process tree
#[tauri::command]
fn cancel_download(
    app: AppHandle,
    state: State<'_, DownloadState>,
) -> Result<String, String> {
    let mut guard = state.active_child.lock().unwrap();
    
    if let Some((child, pid)) = guard.take() {
        // First try to kill the process tree using platform-specific methods
        let tree_killed = kill_process_tree(pid);
        
        // Also try the regular kill as backup
        let _ = child.kill();
        
        // Emit cancelled status
        let _ = app.emit(
            "download-progress",
            DownloadProgress {
                status: "cancelled".to_string(),
                percent: 0.0,
                ..Default::default()
            },
        );
        
        if tree_killed {
            Ok("Download cancelled".to_string())
        } else {
            Ok("Download cancelled (partial)".to_string())
        }
    } else {
        Ok("No active download".to_string())
    }
}

/// Kill entire process tree (cross-platform)
fn kill_process_tree(pid: u32) -> bool {
    #[cfg(target_os = "windows")]
    {
        // On Windows, use taskkill with /T flag to kill process tree
        use std::process::Command;
        let result = Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .output();
        match result {
            Ok(output) => output.status.success(),
            Err(e) => {
                eprintln!("Failed to run taskkill: {}", e);
                false
            }
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        // On Unix, send SIGKILL to process group
        use std::process::Command;
        // Try to kill the process group
        let result = Command::new("kill")
            .args(["-9", &format!("-{}", pid)]) // Negative PID kills process group
            .output();
        if result.is_ok() && result.unwrap().status.success() {
            return true;
        }
        // Fallback: just kill the process
        let result = Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output();
        match result {
            Ok(output) => output.status.success(),
            Err(_) => false,
        }
    }
}

/// Get the default download directory
#[tauri::command]
fn get_default_download_path() -> String {
    get_download_dir().to_string_lossy().to_string()
}

/// Load application settings
#[tauri::command]
fn get_settings() -> CommandResponse<AppSettings> {
    CommandResponse::ok(load_settings())
}

/// Save application settings
#[tauri::command]
fn save_settings(settings: AppSettings) -> CommandResponse<()> {
    save_settings_to_file(&settings).into()
}

/// Get acceleration configuration
#[tauri::command]
fn get_acceleration_config() -> CommandResponse<AccelerationConfig> {
    CommandResponse::ok(AccelerationConfig::load())
}

/// Save acceleration configuration
#[tauri::command]
async fn set_acceleration_config(config: AccelerationConfig) -> CommandResponse<()> {
    config.save().into()
}

/// Ensure aria2c binary is available
pub async fn ensure_aria2c_available() -> Result<(), String> {
    binary_downloader::ensure_aria2c().await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .manage(DownloadState::default())
        .setup(|_app| {
            tauri::async_runtime::spawn(async move {
                if let Err(e) = ensure_aria2c_available().await {
                    eprintln!("Failed to ensure aria2c is available: {}", e);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_video_info,
            start_download,
            cancel_download,
            get_default_download_path,
            get_settings,
            save_settings,
            get_acceleration_config,
            set_acceleration_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
