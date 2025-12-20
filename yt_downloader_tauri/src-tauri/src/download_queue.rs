//! Download queue management module.
//!
//! Manages a queue of downloads that process sequentially.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// Status of a queue item
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum QueueStatus {
    Pending,
    Downloading,
    Completed,
    Failed,
    Cancelled,
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
    pub status: QueueStatus,
    pub error: Option<String>,
}

impl QueueItem {
    /// Create a new pending queue item
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
            status: QueueStatus::Pending,
            error: None,
        }
    }
}

/// The download queue state
#[derive(Debug, Default)]
pub struct DownloadQueue {
    pub items: Mutex<Vec<QueueItem>>,
    pub is_processing: Mutex<bool>,
}

impl DownloadQueue {
    /// Create a new empty queue
    pub fn new() -> Self {
        Self {
            items: Mutex::new(Vec::new()),
            is_processing: Mutex::new(false),
        }
    }

    /// Add an item to the queue
    pub fn add(&self, item: QueueItem) -> String {
        let id = item.id.clone();
        let mut items = self.items.lock().unwrap();
        items.push(item);
        id
    }

    /// Remove an item from the queue by ID
    pub fn remove(&self, id: &str) -> bool {
        let mut items = self.items.lock().unwrap();
        let initial_len = items.len();
        items.retain(|item| item.id != id);
        items.len() != initial_len
    }

    /// Get all items in the queue
    pub fn get_all(&self) -> Vec<QueueItem> {
        let items = self.items.lock().unwrap();
        items.clone()
    }

    /// Clear all pending items from the queue
    pub fn clear_pending(&self) {
        let mut items = self.items.lock().unwrap();
        items.retain(|item| item.status != QueueStatus::Pending);
    }

    /// Clear all items from the queue
    pub fn clear_all(&self) {
        let mut items = self.items.lock().unwrap();
        items.clear();
    }

    /// Get the next pending item
    pub fn get_next_pending(&self) -> Option<QueueItem> {
        let items = self.items.lock().unwrap();
        items
            .iter()
            .find(|item| item.status == QueueStatus::Pending)
            .cloned()
    }

    /// Update an item's status
    pub fn update_status(&self, id: &str, status: QueueStatus, error: Option<String>) {
        let mut items = self.items.lock().unwrap();
        if let Some(item) = items.iter_mut().find(|item| item.id == id) {
            item.status = status;
            item.error = error;
        }
    }

    /// Check if queue is currently processing
    pub fn is_processing(&self) -> bool {
        *self.is_processing.lock().unwrap()
    }

    /// Set processing state
    pub fn set_processing(&self, processing: bool) {
        *self.is_processing.lock().unwrap() = processing;
    }

    /// Get count of pending items
    pub fn pending_count(&self) -> usize {
        let items = self.items.lock().unwrap();
        items
            .iter()
            .filter(|item| item.status == QueueStatus::Pending)
            .count()
    }
}
