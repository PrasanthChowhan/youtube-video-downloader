//! Download history persistence module.
//!
//! Stores and retrieves download records from a JSON file.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Status of a download record
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DownloadStatus {
    Completed,
    Cancelled,
    Failed,
    FileNotFound,
}

/// A single download record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadRecord {
    pub id: String,
    pub url: String,
    pub title: String,
    pub uploader: String,
    pub thumbnail: Option<String>,
    pub file_path: Option<String>,
    pub file_size: Option<u64>,
    pub status: DownloadStatus,
    pub created_at: i64,
    pub completed_at: Option<i64>,
    #[serde(default = "default_platform")]
    pub platform: String,
}

fn default_platform() -> String {
    "youtube".to_string()
}

impl DownloadRecord {
    /// Create a new download record
    pub fn new(
        url: String,
        title: String,
        uploader: String,
        thumbnail: Option<String>,
        platform: String,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            url,
            title,
            uploader,
            thumbnail,
            file_path: None,
            file_size: None,
            status: DownloadStatus::Completed, // Will be set properly when completed
            created_at: chrono::Utc::now().timestamp(),
            completed_at: None,
            platform,
        }
    }
}

/// Container for all download history
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DownloadHistory {
    pub records: Vec<DownloadRecord>,
}

/// Get the path to the history file
fn get_history_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.videoget.app");

    fs::create_dir_all(&config_dir).ok();
    config_dir.join("download_history.json")
}

/// Load download history from disk
pub fn load_history() -> DownloadHistory {
    let path = get_history_path();

    if !path.exists() {
        return DownloadHistory::default();
    }

    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => DownloadHistory::default(),
    }
}

/// Save download history to disk
pub fn save_history(history: &DownloadHistory) -> Result<(), String> {
    let path = get_history_path();
    let content = serde_json::to_string_pretty(history)
        .map_err(|e| format!("Failed to serialize history: {}", e))?;

    fs::write(&path, content).map_err(|e| format!("Failed to write history file: {}", e))
}

/// Add a new record to history
pub fn add_record(record: DownloadRecord) -> Result<(), String> {
    let mut history = load_history();
    history.records.insert(0, record); // Most recent first
    save_history(&history)
}

/// Update an existing record by ID
pub fn update_record(id: &str, updater: impl FnOnce(&mut DownloadRecord)) -> Result<(), String> {
    let mut history = load_history();

    if let Some(record) = history.records.iter_mut().find(|r| r.id == id) {
        updater(record);
        save_history(&history)
    } else {
        Err(format!("Record not found: {}", id))
    }
}

/// Delete a record by ID
pub fn delete_record(id: &str) -> Result<(), String> {
    let mut history = load_history();
    let initial_len = history.records.len();
    history.records.retain(|r| r.id != id);

    if history.records.len() == initial_len {
        Err(format!("Record not found: {}", id))
    } else {
        save_history(&history)
    }
}

/// Clear all history
pub fn clear_all() -> Result<(), String> {
    save_history(&DownloadHistory::default())
}

/// Check if a file exists
pub fn check_file_exists(path: &str) -> bool {
    PathBuf::from(path).exists()
}
