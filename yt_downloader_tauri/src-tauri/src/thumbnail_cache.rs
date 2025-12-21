//! Thumbnail caching module.
//!
//! Downloads and caches thumbnails locally to prevent CDN URL expiration issues.

use std::fs;
use std::path::PathBuf;

/// Get the thumbnail cache directory path.
fn get_cache_dir() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.videoget.app")
        .join("thumbnails");

    // Create directory if it doesn't exist
    let _ = fs::create_dir_all(&config_dir);
    config_dir
}

/// Cache a thumbnail by downloading it from a URL (blocking/sync version).
/// Returns the local file path if successful, or the original URL if caching fails.
pub fn cache_thumbnail_sync(url: &Option<String>, title: &str) -> Option<String> {
    let url_str = match url {
        Some(u) if !u.is_empty() => u,
        _ => return None,
    };

    if title.is_empty() {
        return Some(url_str.clone());
    }

    let cache_dir = get_cache_dir();

    // Determine file extension from URL (default to jpg)
    let ext = if url_str.contains(".png") {
        "png"
    } else if url_str.contains(".webp") {
        "webp"
    } else {
        "jpg"
    };

    // Clean title for filename (remove special chars, limit length)
    let safe_title: String = title
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join("_")
        .chars()
        .take(80)
        .collect();

    let filename = format!("{}.{}", safe_title, ext);
    let local_path = cache_dir.join(&filename);

    // If already cached, return the path
    if local_path.exists() {
        return Some(local_path.to_string_lossy().to_string());
    }

    // Download the thumbnail using blocking reqwest
    // Run in a blocking context since we're often called from sync code
    let result = std::thread::spawn({
        let url = url_str.clone();
        let path = local_path.clone();
        move || -> Option<String> {
            let client = reqwest::blocking::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .ok()?;

            let response = client.get(&url).send().ok()?;

            if response.status().is_success() {
                let bytes = response.bytes().ok()?;
                fs::write(&path, &bytes).ok()?;
                Some(path.to_string_lossy().to_string())
            } else {
                None
            }
        }
    })
    .join()
    .ok()
    .flatten();

    // Return cached path if successful, otherwise return original URL
    result.or_else(|| Some(url_str.clone()))
}

/// Clear all cached thumbnails
pub fn clear_cache() {
    let cache_dir = get_cache_dir();
    if cache_dir.exists() {
        // Delete all files in the thumbnails directory
        if let Ok(entries) = fs::read_dir(&cache_dir) {
            for entry in entries.flatten() {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
}

/// Delete a specific cached thumbnail by its path
pub fn delete_thumbnail(thumbnail_path: &Option<String>) {
    if let Some(path) = thumbnail_path {
        // Only delete if it's a local file (not a URL)
        if path.contains("com.videoget.app") || path.contains("thumbnails") {
            let _ = fs::remove_file(path);
        }
    }
}
