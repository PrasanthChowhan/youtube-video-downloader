// src-tauri/src/lib.rs
//! YouTube Downloader Tauri Application
//! 
//! This module provides Tauri command handlers for the frontend.

mod downloader;
mod settings;
mod acceleration_config;

use downloader::{fetch_video_info, get_download_dir, VideoInfo, DownloadProgress};
use settings::{load_settings, save_settings as save_settings_to_file, AppSettings};
use acceleration_config::AccelerationConfig;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

/// Response wrapper for commands
#[derive(Debug, Serialize, Deserialize)]
pub struct CommandResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> CommandResponse<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn err(error: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
        }
    }
}

/// Fetch video information from URL
#[tauri::command]
async fn get_video_info(app: AppHandle, url: String) -> CommandResponse<VideoInfo> {
    match fetch_video_info(&app, &url).await {
        Ok(info) => CommandResponse::ok(info),
        Err(e) => CommandResponse::err(e),
    }
}

/// Start downloading a video
#[tauri::command]
async fn start_download(
    app: AppHandle,
    url: String,
    output_path: Option<String>,
    filename_template: Option<String>,
) -> CommandResponse<String> {
    let output_dir = output_path
        .map(PathBuf::from)
        .unwrap_or_else(get_download_dir);
    
    // Default template if not provided
    let template = filename_template.unwrap_or_else(|| "%(uploader)s/%(title)s.%(ext)s".to_string());

    // Load acceleration config
    let accel_config = AccelerationConfig::load();
    
    // Get video info to determine file size for smart acceleration
    let filesize = match fetch_video_info(&app, &url).await {
        Ok(info) => info.filesize_approx,
        Err(_) => None,
    };
    
    // Determine if we should use acceleration based on config and file size
    let concurrent_fragments = if accel_config.should_accelerate(filesize) {
        accel_config.get_concurrent_fragments()
    } else {
        1 // No acceleration for small files
    };
    
    let use_throttle = accel_config.use_throttle_protection;

    let app_handle = Arc::new(app);
    let app_for_callback = Arc::clone(&app_handle);
    let app_for_download = Arc::clone(&app_handle);

    match downloader::download_video(
        &app_for_download, 
        &url, 
        output_dir, 
        &template, 
        concurrent_fragments,
        use_throttle,
        move |progress| {
            let _ = app_for_callback.emit("download-progress", progress);
        }
    ).await {
        Ok(msg) => CommandResponse::ok(msg),
        Err(e) => CommandResponse::err(e),
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
    match save_settings_to_file(&settings) {
        Ok(_) => CommandResponse::ok(()),
        Err(e) => CommandResponse::err(e),
    }
}

/// Get acceleration configuration
#[tauri::command]
fn get_acceleration_config() -> CommandResponse<AccelerationConfig> {
    CommandResponse::ok(AccelerationConfig::load())
}

/// Save acceleration configuration
#[tauri::command]
fn set_acceleration_config(config: AccelerationConfig) -> CommandResponse<()> {
    let mut validated_config = config;
    validated_config.validate();
    match validated_config.save() {
        Ok(_) => CommandResponse::ok(()),
        Err(e) => CommandResponse::err(e),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_video_info,
            start_download,
            get_default_download_path,
            get_settings,
            save_settings,
            get_acceleration_config,
            set_acceleration_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
