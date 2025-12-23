# Changelog

All notable changes to YT Downloader will be documented in this file.

## [1.0.2] - 2025-12-24

### Added
- **Auto-check for updates on startup** - App checks for updates 2 seconds after launch
- **Notification badge** - Green pulsing badge appears on Update tab when update is available
- **Download progress bar** - Shows real-time progress during update installation

### Changed
- Update tab now shows status immediately on app launch (if update available)

---

## [1.0.1] - 2025-12-23

### Added
- **Auto-Update Feature** - Download and install updates directly in the app
- **Update Tab** - New tab in bottom navigation with `system_update` icon
- **Version Display** - Shows current version and latest available version
- **Release Notes** - View what's new before installing updates
- **One-Click Install** - Downloads, installs, and restarts automatically
- **Signed Releases** - All installers are cryptographically signed for security

### Technical
- Integrated `tauri-plugin-updater` for in-app updates
- Added `latest.json` generation in CI for update detection
- GitHub Actions workflow now signs all release artifacts

---

## [1.0.0] - 2025-12-20

### Added
- **YouTube Video Downloader** - Download videos from YouTube and other platforms
- **Download Queue** - Queue multiple downloads with concurrent processing
- **Download History** - View past downloads with thumbnails
- **Download Acceleration** - Configurable concurrent fragments for faster downloads
- **Multiple Formats** - Support for various video/audio formats
- **Custom Output** - Choose download folder and filename templates
- **Dark/Light Theme** - Automatic theme based on system preference
- **Cross-Platform** - Available for Windows, macOS (Intel & Apple Silicon), and Linux

### Technical
- Built with Tauri 2.0 + React + TypeScript
- Uses yt-dlp for video extraction
- Uses FFmpeg for media processing
- Uses aria2c for accelerated downloads
