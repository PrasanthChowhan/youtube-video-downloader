//! Formatting utilities for the downloader module.

/// Formats bytes to human-readable string.
pub fn format_bytes(bytes: u64) -> String {
    const UNITS: [&str; 6] = ["B", "KB", "MB", "GB", "TB", "PB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;

    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }

    format!("{:.1} {}", size, UNITS[unit_index])
}

/// Formats speed in bytes/sec to human-readable string.
pub fn format_speed(bytes_per_sec: f64) -> String {
    const UNITS: [&str; 6] = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s", "PB/s"];
    let mut size = bytes_per_sec;
    let mut unit_index = 0;

    while size >= 1000.0 && unit_index < UNITS.len() - 1 {
        size /= 1000.0;
        unit_index += 1;
    }

    format!("{:.2}{}", size, UNITS[unit_index])
}

/// Formats ETA in seconds to MM:SS or HH:MM:SS format.
pub fn format_eta(seconds: u64) -> String {
    let hours = seconds / 3600;
    let minutes = (seconds % 3600) / 60;
    let secs = seconds % 60;

    if hours > 0 {
        format!("{:02}:{:02}:{:02}", hours, minutes, secs)
    } else {
        format!("{:02}:{:02}", minutes, secs)
    }
}
