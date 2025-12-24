// src-tauri/src/binary_downloader.rs
//! Auto-download binary dependencies (aria2c, yt-dlp, ffmpeg)

use reqwest;
use std::fs;
use std::path::PathBuf;

const ARIA2C_VERSION: &str = "1.37.0";
const ARIA2C_URL: &str = "https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-win-64bit-build1.zip";

/// Get the sidecar binary directory
fn get_binary_dir() -> Result<PathBuf, String> {
    // In dev mode, binaries are in src-tauri/binaries/
    // In production, they're in the resources folder
    if cfg!(debug_assertions) {
        // Development mode
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
            .map_err(|e| format!("Failed to get manifest dir: {}", e))?;
        Ok(PathBuf::from(manifest_dir).join("binaries"))
    } else {
        // Production mode - binaries are bundled
        dirs::data_local_dir()
            .map(|d| d.join("com.prash.ytdownloader").join("binaries"))
            .ok_or_else(|| "Failed to get data directory".to_string())
    }
}

/// Get the expected path for aria2c binary
pub fn get_aria2c_path() -> Result<PathBuf, String> {
    let bin_dir = get_binary_dir()?;

    #[cfg(target_os = "windows")]
    let binary_name = "aria2c-x86_64-pc-windows-msvc.exe";

    #[cfg(target_os = "macos")]
    let binary_name = "aria2c-x86_64-apple-darwin";

    #[cfg(target_os = "linux")]
    let binary_name = "aria2c-x86_64-unknown-linux-gnu";

    Ok(bin_dir.join(binary_name))
}

/// Check if aria2c is already installed
pub fn is_aria2c_installed() -> bool {
    match get_aria2c_path() {
        Ok(path) => path.exists(),
        Err(_) => false,
    }
}

/// Download and extract aria2c binary
pub async fn download_aria2c() -> Result<(), String> {
    eprintln!("Downloading aria2c v{}...", ARIA2C_VERSION);

    let binary_path = get_aria2c_path()?;
    let bin_dir = binary_path
        .parent()
        .ok_or("Failed to get binary directory")?;

    // Create binaries directory if it doesn't exist
    fs::create_dir_all(bin_dir)
        .map_err(|e| format!("Failed to create binaries directory: {}", e))?;

    // Download the ZIP file
    let response = reqwest::get(ARIA2C_URL)
        .await
        .map_err(|e| format!("Failed to download aria2c: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to download aria2c: HTTP {}",
            response.status()
        ));
    }

    let zip_bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read aria2c download: {}", e))?;

    // Extract aria2c.exe from the ZIP
    extract_aria2c_from_zip(&zip_bytes, &binary_path)?;

    eprintln!(
        "aria2c v{} downloaded successfully to {:?}",
        ARIA2C_VERSION, binary_path
    );
    Ok(())
}

/// Extract aria2c.exe from the downloaded ZIP file
fn extract_aria2c_from_zip(zip_bytes: &[u8], target_path: &PathBuf) -> Result<(), String> {
    use std::io::{Cursor, Read};
    use zip::ZipArchive;

    let reader = Cursor::new(zip_bytes);
    let mut archive =
        ZipArchive::new(reader).map_err(|e| format!("Failed to open ZIP archive: {}", e))?;

    // Find aria2c.exe in the archive
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read ZIP entry: {}", e))?;

        if file.name().ends_with("aria2c.exe") {
            let mut contents = Vec::new();
            file.read_to_end(&mut contents)
                .map_err(|e| format!("Failed to read aria2c.exe from ZIP: {}", e))?;

            fs::write(target_path, contents)
                .map_err(|e| format!("Failed to write aria2c binary: {}", e))?;

            // Make executable on Unix-like systems
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = fs::metadata(target_path)
                    .map_err(|e| format!("Failed to get file metadata: {}", e))?
                    .permissions();
                perms.set_mode(0o755);
                fs::set_permissions(target_path, perms)
                    .map_err(|e| format!("Failed to set executable permissions: {}", e))?;
            }

            return Ok(());
        }
    }

    Err("aria2c.exe not found in ZIP archive".to_string())
}

/// Ensure aria2c is available (download if missing)
pub async fn ensure_aria2c() -> Result<(), String> {
    if is_aria2c_installed() {
        eprintln!("aria2c is already installed");
        Ok(())
    } else {
        eprintln!("aria2c not found, downloading...");
        download_aria2c().await
    }
}

/// Get the path to ffmpeg binary
/// In production, this is the bundled sidecar. In dev, it's in the binaries folder.
pub fn get_ffmpeg_path() -> Result<PathBuf, String> {
    let bin_dir = get_binary_dir()?;

    #[cfg(target_os = "windows")]
    let binary_name = "ffmpeg-x86_64-pc-windows-msvc.exe";

    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    let binary_name = "ffmpeg-aarch64-apple-darwin";

    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    let binary_name = "ffmpeg-x86_64-apple-darwin";

    #[cfg(target_os = "linux")]
    let binary_name = "ffmpeg-x86_64-unknown-linux-gnu";

    let path = bin_dir.join(binary_name);
    
    // Also check if it exists in the same directory as the executable (for bundled apps)
    if !path.exists() {
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                // Check in Resources folder (macOS app bundle)
                let resources_path = exe_dir.join("../Resources").join(binary_name);
                if resources_path.exists() {
                    return Ok(resources_path);
                }
                // Check directly next to executable
                let sibling_path = exe_dir.join(binary_name);
                if sibling_path.exists() {
                    return Ok(sibling_path);
                }
            }
        }
    }

    Ok(path)
}
