# Tauri YouTube Video Downloader

A high-performance, modern desktop application for downloading YouTube videos, built with **Tauri v2**, **React**, and **Rust**.

![App Icon](src-tauri/icons/128x128.png)

## 🚀 Features

*   **Fast Downloads**: Leverages `yt-dlp` and `aria2c` (optional) for accelerated multi-threaded downloads.
*   **Modern UI**: Sleek, glassmorphism-inspired interface with animated backgrounds and smooth transitions.
*   **Media Support**: Download Videos (up to 4K/8K), Audio-only, and various formats.
*   **Queue System**: Batch download support with a drag-and-drop queue manager.
*   **Auto-Updates**: Integrated self-updater via GitHub Releases.
*   **History**: Track and manage your downloaded files with local thumbnail caching.
*   **Customization**: Dark/Light mode support, download location configuration, and filename templating.

## 🛠️ Tech Stack

*   **Frontend**: React (TypeScript), TailwindCSS, Vite
*   **Backend**: Rust (Tauri)
*   **Icon System**: Custom SVG components (no external font dependencies)
*   **Binaries**: `yt-dlp` (Video extraction), `ffmpeg` (Media processing)

## 📦 Installation

Download the latest release for your platform from the [Releases Page](../../releases).
*(Note: Currently signed for Windows)*

## 💻 Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v16+)
- [Rust](https://rustup.rs/) (latest stable)
- Visual Studio Code (recommended)

### Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/PrasanthChowhan/youtube-video-downloader.git
    cd youtube-video-downloader/yt_downloader_tauri
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run in Development Mode:**
    ```bash
    npm run tauri dev
    ```
    This will start the Vite frontend server and the Tauri Rust backend.

### Project Structure

*   `src/`: React frontend code (Components, Pages, Styles)
*   `src-tauri/`: Rust backend code (Commands, Plugins, Config)
*   `src-tauri/icons/`: Application icons generated for all platforms
*   `src-tauri/binaries/`: External binaries (should be placed here manually for dev if not using sidecar scripts)

## 🏗️ Building

To build a production release:

```bash
npm run tauri build
```

The artifacts (installer `setup.exe`) will be generated in `src-tauri/target/release/bundle/nsis/`.

## 🔄 Release & Auto-Updates

Releases are automated via GitHub Actions (`.github/workflows/release.yml`).
1.  Push a new tag (e.g., `v1.0.3`).
2.  The workflow builds the app, signs it with the Tauri private key, and checks for updates against `latest.json`.
3.  Users receive a notification in-app to update.

## 📝 License

MIT License.
