//! Type definitions for the downloader module.

use serde::{Deserialize, Serialize};

/// Supported platforms for video downloads.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    YouTube,
    Instagram,
    Unknown,
}

impl Default for Platform {
    fn default() -> Self {
        Platform::Unknown
    }
}

impl std::fmt::Display for Platform {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Platform::YouTube => write!(f, "youtube"),
            Platform::Instagram => write!(f, "instagram"),
            Platform::Unknown => write!(f, "unknown"),
        }
    }
}

/// Detect platform from URL.
pub fn detect_platform(url: &str) -> Platform {
    let url_lower = url.to_lowercase();
    if url_lower.contains("youtube.com") || url_lower.contains("youtu.be") {
        Platform::YouTube
    } else if url_lower.contains("instagram.com") {
        Platform::Instagram
    } else {
        Platform::Unknown
    }
}

/// Video information extracted from a URL.
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
    pub platform: Platform,
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
