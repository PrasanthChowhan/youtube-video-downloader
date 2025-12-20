---
description: Development workflow and coding guidelines for this YouTube Downloader project
---

# YouTube Downloader Development Guide

## Quick Start
```bash
cd yt_downloader_tauri
npm run tauri dev    # Full app development
```

## Project Structure
```
yt_downloader_tauri/
├── src/                      # React frontend
│   ├── App.tsx              # Main app
│   ├── App.css              # Styles
│   ├── components/          # UI components
│   ├── hooks/               # React hooks
│   ├── types/               # TypeScript types
│   └── utils/               # Utilities
│
└── src-tauri/src/           # Rust backend
    ├── lib.rs               # Tauri commands
    ├── response.rs          # CommandResponse<T>
    ├── settings.rs          # App settings
    ├── acceleration_config.rs # Speed boost config
    ├── binary_downloader.rs # aria2c download
    └── downloader/          # Video download logic
        ├── mod.rs           # Main logic
        ├── types.rs         # VideoInfo, DownloadProgress
        ├── formats.rs       # Formatting utilities
        └── youtube.rs       # YouTube URL handling
```

## Commands
```bash
# Frontend
npm run build        # Build frontend
npm run dev          # Dev server

# Backend  
cargo check          # Type check
cargo build          # Build

# Full App
npm run tauri dev    # Dev mode
npm run tauri build  # Production
```

## Code Guidelines

### Rust
- Use `CommandResponse<T>` for all Tauri commands
- Add `///` doc comments to public functions
- Keep modules focused (<300 lines)

### TypeScript
- Use hooks for state management
- Keep components in `components/`
- All types in `types/index.ts`

## Common Tasks

### Add New Tauri Command
1. Add function in `lib.rs` with `#[tauri::command]`
2. Register in `tauri::generate_handler![]`
3. Add TypeScript type in `types/index.ts`

### Add New React Component
1. Create `components/ComponentName.tsx`
2. Export from `components/index.ts`
