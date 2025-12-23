//! Auto-update functionality using GitHub Releases API
//!
//! Simple update checker that compares current version with latest GitHub release.

use serde::{Deserialize, Serialize};

/// GitHub Release API response structure (subset of fields we need)
#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    html_url: String,
    body: Option<String>,
    published_at: String,
    assets: Vec<GitHubAsset>,
}

/// GitHub Asset structure
#[derive(Debug, Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

/// Update information returned to frontend
#[derive(Debug, Serialize, Clone)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub release_url: String,
    pub download_url: String,
    pub release_notes: String,
    pub published_at: String,
}

/// Parse a version string like "v1.2.3" or "1.2.3" into (major, minor, patch)
fn parse_version(version: &str) -> Option<(u32, u32, u32)> {
    let v = version.trim_start_matches('v');
    let parts: Vec<&str> = v.split('.').collect();
    
    if parts.len() >= 3 {
        let major = parts[0].parse().ok()?;
        let minor = parts[1].parse().ok()?;
        let patch = parts[2].split('-').next()?.parse().ok()?; // Handle "1.0.0-beta"
        Some((major, minor, patch))
    } else if parts.len() == 2 {
        let major = parts[0].parse().ok()?;
        let minor = parts[1].parse().ok()?;
        Some((major, minor, 0))
    } else {
        None
    }
}

/// Compare two versions, returns true if latest > current
fn is_newer_version(current: &str, latest: &str) -> bool {
    match (parse_version(current), parse_version(latest)) {
        (Some((c_maj, c_min, c_pat)), Some((l_maj, l_min, l_pat))) => {
            if l_maj > c_maj {
                return true;
            }
            if l_maj == c_maj && l_min > c_min {
                return true;
            }
            if l_maj == c_maj && l_min == c_min && l_pat > c_pat {
                return true;
            }
            false
        }
        _ => false, // If parsing fails, assume no update
    }
}

/// Get the appropriate download URL based on current OS
fn get_download_url_for_os(assets: &[GitHubAsset]) -> String {
    #[cfg(target_os = "windows")]
    {
        // Prefer .exe installer for Windows
        for asset in assets {
            if asset.name.ends_with("-setup.exe") || asset.name.ends_with("_x64-setup.exe") {
                return asset.browser_download_url.clone();
            }
        }
        // Fallback to .msi
        for asset in assets {
            if asset.name.ends_with(".msi") {
                return asset.browser_download_url.clone();
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        // Prefer .dmg for macOS
        for asset in assets {
            if asset.name.ends_with(".dmg") {
                return asset.browser_download_url.clone();
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Prefer .AppImage for Linux
        for asset in assets {
            if asset.name.ends_with(".AppImage") {
                return asset.browser_download_url.clone();
            }
        }
        // Fallback to .deb
        for asset in assets {
            if asset.name.ends_with(".deb") {
                return asset.browser_download_url.clone();
            }
        }
    }

    // If no OS-specific match, return empty string
    String::new()
}

/// Check for updates from GitHub releases
pub async fn check_for_updates() -> Result<UpdateInfo, String> {
    // Current version from Cargo.toml
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    
    // GitHub API endpoint for latest release
    let api_url = "https://api.github.com/repos/PrasanthChowhan/youtube-video-downloader/releases/latest";
    
    // Create HTTP client with required User-Agent header
    let client = reqwest::Client::builder()
        .user_agent("YT-Downloader-Update-Checker")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    // Fetch latest release info
    let response = client
        .get(api_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch release info: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("GitHub API returned status: {}", response.status()));
    }
    
    let release: GitHubRelease = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse release info: {}", e))?;
    
    // Extract version from tag (remove 'v' prefix if present)
    let latest_version = release.tag_name.trim_start_matches('v').to_string();
    
    // Check if update is available
    let update_available = is_newer_version(&current_version, &latest_version);
    
    // Get appropriate download URL for current OS
    let download_url = get_download_url_for_os(&release.assets);
    
    Ok(UpdateInfo {
        current_version,
        latest_version,
        update_available,
        release_url: release.html_url,
        download_url,
        release_notes: release.body.unwrap_or_default(),
        published_at: release.published_at,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_version() {
        assert_eq!(parse_version("1.0.0"), Some((1, 0, 0)));
        assert_eq!(parse_version("v1.2.3"), Some((1, 2, 3)));
        assert_eq!(parse_version("2.0.1-beta"), Some((2, 0, 1)));
        assert_eq!(parse_version("1.0"), Some((1, 0, 0)));
    }

    #[test]
    fn test_is_newer_version() {
        assert!(is_newer_version("1.0.0", "1.0.1"));
        assert!(is_newer_version("1.0.0", "1.1.0"));
        assert!(is_newer_version("1.0.0", "2.0.0"));
        assert!(!is_newer_version("1.0.0", "1.0.0"));
        assert!(!is_newer_version("2.0.0", "1.0.0"));
        assert!(is_newer_version("v1.0.0", "v1.0.1"));
    }
}
