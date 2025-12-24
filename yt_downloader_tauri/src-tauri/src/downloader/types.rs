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

/// Download method to use based on URL type.
#[derive(Debug, Clone, PartialEq)]
pub enum DownloadMethod {
    /// Use yt-dlp with -N flag for video sites (YouTube, Instagram, TikTok, etc.)
    YtDlpNative,
    /// Use aria2c directly for direct file downloads (.mp4, .zip, etc.)
    Aria2cDirect,
}

/// Detect the optimal download method based on URL.
///
/// - Direct file URLs (.mp4, .zip, .exe) -> aria2c for max speed
/// - Video sites (YouTube, Instagram, TikTok) -> yt-dlp with -N flag
pub fn detect_download_method(url: &str) -> DownloadMethod {
    let url_lower = url.to_lowercase();

    // Known video sites that require yt-dlp for extraction
    let video_sites = [
        "youtube.com",
        "youtu.be",
        "instagram.com",
        "instagr.am",
        "tiktok.com",
        "twitter.com",
        "x.com",
        "facebook.com",
        "fb.watch",
        "vimeo.com",
        "twitch.tv",
        "dailymotion.com",
        "reddit.com",
        "bilibili.com",
        "nicovideo.jp",
        "soundcloud.com",
    ];

    // Check if it's a known video site
    for site in video_sites {
        if url_lower.contains(site) {
            return DownloadMethod::YtDlpNative;
        }
    }

    // Check for direct file extensions (likely direct downloads)
    let direct_extensions = [
        ".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", // Video
        ".mp3", ".m4a", ".wav", ".flac", ".ogg", // Audio
        ".zip", ".rar", ".7z", ".tar", ".gz", // Archives
        ".exe", ".msi", ".dmg", ".pkg", // Installers
        ".iso", ".img", // Disk images
        ".pdf", ".doc", ".docx", // Documents
    ];

    for ext in direct_extensions {
        // Check if URL ends with extension or has extension before query params
        if url_lower.ends_with(ext) || url_lower.contains(&format!("{ext}?")) {
            return DownloadMethod::Aria2cDirect;
        }
    }

    // Default: use yt-dlp as it supports 1000+ sites
    DownloadMethod::YtDlpNative
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
