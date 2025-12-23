//! YouTube Downloader Tauri Application
//!
//! Main module providing Tauri command handlers for the frontend.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod acceleration_config;
mod binary_downloader;
mod download_history;
mod download_manager;
mod download_queue;
mod downloader;
mod response;
mod settings;
mod thumbnail_cache;
mod updater;

use acceleration_config::AccelerationConfig;
use download_history::{DownloadHistory, DownloadRecord, DownloadStatus as HistoryStatus};
use download_manager::{DownloadManager, DownloadHandle, DownloadStatus, ItemProgress, QueueItem as ManagerQueueItem};
use download_queue::{DownloadQueue, QueueItem, QueueStatus};
use downloader::{fetch_video_info, get_download_dir, DownloadProgress, VideoInfo};
use response::CommandResponse;
use settings::{load_settings, save_settings as save_settings_to_file, AppSettings};
use updater::UpdateInfo;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shell::process::CommandChild;
use std::sync::Mutex;
use tokio::sync::mpsc;

/// Global state to track active download process
pub struct DownloadState {
    pub active_child: Mutex<Option<(CommandChild, u32)>>, // (child, pid)
}

impl Default for DownloadState {
    fn default() -> Self {
        Self {
            active_child: Mutex::new(None),
        }
    }
}

/// Fetch video information from URL
#[tauri::command]
async fn get_video_info(app: AppHandle, url: String) -> CommandResponse<VideoInfo> {
    fetch_video_info(&app, &url).await.into()
}

/// Start downloading a video
#[tauri::command]
async fn start_download(
    app: AppHandle,
    state: State<'_, DownloadState>,
    url: String,
    output_path: Option<String>,
    filename_template: Option<String>,
) -> Result<String, String> {
    let output_dir = output_path
        .map(PathBuf::from)
        .unwrap_or_else(get_download_dir);

    let template =
        filename_template.unwrap_or_else(|| "%(uploader)s/%(title)s.%(ext)s".to_string());

    let accel_config = AccelerationConfig::load();

    let filesize = match fetch_video_info(&app, &url).await {
        Ok(info) => info.filesize_approx,
        Err(_) => None,
    };

    let (concurrent_fragments, aria2_split_size) = accel_config.get_optimized_params(filesize);

    let use_throttle = accel_config.use_throttle_protection;
    let use_aria2c = accel_config.use_aria2c;

    // Spawn the download process
    let (mut rx, child) = downloader::download_video_with_child(
        &app,
        &url,
        output_dir,
        &template,
        concurrent_fragments,
        use_throttle,
        use_aria2c,
        Some(aria2_split_size),
    )
    .await?;

    // Get the PID for process tree killing
    let pid = child.pid();

    // Store child and PID in state for cancellation
    {
        let mut guard = state.active_child.lock().unwrap();
        *guard = Some((child, pid));
    }

    let app_handle = Arc::new(app);
    
    // Process events
    use tauri_plugin_shell::process::CommandEvent;
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line_bytes) => {
                let line = String::from_utf8_lossy(&line_bytes);
                if let Some(progress) = downloader::parse_progress_line(&line) {
                    let _ = app_handle.emit("download-progress", progress);
                }
            }
            CommandEvent::Error(err) => {
                // Clear state
                let mut guard = state.active_child.lock().unwrap();
                *guard = None;
                return Err(format!("Process error: {}", err));
            }
            CommandEvent::Terminated(payload) => {
                // Clear state
                let mut guard = state.active_child.lock().unwrap();
                *guard = None;

                if let Some(code) = payload.code {
                    if code == 0 {
                        let _ = app_handle.emit(
                            "download-progress",
                            DownloadProgress {
                                status: "finished".to_string(),
                                percent: 100.0,
                                ..Default::default()
                            },
                        );
                        return Ok("Download completed successfully".to_string());
                    } else {
                        // Check if cancelled
                        return Err(format!("Download stopped (code: {})", code));
                    }
                }
            }
            _ => {}
        }
    }

    // Clear state
    let mut guard = state.active_child.lock().unwrap();
    *guard = None;
    Ok("Download completed".to_string())
}

/// Cancel the active download - kills entire process tree
#[tauri::command]
fn cancel_download(
    app: AppHandle,
    state: State<'_, DownloadState>,
) -> Result<String, String> {
    let mut guard = state.active_child.lock().unwrap();
    
    if let Some((child, pid)) = guard.take() {
        // First try to kill the process tree using platform-specific methods
        let tree_killed = kill_process_tree(pid);
        
        // Also try the regular kill as backup
        let _ = child.kill();
        
        // Emit cancelled status
        let _ = app.emit(
            "download-progress",
            DownloadProgress {
                status: "cancelled".to_string(),
                percent: 0.0,
                ..Default::default()
            },
        );
        
        if tree_killed {
            Ok("Download cancelled".to_string())
        } else {
            Ok("Download cancelled (partial)".to_string())
        }
    } else {
        Ok("No active download".to_string())
    }
}

/// Kill entire process tree (cross-platform)
fn kill_process_tree(pid: u32) -> bool {
    #[cfg(target_os = "windows")]
    {
        // On Windows, use taskkill with /T flag to kill process tree
        use std::process::Command;
        let result = Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .output();
        match result {
            Ok(output) => output.status.success(),
            Err(e) => {
                eprintln!("Failed to run taskkill: {}", e);
                false
            }
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        // On Unix, send SIGKILL to process group
        use std::process::Command;
        // Try to kill the process group
        let result = Command::new("kill")
            .args(["-9", &format!("-{}", pid)]) // Negative PID kills process group
            .output();
        if result.is_ok() && result.unwrap().status.success() {
            return true;
        }
        // Fallback: just kill the process
        let result = Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output();
        match result {
            Ok(output) => output.status.success(),
            Err(_) => false,
        }
    }
}

/// Get the default download directory
#[tauri::command]
fn get_default_download_path() -> String {
    get_download_dir().to_string_lossy().to_string()
}

/// Load application settings
#[tauri::command]
fn get_settings() -> CommandResponse<AppSettings> {
    CommandResponse::ok(load_settings())
}

/// Save application settings
#[tauri::command]
fn save_settings(settings: AppSettings) -> CommandResponse<()> {
    save_settings_to_file(&settings).into()
}

/// Get acceleration configuration
#[tauri::command]
fn get_acceleration_config() -> CommandResponse<AccelerationConfig> {
    CommandResponse::ok(AccelerationConfig::load())
}

/// Save acceleration configuration
#[tauri::command]
async fn set_acceleration_config(config: AccelerationConfig) -> CommandResponse<()> {
    config.save().into()
}

// ============================================================================
// Download History Commands
// ============================================================================

/// Get all download history records
#[tauri::command]
fn get_download_history() -> CommandResponse<DownloadHistory> {
    CommandResponse::ok(download_history::load_history())
}

/// Add a new download record to history
#[tauri::command]
fn add_download_record(record: DownloadRecord) -> CommandResponse<()> {
    download_history::add_record(record).into()
}

/// Delete a record from history
#[tauri::command]
fn delete_history_record(id: String) -> CommandResponse<()> {
    download_history::delete_record(&id).into()
}

/// Clear all download history
#[tauri::command]
fn clear_download_history() -> CommandResponse<()> {
    download_history::clear_all().into()
}

/// Check if a file exists at the given path
#[tauri::command]
fn check_file_exists(path: String) -> bool {
    download_history::check_file_exists(&path)
}

/// Open file location in system file explorer
#[tauri::command]
async fn open_file_location(path: String) -> Result<(), String> {
    let file_path = std::path::PathBuf::from(&path);
    
    if !file_path.exists() {
        return Err("Path not found".to_string());
    }
    
    // Check if path is a directory or a file
    let is_dir = file_path.is_dir();
    
    #[cfg(target_os = "windows")]
    {
        if is_dir {
            // Open directory directly
            std::process::Command::new("explorer")
                .arg(&path)
                .spawn()
                .map_err(|e| format!("Failed to open explorer: {}", e))?;
        } else {
            // Open folder and select file
            std::process::Command::new("explorer")
                .args(["/select,", &path])
                .spawn()
                .map_err(|e| format!("Failed to open explorer: {}", e))?;
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        if is_dir {
            std::process::Command::new("open")
                .arg(&path)
                .spawn()
                .map_err(|e| format!("Failed to open Finder: {}", e))?;
        } else {
            std::process::Command::new("open")
                .args(["-R", &path])
                .spawn()
                .map_err(|e| format!("Failed to open Finder: {}", e))?;
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        let target: String = if is_dir { 
            path.clone()
        } else { 
            file_path.parent()
                .map(|p| p.to_string_lossy().into_owned())
                .unwrap_or(path.clone())
        };
        std::process::Command::new("xdg-open")
            .arg(&target)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }
    
    Ok(())
}

/// Open a file with the system default application
#[tauri::command]
async fn open_file(path: String) -> Result<(), String> {
    let file_path = std::path::PathBuf::from(&path);
    
    if !file_path.exists() {
        return Err("File not found".to_string());
    }
    
    if file_path.is_dir() {
        return Err("Path is a directory, not a file".to_string());
    }
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    Ok(())
}

/// Ensure aria2c binary is available
pub async fn ensure_aria2c_available() -> Result<(), String> {
    binary_downloader::ensure_aria2c().await
}

// ============================================================================
// Auto-Update Commands
// ============================================================================

/// Check for updates from GitHub releases
#[tauri::command]
async fn check_for_updates() -> CommandResponse<UpdateInfo> {
    match updater::check_for_updates().await {
        Ok(info) => CommandResponse::ok(info),
        Err(e) => CommandResponse::err(e),
    }
}

/// Open update download page in browser
#[tauri::command]
async fn open_update_page(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }

    Ok(())
}

// ============================================================================
// Download Queue Commands
// ============================================================================

/// Add a URL to the download queue
#[tauri::command]
async fn add_to_queue(
    app: AppHandle,
    queue: State<'_, DownloadQueue>,
    url: String,
) -> Result<CommandResponse<QueueItem>, String> {
    // Fetch video info first
    let video_info = fetch_video_info(&app, &url).await?;
    
    let item = QueueItem::new(
        url,
        video_info.title,
        video_info.uploader,
        video_info.thumbnail,
        Some(video_info.duration_string),
        video_info.filesize_approx,
    );
    
    let item_clone = item.clone();
    queue.add(item);
    
    // Emit queue update event
    let _ = app.emit("queue-updated", queue.get_all());
    
    Ok(CommandResponse::ok(item_clone))
}

/// Remove an item from the queue
#[tauri::command]
fn remove_from_queue(
    app: AppHandle,
    queue: State<'_, DownloadQueue>,
    id: String,
) -> Result<CommandResponse<bool>, String> {
    let removed = queue.remove(&id);
    
    // Emit queue update event
    let _ = app.emit("queue-updated", queue.get_all());
    
    Ok(CommandResponse::ok(removed))
}

/// Get all items in the queue
#[tauri::command]
fn get_queue(queue: State<'_, DownloadQueue>) -> Result<CommandResponse<Vec<QueueItem>>, String> {
    Ok(CommandResponse::ok(queue.get_all()))
}

/// Clear all pending items from the queue
#[tauri::command]
fn clear_queue(
    app: AppHandle,
    queue: State<'_, DownloadQueue>,
) -> Result<CommandResponse<()>, String> {
    queue.clear_pending();
    
    // Emit queue update event
    let _ = app.emit("queue-updated", queue.get_all());
    
    Ok(CommandResponse::ok(()))
}

/// Start processing the queue
#[tauri::command]
async fn start_queue(
    app: AppHandle,
    download_state: State<'_, DownloadState>,
    queue: State<'_, DownloadQueue>,
) -> Result<CommandResponse<String>, String> {
    // Check if already processing
    if queue.is_processing() {
        return Ok(CommandResponse::err("Queue is already processing".to_string()));
    }
    
    // Check if there are pending items
    if queue.pending_count() == 0 {
        return Ok(CommandResponse::err("No pending items in queue".to_string()));
    }
    
    queue.set_processing(true);
    
    // Process queue items one by one
    process_next_queue_item(app, download_state, queue).await
}

/// Process the next pending item in the queue
async fn process_next_queue_item(
    app: AppHandle,
    download_state: State<'_, DownloadState>,
    queue: State<'_, DownloadQueue>,
) -> Result<CommandResponse<String>, String> {
    // Get next pending item
    let next_item = match queue.get_next_pending() {
        Some(item) => item,
        None => {
            queue.set_processing(false);
            return Ok(CommandResponse::ok("Queue completed".to_string()));
        }
    };
    
    let item_id = next_item.id.clone();
    let url = next_item.url.clone();
    let title = next_item.title.clone();
    let uploader = next_item.uploader.clone();
    let thumbnail = next_item.thumbnail.clone();
    let filesize = next_item.filesize_approx;
    
    // Update status to downloading
    queue.update_status(&item_id, QueueStatus::Downloading, None);
    let _ = app.emit("queue-updated", queue.get_all());
    
    // Get settings for download
    let settings = load_settings();
    let output_dir = PathBuf::from(&settings.download_path);
    let template = settings.filename_template.clone();
    
    // Start download using existing logic
    let accel_config = AccelerationConfig::load();
    
    // Determine if acceleration should be used
    let use_acceleration = accel_config.enabled;
    let concurrent_fragments = if use_acceleration {
        accel_config.max_concurrent_fragments
    } else {
        1
    };
    
    // Start download
    let result = downloader::download_video_with_child(
        &app,
        &url,
        output_dir.clone(),
        &template,
        concurrent_fragments,
        accel_config.use_throttle_protection,
        accel_config.use_aria2c,
        Some(accel_config.aria2_min_split_size.clone()),
    ).await;
    
    match result {
        Ok((mut rx, child)) => {
            // Store child process
            let pid = child.pid();
            {
                let mut guard = download_state.active_child.lock().unwrap();
                *guard = Some((child, pid));
            }
            
            let mut last_filename: Option<String> = None;
            let mut total_bytes: Option<u64> = None;
            
            // Process events
            while let Some(event) = rx.recv().await {
                match event {
                    tauri_plugin_shell::process::CommandEvent::Stdout(line_bytes) => {
                        let line = String::from_utf8_lossy(&line_bytes);
                        if let Some(progress) = downloader::parse_progress_line(&line) {
                            // Track filename and total bytes
                            if progress.filename.is_some() {
                                last_filename = progress.filename.clone();
                            }
                            if progress.total_bytes.is_some() {
                                total_bytes = progress.total_bytes;
                            }
                            
                            // Emit progress with item ID for queue tracking
                            let _ = app.emit("queue-progress", serde_json::json!({
                                "item_id": item_id,
                                "progress": progress
                            }));
                            
                            // Also emit regular download-progress for compatibility
                            let _ = app.emit("download-progress", &progress);
                        }
                    }
                    tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                        if let Some(code) = payload.code {
                            if code == 0 {
                                // Success - mark as completed
                                queue.update_status(&item_id, QueueStatus::Completed, None);
                                
                                // Add to download history
                                // Cache thumbnail locally for persistence
                                let cached_thumbnail = thumbnail_cache::cache_thumbnail_sync(&thumbnail, &title);
                                
                                let record = DownloadRecord {
                                    id: uuid::Uuid::new_v4().to_string(),
                                    url: url.clone(),
                                    title: title.clone(),
                                    uploader: uploader.clone(),
                                    thumbnail: cached_thumbnail,
                                    file_path: last_filename.clone(),
                                    file_size: total_bytes.or(filesize),
                                    status: HistoryStatus::Completed,
                                    created_at: chrono::Utc::now().timestamp(),
                                    completed_at: Some(chrono::Utc::now().timestamp()),
                                    platform: downloader::detect_platform(&url).to_string().to_lowercase(),
                                };
                                let _ = download_history::add_record(record);
                                
                                // Emit history update event
                                let _ = app.emit("history-updated", ());
                            } else {
                                // Failed
                                queue.update_status(&item_id, QueueStatus::Failed, Some(format!("Exit code: {}", code)));
                            }
                        }
                        break;
                    }
                    _ => {}
                }
            }
            
            // Clear active child
            {
                let mut guard = download_state.active_child.lock().unwrap();
                *guard = None;
            }
            
            // Remove completed/failed items from queue (they're in history now)
            queue.remove(&item_id);
            
            // Emit queue update
            let _ = app.emit("queue-updated", queue.get_all());
            
            // Process next item (emit event for frontend to trigger)
            let app_clone = app.clone();
            tauri::async_runtime::spawn(async move {
                let _ = app_clone.emit("queue-item-finished", ());
            });
            
            Ok(CommandResponse::ok("Item completed".to_string()))
        }
        Err(e) => {
            queue.update_status(&item_id, QueueStatus::Failed, Some(e.clone()));
            let _ = app.emit("queue-updated", queue.get_all());
            queue.set_processing(false);
            Err(e)
        }
    }
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .manage(DownloadState::default())
        .manage(DownloadQueue::new())
        .manage(Arc::new(DownloadManager::default()))
        .setup(|_app| {
            tauri::async_runtime::spawn(async move {
                if let Err(e) = ensure_aria2c_available().await {
                    eprintln!("Failed to ensure aria2c is available: {}", e);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_video_info,
            start_download,
            cancel_download,
            get_default_download_path,
            get_settings,
            save_settings,
            get_acceleration_config,
            set_acceleration_config,
            // Download history commands
            get_download_history,
            add_download_record,
            delete_history_record,
            clear_download_history,
            check_file_exists,
            open_file_location,
            open_file,
            // Download queue commands (legacy)
            add_to_queue,
            remove_from_queue,
            get_queue,
            clear_queue,
            start_queue,
            // Concurrent download manager commands
            manager_add_to_queue,
            manager_remove_from_queue,
            manager_reorder_queue,
            manager_cancel_download,
            manager_get_queue_state,
            manager_set_max_concurrent,
            manager_continue_queue,
            // Auto-update commands
            check_for_updates,
            open_update_page,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ============================================================================
// Concurrent Download Manager Commands
// ============================================================================

/// Add a URL to the download manager queue (fetches metadata, auto-starts if capacity)
#[tauri::command]
async fn manager_add_to_queue(
    app: AppHandle,
    url: String,
) -> Result<CommandResponse<ManagerQueueItem>, String> {
    let manager = app.state::<Arc<DownloadManager>>();
    
    // Create placeholder item immediately
    let mut item = ManagerQueueItem::new(
        url.clone(),
        "Loading...".to_string(),
        "".to_string(),
        None,
        None,
        None,
    );
    item.status = DownloadStatus::FetchingMetadata;
    
    let item_clone = item.clone();
    let item_id = item.id.clone();
    manager.add_item(item);
    
    // Emit queue state changed (showing Loading item)
    let _ = app.emit("queue-state-changed", manager.get_all());
    
    // Spawn background task to fetch metadata
    let app_clone = app.clone();
    let manager_clone = manager.inner().clone();
    let url_clone = url.clone();
    
    tauri::async_runtime::spawn(async move {
        // Fetch video info
        match fetch_video_info(&app_clone, &url_clone).await {
            Ok(video_info) => {
                // Update item with real details
                manager_clone.update_details(
                    &item_id,
                    video_info.title,
                    video_info.uploader,
                    video_info.thumbnail,
                    Some(video_info.duration_string),
                    video_info.filesize_approx,
                );
                
                // Set status to Queued
                manager_clone.update_status(&item_id, DownloadStatus::Queued, None);
                
                // Emit updated state
                let _ = app_clone.emit("queue-state-changed", manager_clone.get_all());
                
                // Auto-start downloads if capacity available
                try_start_next_download(app_clone).await;
            },
            Err(e) => {
                // Mark as failed
                manager_clone.update_status(&item_id, DownloadStatus::Failed, Some(format!("Failed to fetch info: {}", e)));
                let _ = app_clone.emit("queue-state-changed", manager_clone.get_all());
            }
        }
    });
    
    Ok(CommandResponse::ok(item_clone))
}

/// Remove an item from the queue (cancels if downloading)
#[tauri::command]
fn manager_remove_from_queue(
    app: AppHandle,
    id: String,
) -> Result<CommandResponse<bool>, String> {
    let manager = app.state::<Arc<DownloadManager>>();
    
    // Cancel if downloading
    manager.cancel_download(&id);
    
    // Remove from queue
    let removed = manager.remove_item(&id);
    
    // Emit queue state changed
    let _ = app.emit("queue-state-changed", manager.get_all());
    
    Ok(CommandResponse::ok(removed))
}

/// Reorder an item in the queue
#[tauri::command]
fn manager_reorder_queue(
    app: AppHandle,
    id: String,
    new_index: usize,
) -> Result<CommandResponse<bool>, String> {
    let manager = app.state::<Arc<DownloadManager>>();
    
    let success = manager.reorder_item(&id, new_index);
    
    // Emit queue state changed
    let _ = app.emit("queue-state-changed", manager.get_all());
    
    Ok(CommandResponse::ok(success))
}

/// Cancel a specific download
#[tauri::command]
fn manager_cancel_download(
    app: AppHandle,
    id: String,
) -> Result<CommandResponse<bool>, String> {
    let manager = app.state::<Arc<DownloadManager>>();
    
    let cancelled = manager.cancel_download(&id);
    if cancelled {
        manager.update_status(&id, DownloadStatus::Cancelled, None);
        let _ = app.emit("queue-state-changed", manager.get_all());
    }
    
    Ok(CommandResponse::ok(cancelled))
}

/// Get the full queue state
#[tauri::command]
fn manager_get_queue_state(app: AppHandle) -> Result<CommandResponse<Vec<ManagerQueueItem>>, String> {
    let manager = app.state::<Arc<DownloadManager>>();
    Ok(CommandResponse::ok(manager.get_all()))
}

/// Set max concurrent downloads
#[tauri::command]
fn manager_set_max_concurrent(
    app: AppHandle,
    max: u8,
) -> Result<CommandResponse<u8>, String> {
    let manager = app.state::<Arc<DownloadManager>>();
    manager.set_max_concurrent(max);
    
    // Try to start more downloads if capacity increased
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        try_start_next_download(app_clone).await;
    });
    
    Ok(CommandResponse::ok(manager.get_max_concurrent()))
}

/// Try to start the next queued download if there's capacity
async fn try_start_next_download(app: AppHandle) {
    let manager = app.state::<Arc<DownloadManager>>().inner().clone();
    
    // Check capacity
    while manager.has_capacity() {
        // Get next queued item
        let next_item = match manager.get_next_queued() {
            Some(item) => item,
            None => break, // No more queued items
        };
        
        let item_id = next_item.id.clone();
        
        // Update status to downloading
        manager.update_status(&item_id, DownloadStatus::Downloading, None);
        let _ = app.emit("queue-state-changed", manager.get_all());
        
        // Start the download in a background task
        let app_clone = app.clone();
        let item_clone = next_item.clone();
        let manager_clone = manager.clone();
        
        // Create cancel channel
        let (cancel_tx, cancel_rx) = mpsc::channel::<()>(1);
        
        let join_handle = tauri::async_runtime::spawn(async move {
            run_download_task(app_clone, manager_clone, item_clone, cancel_rx).await;
        });
        
        // Register the handle
        manager.register_handle(item_id, DownloadHandle {
            cancel_tx,
            join_handle,
        });
    }
}

/// Run a single download task
async fn run_download_task(
    app: AppHandle,
    manager: Arc<DownloadManager>,
    item: ManagerQueueItem,
    mut cancel_rx: mpsc::Receiver<()>,
) {
    let item_id = item.id.clone();
    let url = item.url.clone();
    
    // Get settings
    let settings = load_settings();
    let output_dir = PathBuf::from(&settings.download_path);
    let template = settings.filename_template.clone();
    
    // Get acceleration config
    let accel_config = AccelerationConfig::load();
    let concurrent_fragments = if accel_config.enabled {
        accel_config.max_concurrent_fragments
    } else {
        1
    };
    
    // Start download
    let result = downloader::download_video_with_child(
        &app,
        &url,
        output_dir.clone(),
        &template,
        concurrent_fragments,
        accel_config.use_throttle_protection,
        accel_config.use_aria2c,
        Some(accel_config.aria2_min_split_size.clone()),
    ).await;
    
    match result {
        Ok((mut rx, child)) => {
            let pid = child.pid();
            
            let mut child = child;

            
            let mut last_filename: Option<String> = None;
            let mut total_bytes: Option<u64> = None;
            
            // Process events
            loop {
                tokio::select! {
                    // Check for cancel signal
                    _ = cancel_rx.recv() => {
                        // Kill the process
                        // Kill the process tree (subprocesses like aria2c)
                        kill_process_tree(pid);
                        
                        // Also kill direct child as backup
                        let _ = child.kill();
                        
                        // Clean up residual files
                        if let Some(path_str) = &last_filename {
                            let path = PathBuf::from(path_str);
                            
                            // Try to delete the file itself
                            if path.exists() {
                                let _ = std::fs::remove_file(&path);
                            }
                            
                            // Try to delete common partial extensions
                            let partial_exts = [".part", ".ytdl", ".aria2"];
                            for ext in partial_exts {
                                // Manual string manipulation to append extension safely
                                let mut partial_path_str = path_str.clone();
                                partial_path_str.push_str(ext);
                                let partial_path = PathBuf::from(partial_path_str);
                                
                                if partial_path.exists() {
                                    let _ = std::fs::remove_file(partial_path);
                                }
                            }
                        }

                        manager.update_status(&item_id, DownloadStatus::Cancelled, None);
                        break;
                    }
                    // Process download events
                    event = rx.recv() => {
                        match event {
                            Some(tauri_plugin_shell::process::CommandEvent::Stdout(line_bytes)) => {
                                let line = String::from_utf8_lossy(&line_bytes);
                                if let Some(progress) = downloader::parse_progress_line(&line) {
                                    // Track filename and total bytes
                                    if progress.filename.is_some() {
                                        last_filename = progress.filename.clone();
                                    }
                                    if progress.total_bytes.is_some() {
                                        total_bytes = progress.total_bytes;
                                    }
                                    
                                    // Update item progress
                                    manager.update_progress(&item_id, ItemProgress {
                                        percent: progress.percent,
                                        speed: progress.speed.clone(),
                                        eta: progress.eta.clone(),
                                        downloaded_bytes: progress.downloaded_bytes,
                                        total_bytes: progress.total_bytes,
                                        filename: progress.filename.clone(),
                                    });
                                    
                                    // Emit progress event
                                    let _ = app.emit("download-progress", serde_json::json!({
                                        "id": item_id,
                                        "progress": progress
                                    }));
                                    
                                    // Emit queue state
                                    let _ = app.emit("queue-state-changed", manager.get_all());
                                }
                            }
                            Some(tauri_plugin_shell::process::CommandEvent::Terminated(payload)) => {
                                if let Some(code) = payload.code {
                                    if code == 0 {
                                        // Success
                                        manager.update_status(&item_id, DownloadStatus::Completed, None);
                                        
                                        // Add to history
                                        // Cache thumbnail locally for persistence
                                        let cached_thumbnail = thumbnail_cache::cache_thumbnail_sync(&item.thumbnail, &item.title);
                                        
                                        let record = DownloadRecord {
                                            id: uuid::Uuid::new_v4().to_string(),
                                            url: url.clone(),
                                            title: item.title.clone(),
                                            uploader: item.uploader.clone(),
                                            thumbnail: cached_thumbnail,
                                            file_path: last_filename.clone(),
                                            file_size: total_bytes.or(item.filesize_approx),
                                            status: HistoryStatus::Completed,
                                            created_at: chrono::Utc::now().timestamp(),
                                            completed_at: Some(chrono::Utc::now().timestamp()),
                                            platform: downloader::detect_platform(&url).to_string().to_lowercase(),
                                        };
                                        let _ = download_history::add_record(record);
                                        let _ = app.emit("history-updated", ());
                                    } else {
                                        manager.update_status(&item_id, DownloadStatus::Failed, Some(format!("Exit code: {}", code)));
                                    }
                                }
                                break;
                            }
                            None => break,
                            _ => {}
                        }
                    }
                }
            }
            

        }
        Err(e) => {
            manager.update_status(&item_id, DownloadStatus::Failed, Some(e.clone()));
        }
    }
    
    // Remove handle
    manager.remove_handle(&item_id);
    
    // Remove completed/failed from queue
    let current_item = manager.get_item(&item_id);
    if let Some(item) = current_item {
        if item.status == DownloadStatus::Completed || 
           item.status == DownloadStatus::Failed ||
           item.status == DownloadStatus::Cancelled {
            manager.remove_item(&item_id);
        }
    }
    
    // Emit queue state
    let _ = app.emit("queue-state-changed", manager.get_all());
    
    // Emit event to signal download finished - frontend or setup listener will trigger next
    let _ = app.emit("download-task-finished", ());
}

/// Command to continue processing queue (called after download-task-finished event)
#[tauri::command]
async fn manager_continue_queue(app: AppHandle) -> Result<CommandResponse<()>, String> {
    try_start_next_download(app).await;
    Ok(CommandResponse::ok(()))
}
