// src-tauri/src/settings.rs
//! Application settings management.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub download_path: String,
    pub filename_template: String,
    pub theme: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            download_path: get_default_download_dir().to_string_lossy().to_string(),
            filename_template: "%(uploader)s/%(title)s.%(ext)s".to_string(),
            theme: "dark".to_string(),
        }
    }
}

pub struct SettingsState(pub Mutex<AppSettings>);

fn get_settings_path() -> PathBuf {
    if let Some(config_dir) = dirs::config_local_dir() {
        let app_dir = config_dir.join("yt-downloader");
        let _ = fs::create_dir_all(&app_dir);
        app_dir.join("settings.json")
    } else {
        PathBuf::from("settings.json")
    }
}

fn get_default_download_dir() -> PathBuf {
    if let Some(download_dir) = dirs::download_dir() {
        download_dir.join("YouTube")
    } else if let Some(home_dir) = dirs::home_dir() {
        home_dir.join("Downloads").join("YouTube")
    } else {
        PathBuf::from(".")
    }
}

pub fn load_settings() -> AppSettings {
    let path = get_settings_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(settings) = serde_json::from_str(&content) {
                return settings;
            }
        }
    }
    AppSettings::default()
}

pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
    let path = get_settings_path();
    let content = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(path, content).map_err(|e| format!("Failed to write settings file: {}", e))?;

    Ok(())
}
