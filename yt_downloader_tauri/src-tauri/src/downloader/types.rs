//! Type definitions for the downloader module.

use serde::{Deserialize, Serialize};

/// Video information extracted from YouTube.
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

/// Download progress information.
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

impl Default for DownloadProgress {
    fn default() -> Self {
        Self {
            status: "starting".to_string(),
            percent: 0.0,
            speed: String::new(),
            eta: String::new(),
            downloaded_bytes: 0,
            total_bytes: None,
            filename: None,
        }
    }
}
