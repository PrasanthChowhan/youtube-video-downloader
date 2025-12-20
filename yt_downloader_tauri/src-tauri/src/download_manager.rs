//! Download Manager - Handles concurrent downloads with queue management
//!
//! Supports multiple simultaneous downloads, queue reordering, and per-item progress tracking.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Mutex;
use tauri::async_runtime::JoinHandle;
use tokio::sync::mpsc;

/// Status of a download item
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DownloadStatus {
    Queued,
    Downloading,
    Completed,
    Failed,
    Cancelled,
}

/// Progress information for a download
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ItemProgress {
    pub percent: f64,
    pub speed: String,
    pub eta: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub filename: Option<String>,
}

/// A single item in the download queue
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueItem {
    pub id: String,
    pub url: String,
    pub title: String,
    pub uploader: String,
    pub thumbnail: Option<String>,
    pub duration_string: Option<String>,
    pub filesize_approx: Option<u64>,
    pub status: DownloadStatus,
    pub progress: ItemProgress,
    pub error: Option<String>,
}

impl QueueItem {
    /// Create a new queued item
    pub fn new(
        url: String,
        title: String,
        uploader: String,
        thumbnail: Option<String>,
        duration_string: Option<String>,
        filesize_approx: Option<u64>,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            url,
            title,
            uploader,
            thumbnail,
            duration_string,
            filesize_approx,
            status: DownloadStatus::Queued,
            progress: ItemProgress::default(),
            error: None,
        }
    }
}

/// Handle for cancelling a download
pub struct DownloadHandle {
    pub cancel_tx: mpsc::Sender<()>,
    pub join_handle: JoinHandle<()>,
}

/// The download manager state
pub struct DownloadManager {
    /// Queue of all items (ordered)
    queue: Mutex<Vec<QueueItem>>,
    /// Currently active download handles (id -> handle)
    active_handles: Mutex<HashMap<String, DownloadHandle>>,
    /// Maximum concurrent downloads
    max_concurrent: AtomicU8,
}

impl Default for DownloadManager {
    fn default() -> Self {
        Self::new(2) // Default to 2 concurrent downloads
    }
}

impl DownloadManager {
    /// Create a new download manager
    pub fn new(max_concurrent: u8) -> Self {
        Self {
            queue: Mutex::new(Vec::new()),
            active_handles: Mutex::new(HashMap::new()),
            max_concurrent: AtomicU8::new(max_concurrent),
        }
    }

    /// Get max concurrent downloads setting
    pub fn get_max_concurrent(&self) -> u8 {
        self.max_concurrent.load(Ordering::Relaxed)
    }

    /// Set max concurrent downloads
    pub fn set_max_concurrent(&self, n: u8) {
        self.max_concurrent.store(n.clamp(1, 4), Ordering::Relaxed);
    }

    /// Add an item to the queue
    pub fn add_item(&self, item: QueueItem) -> String {
        let id = item.id.clone();
        let mut queue = self.queue.lock().unwrap();
        queue.push(item);
        id
    }

    /// Remove an item from the queue
    pub fn remove_item(&self, id: &str) -> bool {
        let mut queue = self.queue.lock().unwrap();
        let initial_len = queue.len();
        queue.retain(|item| item.id != id);
        queue.len() != initial_len
    }

    /// Get all items in the queue
    pub fn get_all(&self) -> Vec<QueueItem> {
        let queue = self.queue.lock().unwrap();
        queue.clone()
    }

    /// Get a specific item by ID
    pub fn get_item(&self, id: &str) -> Option<QueueItem> {
        let queue = self.queue.lock().unwrap();
        queue.iter().find(|item| item.id == id).cloned()
    }

    /// Update an item's status
    pub fn update_status(&self, id: &str, status: DownloadStatus, error: Option<String>) {
        let mut queue = self.queue.lock().unwrap();
        if let Some(item) = queue.iter_mut().find(|item| item.id == id) {
            item.status = status;
            item.error = error;
        }
    }

    /// Update an item's progress
    pub fn update_progress(&self, id: &str, progress: ItemProgress) {
        let mut queue = self.queue.lock().unwrap();
        if let Some(item) = queue.iter_mut().find(|item| item.id == id) {
            item.progress = progress;
        }
    }

    /// Move an item to a new position in the queue
    /// Only works for queued items (not currently downloading)
    pub fn reorder_item(&self, id: &str, new_index: usize) -> bool {
        let mut queue = self.queue.lock().unwrap();

        // Find current index
        let current_index = match queue.iter().position(|item| item.id == id) {
            Some(idx) => idx,
            None => return false,
        };

        // Only allow reordering queued items
        if queue[current_index].status != DownloadStatus::Queued {
            return false;
        }

        // Remove and reinsert at new position
        let item = queue.remove(current_index);
        let insert_index = new_index.min(queue.len());
        queue.insert(insert_index, item);

        true
    }

    /// Get count of currently downloading items
    pub fn downloading_count(&self) -> usize {
        let handles = self.active_handles.lock().unwrap();
        handles.len()
    }

    /// Check if there's capacity for more downloads
    pub fn has_capacity(&self) -> bool {
        self.downloading_count() < self.max_concurrent.load(Ordering::Relaxed) as usize
    }

    /// Get the next queued item (first item with Queued status)
    pub fn get_next_queued(&self) -> Option<QueueItem> {
        let queue = self.queue.lock().unwrap();
        queue
            .iter()
            .find(|item| item.status == DownloadStatus::Queued)
            .cloned()
    }

    /// Register an active download handle
    pub fn register_handle(&self, id: String, handle: DownloadHandle) {
        let mut handles = self.active_handles.lock().unwrap();
        handles.insert(id, handle);
    }

    /// Remove a download handle (download finished)
    pub fn remove_handle(&self, id: &str) -> Option<DownloadHandle> {
        let mut handles = self.active_handles.lock().unwrap();
        handles.remove(id)
    }

    /// Cancel a specific download
    pub fn cancel_download(&self, id: &str) -> bool {
        // Send cancel signal
        let handles = self.active_handles.lock().unwrap();
        if let Some(handle) = handles.get(id) {
            let _ = handle.cancel_tx.try_send(());
            true
        } else {
            false
        }
    }

    /// Cancel all active downloads
    pub fn cancel_all(&self) {
        let handles = self.active_handles.lock().unwrap();
        for handle in handles.values() {
            let _ = handle.cancel_tx.try_send(());
        }
    }

    /// Get IDs of items currently downloading
    pub fn get_downloading_ids(&self) -> Vec<String> {
        let handles = self.active_handles.lock().unwrap();
        handles.keys().cloned().collect()
    }

    /// Clear completed and failed items from queue
    pub fn clear_finished(&self) {
        let mut queue = self.queue.lock().unwrap();
        queue.retain(|item| {
            item.status != DownloadStatus::Completed
                && item.status != DownloadStatus::Failed
                && item.status != DownloadStatus::Cancelled
        });
    }

    /// Get count of queued items
    pub fn queued_count(&self) -> usize {
        let queue = self.queue.lock().unwrap();
        queue
            .iter()
            .filter(|item| item.status == DownloadStatus::Queued)
            .count()
    }
}

// Make DownloadManager Send + Sync safe
unsafe impl Send for DownloadManager {}
unsafe impl Sync for DownloadManager {}
