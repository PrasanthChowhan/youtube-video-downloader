// src-tauri/src/acceleration_config.rs
//! Download acceleration configuration and management.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Configuration for download acceleration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccelerationConfig {
    /// Whether acceleration is enabled
    pub enabled: bool,

    /// Maximum concurrent fragments to download (1-8)
    /// Higher = faster but more risk of rate limiting
    pub max_concurrent_fragments: u8,

    /// Use throttle protection to detect YouTube rate limiting
    pub use_throttle_protection: bool,

    /// Minimum file size in MB to trigger acceleration
    /// Small files don't benefit from acceleration due to overhead
    pub min_file_size_mb: u64,

    /// Use aria2c as external downloader for better speeds
    /// Requires aria2c to be installed on the system
    pub use_aria2c: bool,

    /// Minimum split size for aria2c (e.g., "1M", "5M", "10M")
    pub aria2_min_split_size: String,
}

impl Default for AccelerationConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            max_concurrent_fragments: 4, // Safe default
            use_throttle_protection: true,
            min_file_size_mb: 10,
            use_aria2c: true, // Enabled by default for better speeds
            aria2_min_split_size: "1M".to_string(),
        }
    }
}

impl AccelerationConfig {
    /// Validate and clamp configuration values
    pub fn validate(&mut self) {
        // Clamp concurrent fragments (1-32 to allow higher speeds with aria2c)
        self.max_concurrent_fragments = self.max_concurrent_fragments.clamp(1, 32);

        // Ensure min file size is reasonable
        if self.min_file_size_mb == 0 {
            self.min_file_size_mb = 1;
        }

        // Validate split size format (simple check)
        if self.aria2_min_split_size.is_empty()
            || !self.aria2_min_split_size.chars().any(|c| c.is_digit(10))
        {
            self.aria2_min_split_size = "1M".to_string();
        }
    }

    /// Get config file path
    fn get_config_path() -> PathBuf {
        if let Some(config_dir) = dirs::config_dir() {
            config_dir.join("yt_downloader").join("acceleration.json")
        } else if let Some(home_dir) = dirs::home_dir() {
            home_dir.join(".yt_downloader").join("acceleration.json")
        } else {
            PathBuf::from("acceleration.json")
        }
    }

    /// Load configuration from file
    pub fn load() -> Self {
        let config_path = Self::get_config_path();

        if let Ok(contents) = fs::read_to_string(&config_path) {
            if let Ok(mut config) = serde_json::from_str::<AccelerationConfig>(&contents) {
                config.validate();
                return config;
            }
        }

        // Return default if file doesn't exist or is invalid
        Self::default()
    }

    /// Save configuration to file
    pub fn save(&self) -> Result<(), String> {
        let config_path = Self::get_config_path();

        // Create parent directory if it doesn't exist
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }

        let json = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        fs::write(&config_path, json).map_err(|e| format!("Failed to write config file: {}", e))?;

        Ok(())
    }

    /// Check if acceleration should be used for a given file size
    pub fn should_accelerate(&self, filesize_bytes: Option<u64>) -> bool {
        if !self.enabled {
            return false;
        }

        // If filesize is unknown, enable acceleration
        let Some(size) = filesize_bytes else {
            return true;
        };

        // Convert to MB and compare
        let size_mb = size / (1024 * 1024);
        size_mb >= self.min_file_size_mb
    }

    /// Get the number of concurrent fragments to use
    pub fn get_concurrent_fragments(&self) -> u8 {
        if self.enabled {
            self.max_concurrent_fragments
        } else {
            1 // No acceleration
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = AccelerationConfig::default();
        assert_eq!(config.enabled, true);
        assert_eq!(config.max_concurrent_fragments, 4);
        assert_eq!(config.use_throttle_protection, true);
        assert_eq!(config.min_file_size_mb, 10);
    }

    #[test]
    fn test_validation() {
        let mut config = AccelerationConfig {
            enabled: true,
            max_concurrent_fragments: 20, // Too high
            use_throttle_protection: true,
            min_file_size_mb: 0, // Too low
        };

        config.validate();
        assert_eq!(config.max_concurrent_fragments, 8); // Clamped
        assert_eq!(config.min_file_size_mb, 1); // Fixed
    }

    #[test]
    fn test_should_accelerate() {
        let config = AccelerationConfig::default();

        // Small file - no acceleration
        assert_eq!(config.should_accelerate(Some(5 * 1024 * 1024)), false);

        // Large file - accelerate
        assert_eq!(config.should_accelerate(Some(50 * 1024 * 1024)), true);

        // Unknown size - accelerate
        assert_eq!(config.should_accelerate(None), true);

        // Disabled config
        let disabled_config = AccelerationConfig {
            enabled: false,
            ..Default::default()
        };
        assert_eq!(
            disabled_config.should_accelerate(Some(100 * 1024 * 1024)),
            false
        );
    }
}
