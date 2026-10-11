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
/// Searches application bundle, sibling directories, local app data, and system PATH.
pub fn get_ffmpeg_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    let candidate_names = ["ffmpeg.exe", "ffmpeg-x86_64-pc-windows-msvc.exe", "ffmpeg"];

    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    let candidate_names = ["ffmpeg", "ffmpeg-aarch64-apple-darwin"];

    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    let candidate_names = ["ffmpeg", "ffmpeg-x86_64-apple-darwin"];

    #[cfg(target_os = "linux")]
    let candidate_names = ["ffmpeg", "ffmpeg-x86_64-unknown-linux-gnu"];

    let mut search_dirs: Vec<PathBuf> = Vec::new();

    // 1. Executable directory and its subdirectories (installed production app)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            search_dirs.push(exe_dir.to_path_buf());
            search_dirs.push(exe_dir.join("binaries"));
            search_dirs.push(exe_dir.join("../Resources"));
            search_dirs.push(exe_dir.join("../Resources/binaries"));
        }
    }

    // 2. Local app data directory
    if let Ok(bin_dir) = get_binary_dir() {
        search_dirs.push(bin_dir.clone());
        if let Some(parent) = bin_dir.parent() {
            search_dirs.push(parent.to_path_buf());
        }
    }
    if let Some(local_data) = dirs::data_local_dir() {
        search_dirs.push(local_data.join("com.prash.ytdownloader").join("binaries"));
        search_dirs.push(local_data.join("YT Downloader"));
    }

    // 3. Dev environment (CARGO_MANIFEST_DIR/binaries)
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        search_dirs.push(PathBuf::from(manifest_dir).join("binaries"));
    }

    // Check all search directories for candidate binary names
    for dir in &search_dirs {
        for name in &candidate_names {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Ok(candidate);
            }
        }
    }

    // 4. System PATH
    if let Some(path_var) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path_var) {
            for name in &candidate_names {
                let candidate = dir.join(name);
                if candidate.is_file() {
                    return Ok(candidate);
                }
            }
        }
    }

    Err("FFmpeg binary not found in application bundle, local data directory, or system PATH".to_string())
}

/// Check if ffmpeg is available
pub fn is_ffmpeg_installed() -> bool {
    get_ffmpeg_path().is_ok()
}

#[cfg(target_os = "windows")]
const FFMPEG_URL: &str = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";

/// Download and extract ffmpeg binary if missing
pub async fn download_ffmpeg() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        eprintln!("Downloading FFmpeg fallback...");
        let bin_dir = get_binary_dir()?;
        fs::create_dir_all(&bin_dir)
            .map_err(|e| format!("Failed to create binaries directory: {}", e))?;

        let response = reqwest::get(FFMPEG_URL)
            .await
            .map_err(|e| format!("Failed to download FFmpeg: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Failed to download FFmpeg: HTTP {}", response.status()));
        }

        let zip_bytes = response
            .bytes()
            .await
            .map_err(|e| format!("Failed to read FFmpeg download: {}", e))?;

        extract_ffmpeg_from_zip(&zip_bytes, &bin_dir)?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("FFmpeg auto-download is not available on this platform. Please install FFmpeg via system package manager.".to_string())
    }
}

#[cfg(target_os = "windows")]
fn extract_ffmpeg_from_zip(zip_bytes: &[u8], bin_dir: &PathBuf) -> Result<(), String> {
    use std::io::{Cursor, Read};
    use zip::ZipArchive;

    let reader = Cursor::new(zip_bytes);
    let mut archive =
        ZipArchive::new(reader).map_err(|e| format!("Failed to open FFmpeg ZIP: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read ZIP entry: {}", e))?;

        if file.name().ends_with("ffmpeg.exe") {
            let mut contents = Vec::new();
            file.read_to_end(&mut contents)
                .map_err(|e| format!("Failed to read ffmpeg.exe from ZIP: {}", e))?;

            let plain_path = bin_dir.join("ffmpeg.exe");
            fs::write(&plain_path, &contents)
                .map_err(|e| format!("Failed to write ffmpeg.exe: {}", e))?;

            let triple_path = bin_dir.join("ffmpeg-x86_64-pc-windows-msvc.exe");
            let _ = fs::write(&triple_path, &contents);

            eprintln!("FFmpeg downloaded and extracted successfully to {:?}", plain_path);
            return Ok(());
        }
    }

    Err("ffmpeg.exe not found in downloaded ZIP archive".to_string())
}

/// Ensure ffmpeg is available (download fallback if missing)
pub async fn ensure_ffmpeg() -> Result<(), String> {
    if is_ffmpeg_installed() {
        eprintln!("FFmpeg is already available");
        Ok(())
    } else {
        eprintln!("FFmpeg not found, initiating fallback download...");
        download_ffmpeg().await
    }
}

const WHISPER_CLI_VERSION: &str = "1.6.0";
#[cfg(target_os = "windows")]
const WHISPER_CLI_URL: &str = "https://github.com/ggml-org/whisper.cpp/releases/download/v1.6.0/whisper-cublas-12.2.0-bin-x64.zip";
#[cfg(not(target_os = "windows"))]
const WHISPER_CLI_URL: &str = "https://github.com/ggml-org/whisper.cpp/releases/download/v1.6.0/whisper-bin-x64.zip";

/// Get the path to whisper CLI binary
pub fn get_whisper_cli_path() -> Result<PathBuf, String> {
    let bin_dir = get_binary_dir()?;

    #[cfg(target_os = "windows")]
    let candidate_names = ["whisper-cli-x86_64-pc-windows-msvc.exe", "whisper-cli.exe"];

    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    let candidate_names = ["whisper-cli-aarch64-apple-darwin", "whisper-cli"];

    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    let candidate_names = ["whisper-cli-x86_64-apple-darwin", "whisper-cli"];

    #[cfg(target_os = "linux")]
    let candidate_names = ["whisper-cli-x86_64-unknown-linux-gnu", "whisper-cli"];

    let mut search_dirs: Vec<PathBuf> = Vec::new();

    // 1. Check local app data bin_dir
    search_dirs.push(bin_dir.clone());

    // 2. Check executable directory
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            search_dirs.push(exe_dir.to_path_buf());
            search_dirs.push(exe_dir.join("binaries"));
            search_dirs.push(exe_dir.join("../Resources"));
        }
    }

    // 3. Dev environment
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        search_dirs.push(PathBuf::from(manifest_dir).join("binaries"));
    }

    for dir in &search_dirs {
        for name in &candidate_names {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Ok(candidate);
            }
        }
    }

    // Return target location for fresh downloads
    Ok(bin_dir.join(candidate_names[0]))
}

/// Check if whisper CLI is installed (and check for CUDA DLLs on Windows)
pub fn is_whisper_cli_installed() -> bool {
    match get_whisper_cli_path() {
        Ok(path) => {
            if !path.exists() {
                return false;
            }
            #[cfg(target_os = "windows")]
            {
                if let Some(parent) = path.parent() {
                    let cuda_dll = parent.join("cublas64_12.dll");
                    if !cuda_dll.exists() {
                        return false; // Force re-download to upgrade to cuBLAS GPU build
                    }
                }
            }
            true
        }
        Err(_) => false,
    }
}

/// Download and extract whisper-cli binary
pub async fn download_whisper_cli() -> Result<(), String> {
    eprintln!("Downloading whisper-cli v{}...", WHISPER_CLI_VERSION);

    let binary_path = get_whisper_cli_path()?;
    let bin_dir = binary_path
        .parent()
        .ok_or("Failed to get binary directory")?;

    fs::create_dir_all(bin_dir)
        .map_err(|e| format!("Failed to create binaries directory: {}", e))?;

    let response = reqwest::get(WHISPER_CLI_URL)
        .await
        .map_err(|e| format!("Failed to download whisper-cli: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to download whisper-cli: HTTP {}",
            response.status()
        ));
    }

    let zip_bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read whisper-cli download: {}", e))?;

    extract_whisper_cli_from_zip(&zip_bytes, &binary_path, bin_dir)?;

    eprintln!(
        "whisper-cli v{} downloaded successfully to {:?}",
        WHISPER_CLI_VERSION, binary_path
    );
    Ok(())
}

/// Extract whisper main executable and dependencies from ZIP
fn extract_whisper_cli_from_zip(
    zip_bytes: &[u8],
    target_path: &PathBuf,
    bin_dir: &std::path::Path,
) -> Result<(), String> {
    use std::io::{Cursor, Read};
    use zip::ZipArchive;

    let reader = Cursor::new(zip_bytes);
    let mut archive =
        ZipArchive::new(reader).map_err(|e| format!("Failed to open ZIP archive: {}", e))?;

    let mut main_found = false;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read ZIP entry: {}", e))?;

        let file_name = file.name().to_string();
        if file_name.ends_with("main.exe") || file_name.ends_with("whisper-cli.exe") || file_name.ends_with("whisper-cli") {
            let mut contents = Vec::new();
            file.read_to_end(&mut contents)
                .map_err(|e| format!("Failed to read main binary from ZIP: {}", e))?;

            fs::write(target_path, contents)
                .map_err(|e| format!("Failed to write whisper binary: {}", e))?;

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

            main_found = true;
        } else if file_name.ends_with(".dll") {
            if let Some(name) = std::path::Path::new(&file_name).file_name() {
                let dest = bin_dir.join(name);
                let mut contents = Vec::new();
                file.read_to_end(&mut contents)
                    .map_err(|e| format!("Failed to read DLL from ZIP: {}", e))?;
                let _ = fs::write(dest, contents);
            }
        }
    }

    if main_found {
        Ok(())
    } else {
        Err("whisper binary executable not found in ZIP archive".to_string())
    }
}

/// Ensure whisper-cli is available (download if missing)
pub async fn ensure_whisper_cli() -> Result<(), String> {
    if is_whisper_cli_installed() {
        eprintln!("whisper-cli is already installed");
        Ok(())
    } else {
        eprintln!("whisper-cli not found, downloading...");
        download_whisper_cli().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ffmpeg_path_resolution() {
        let ffmpeg_res = get_ffmpeg_path();
        println!("Resolved ffmpeg path: {:?}", ffmpeg_res);
        assert!(ffmpeg_res.is_ok(), "Expected FFmpeg to be discovered, got: {:?}", ffmpeg_res);
        let path = ffmpeg_res.unwrap();
        assert!(path.exists(), "Discovered path does not exist on disk: {:?}", path);
    }

    #[test]
    fn test_is_ffmpeg_installed() {
        assert!(is_ffmpeg_installed(), "is_ffmpeg_installed() should return true");
    }
}

