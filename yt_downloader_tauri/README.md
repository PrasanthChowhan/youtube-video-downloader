# YT Downloader (Tauri + Rust)

A high-performance, cross-platform YouTube downloader built with Tauri 2.0, Rust, and React.

![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![Tauri](https://img.shields.io/badge/Tauri-2.0-blue)
![Rust](https://img.shields.io/badge/Rust-1.70+-orange)

## ⚠️ Disclaimer

**This application is for PERSONAL and FAIR USE ONLY.** Respect YouTube's Terms of Service.

## ✨ Features

- 🎨 **Modern Dark UI** - Beautiful, responsive interface
- 📺 **Video Preview** - See title, thumbnail, duration before downloading
- 📊 **Progress Tracking** - Real-time speed, ETA, and percentage
- 🔄 **Auto-Update** - yt-dlp automatically stays current
- 📁 **Custom Output** - Choose where to save your videos
- 🎬 **Best Quality** - Downloads up to 4K resolution
- ⚡ **Lightweight** - ~8MB installer, ~15MB RAM usage

## 📋 Requirements

- Node.js 18+
- Rust 1.70+
- Windows: VS Build Tools / macOS: Xcode CLI / Linux: build-essential

## 🚀 Quick Start

### Development

```bash
cd yt_downloader_tauri
npm install
npm run tauri dev
```

### Production Build

```bash
npm run tauri build
```

The executable will be in `src-tauri/target/release/`.

## 📁 Project Structure

```
yt_downloader_tauri/
├── src/                    # React frontend
│   ├── App.tsx             # Main UI component
│   └── App.css             # Dark theme styles
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs          # Tauri commands
│   │   ├── downloader.rs   # yt-dlp integration
│   │   └── updater.rs      # Auto-update logic
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # App configuration
└── package.json
```

## 🔧 How It Works

1. **No bundled yt-dlp** - Downloads the latest version on first launch
2. **Background updates** - Checks for yt-dlp updates on each startup
3. **IPC Events** - Progress streamed from Rust to React in real-time

## 📖 Usage

1. Launch the app and accept the disclaimer
2. Paste a YouTube URL
3. Click **Fetch** to preview video info
4. Click **Download** to start downloading
5. Find your video in `~/Downloads/YouTube/`

## 🐛 Troubleshooting

### "yt-dlp not found" error
The app auto-downloads yt-dlp on first launch. Ensure you have internet access.

### Download fails immediately
Check if the video is region-locked, private, or age-restricted.

### Build fails
Ensure you have Rust and Node.js installed. On Windows, install VS Build Tools.

## 📄 License

For educational purposes only. Use responsibly.
