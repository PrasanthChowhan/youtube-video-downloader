//! Response Module
//!
//! Provides a standardized response wrapper for all Tauri commands.

use serde::{Deserialize, Serialize};

/// A standardized response wrapper for Tauri commands.
#[derive(Debug, Serialize, Deserialize)]
pub struct CommandResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> CommandResponse<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn err(error: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
        }
    }
}

impl<T> From<Result<T, String>> for CommandResponse<T> {
    fn from(result: Result<T, String>) -> Self {
        match result {
            Ok(data) => Self::ok(data),
            Err(e) => Self::err(e),
        }
    }
}
