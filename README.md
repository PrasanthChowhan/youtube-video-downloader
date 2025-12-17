# YT Downloader

A modern YouTube video downloader desktop application built with **Tauri**, **Rust**, and **React**.

## Features

- 🎥 Download YouTube videos in various formats
- 🎵 Extract audio from videos
- 📊 Real-time download progress
- ⚙️ Configurable download settings
- 🎨 Modern, clean UI

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Rust + Tauri
- **Video Processing**: yt-dlp + FFmpeg (bundled as sidecars)

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### Setup

```bash
cd yt_downloader_tauri
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

## Project Structure

```
yt_downloader_tauri/
├── src/                    # React frontend
├── src-tauri/
│   ├── src/               # Rust backend
│   ├── binaries/          # Sidecar binaries (yt-dlp, ffmpeg)
│   └── tauri.conf.json    # Tauri configuration
└── package.json
```

## License

MIT
