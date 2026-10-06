// src-tauri/src/whisper.rs
//! Whisper model management and transcribing integration using whisper-cli (sidecar)

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use futures::StreamExt;

use crate::binary_downloader;

// HuggingFace base URL for whisper.cpp models
const WHISPER_MODEL_BASE_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WhisperModel {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub is_downloaded: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WhisperProgress {
    pub status: String,
    pub percent: f32,
    pub current_file: Option<String>,
    pub error: Option<String>,
}

/// Get the directory where Whisper models are stored
pub fn get_models_dir() -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        // Development mode
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
            .map_err(|e| format!("Failed to get manifest dir: {}", e))?;
        Ok(PathBuf::from(manifest_dir).join("models"))
    } else {
        // Production mode
        dirs::data_local_dir()
            .map(|d| d.join("com.prash.ytdownloader").join("models"))
            .ok_or_else(|| "Failed to get data directory".to_string())
    }
}

/// Returns all potential directories on the system where Whisper models might be stored
pub fn get_all_search_model_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if let Ok(default_dir) = get_models_dir() {
        dirs.push(default_dir);
    }

    if let Some(home) = dirs::home_dir() {
        dirs.push(home.join(".cache").join("openwhispr").join("whisper-models"));
        dirs.push(home.join(".cache").join("whisper"));
        dirs.push(home.join(".cache").join("huggingface").join("hub"));
    }

    if let Some(app_data) = dirs::data_local_dir() {
        dirs.push(app_data.join("OpenWhispr").join("models"));
        dirs.push(app_data.join("openwhispr").join("models"));
    }
    if let Some(config_dir) = dirs::config_dir() {
        dirs.push(config_dir.join("OpenWhispr").join("models"));
        dirs.push(config_dir.join("openwhispr").join("models"));
    }

    dirs
}

#[tauri::command]
pub fn get_available_models() -> Result<Vec<WhisperModel>, String> {
    let search_dirs = get_all_search_model_dirs();
    let default_dir = get_models_dir()?;

    if !default_dir.exists() {
        let _ = fs::create_dir_all(&default_dir);
    }

    let mut available_models = Vec::new();
    let supported_model_names = vec!["ggml-tiny.bin", "ggml-base.bin", "ggml-small.bin"];

    for model_name in supported_model_names {
        let mut found_path: Option<PathBuf> = None;
        for search_dir in &search_dirs {
            let candidate = search_dir.join(model_name);
            if candidate.exists() {
                found_path = Some(candidate);
                break;
            }
        }

        let (is_downloaded, path, size) = match found_path {
            Some(p) => {
                let size = std::fs::metadata(&p).map(|m| m.len()).unwrap_or(0);
                (true, p.to_string_lossy().to_string(), size)
            }
            None => {
                let p = default_dir.join(model_name);
                (false, p.to_string_lossy().to_string(), 0)
            }
        };

        available_models.push(WhisperModel {
            name: model_name.to_string(),
            path,
            size_bytes: size,
            is_downloaded,
        });
    }

    Ok(available_models)
}

#[tauri::command]
pub async fn download_whisper_model(
    app: AppHandle,
    model_name: String,
) -> Result<String, String> {
    let default_dir = get_models_dir()?;
    if !default_dir.exists() {
        fs::create_dir_all(&default_dir).map_err(|e| e.to_string())?;
    }

    let dest_path = default_dir.join(&model_name);
    let url = format!("{}{}", WHISPER_MODEL_BASE_URL, model_name);

    let _ = app.emit(
        "whisper-progress",
        WhisperProgress {
            status: "downloading_model".to_string(),
            percent: 0.0,
            current_file: Some(model_name.clone()),
            error: None,
        },
    );

    let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        return Err(format!("Failed to download model: HTTP {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0) as f64;
    let mut bytes_stream = response.bytes_stream();
    
    use std::io::Write;
    let mut file = fs::File::create(&dest_path).map_err(|e| e.to_string())?;
    
    let mut downloaded = 0f64;
    let mut last_percent = 0.0;

    while let Some(chunk_res) = bytes_stream.next().await {
        let chunk = chunk_res.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        
        downloaded += chunk.len() as f64;
        
        if total_size > 0.0 {
            let percent = (downloaded / total_size * 100.0) as f32;
            if percent - last_percent > 1.0 || percent == 100.0 {
                last_percent = percent;
                let _ = app.emit(
                    "whisper-progress",
                    WhisperProgress {
                        status: "downloading_model".to_string(),
                        percent,
                        current_file: Some(model_name.clone()),
                        error: None,
                    },
                );
            }
        }
    }

    let _ = app.emit(
        "whisper-progress",
        WhisperProgress {
            status: "model_downloaded".to_string(),
            percent: 100.0,
            current_file: Some(model_name.clone()),
            error: None,
        },
    );

    Ok(dest_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn import_custom_model(
    _app: AppHandle,
    file_path: String,
) -> Result<String, String> {
    let source = PathBuf::from(&file_path);
    if !source.exists() {
        return Err("Source file not found".to_string());
    }
    let default_dir = get_models_dir()?;
    if !default_dir.exists() {
        fs::create_dir_all(&default_dir).map_err(|e| e.to_string())?;
    }
    let filename = source.file_name().unwrap_or_default();
    let dest = default_dir.join(filename);
    fs::copy(&source, &dest).map_err(|e| format!("Failed to copy model: {}", e))?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn transcribe_file(
    app: AppHandle,
    input_path: String,
    model_name: String,
    language: Option<String>,
    export_json: Option<bool>,
    export_srt: Option<bool>,
) -> Result<String, String> {
    let input_file = PathBuf::from(&input_path);
    if !input_file.exists() {
        return Err(format!("Input file not found: {}", input_path));
    }

    // 0. Ensure whisper-cli is downloaded
    let _ = app.emit(
        "whisper-progress",
        WhisperProgress {
            status: "preparing_engine".to_string(),
            percent: 0.0,
            current_file: None,
            error: None,
        },
    );
    binary_downloader::ensure_whisper_cli().await?;
    let whisper_bin = binary_downloader::get_whisper_cli_path()?;

    // Search across system directories for the requested model
    let mut resolved_model_path: Option<PathBuf> = None;
    let search_dirs = get_all_search_model_dirs();
    
    for search_dir in &search_dirs {
        let candidate = search_dir.join(&model_name);
        if candidate.exists() {
            resolved_model_path = Some(candidate);
            break;
        }
    }

    let model_path = match resolved_model_path {
        Some(p) => p,
        None => {
            return Err(format!("Model {} not found. Please download it first.", model_name));
        }
    };

    let file_name = input_file
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let _ = app.emit(
        "whisper-progress",
        WhisperProgress {
            status: "extracting_audio".to_string(),
            percent: 0.0,
            current_file: Some(file_name.clone()),
            error: None,
        },
    );

    // 1. Extract audio to 16kHz WAV using FFmpeg
    let ffmpeg_bin = binary_downloader::get_ffmpeg_path()?;
    let temp_wav_path = std::env::temp_dir().join(format!("whisper_tmp_{}.wav", uuid::Uuid::new_v4()));

    let ffmpeg_cmd = tauri_plugin_shell::ShellExt::shell(&app)
        .command(ffmpeg_bin.to_string_lossy().to_string())
        .args([
            "-y",
            "-i",
            &input_path,
            "-ar",
            "16000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            &temp_wav_path.to_string_lossy().to_string(),
        ]);

    let ffmpeg_output = ffmpeg_cmd.output().await.map_err(|e| format!("Failed to run FFmpeg: {}", e))?;

    if !ffmpeg_output.status.success() {
        let stderr = String::from_utf8_lossy(&ffmpeg_output.stderr);
        let _ = fs::remove_file(&temp_wav_path);
        let err_msg = format!("FFmpeg audio extraction failed: {}", stderr);
        return Err(err_msg);
    }

    // 2. Notify UI: transcribing started
    let _ = app.emit(
        "whisper-progress",
        WhisperProgress {
            status: "transcribing".to_string(),
            percent: 0.0,
            current_file: Some(file_name.clone()),
            error: None,
        },
    );

    let parent_dir = input_file.parent().unwrap_or_else(|| Path::new("."));
    let stem = input_file.file_stem().unwrap_or_default().to_string_lossy().to_string();
    let output_base = parent_dir.join(&stem);

    let mut args = vec![
        "-m".to_string(),
        model_path.to_string_lossy().to_string(),
        "-f".to_string(),
        temp_wav_path.to_string_lossy().to_string(),
        "-of".to_string(),
        output_base.to_string_lossy().to_string(),
        "-otxt".to_string(),
    ];

    if let Some(ref lang) = language {
        if lang != "auto" && !lang.is_empty() {
            args.push("-l".to_string());
            args.push(lang.clone());
        }
    }

    if export_srt.unwrap_or(false) {
        args.push("-osrt".to_string());
    }

    if export_json.unwrap_or(false) {
        args.push("-oj".to_string());
    }

    // Execute whisper-cli
    let (mut rx, mut child) = tauri_plugin_shell::ShellExt::shell(&app)
        .command(whisper_bin.to_string_lossy().to_string())
        .args(args)
        .spawn()
        .map_err(|e| format!("Failed to spawn whisper-cli: {}", e))?;

    let app_progress = app.clone();
    let file_name_progress = file_name.clone();

    let mut exit_code = None;

    // Monitor stdout/stderr
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                let _ = app_progress.emit(
                    "whisper-progress",
                    WhisperProgress {
                        status: "transcribing".to_string(),
                        percent: 50.0, // Indeterminate progress
                        current_file: Some(file_name_progress.clone()),
                        error: None,
                    },
                );
            }
            CommandEvent::Terminated(payload) => {
                exit_code = payload.code;
            }
            CommandEvent::Error(err) => {
                let _ = fs::remove_file(&temp_wav_path);
                return Err(err);
            }
            _ => {}
        }
    }
    
    // Cleanup temp wav file
    let _ = fs::remove_file(&temp_wav_path);

    if exit_code != Some(0) {
        let err_msg = format!("Whisper CLI failed with exit code: {:?}", exit_code);
        let _ = app.emit(
            "whisper-progress",
            WhisperProgress {
                status: "failed".to_string(),
                percent: 0.0,
                current_file: Some(file_name.clone()),
                error: Some(err_msg.clone()),
            },
        );
        return Err(err_msg);
    }

    let _ = app.emit(
        "whisper-progress",
        WhisperProgress {
            status: "completed".to_string(),
            percent: 100.0,
            current_file: Some(file_name.clone()),
            error: None,
        },
    );

    Ok("Transcription completed successfully".to_string())
}