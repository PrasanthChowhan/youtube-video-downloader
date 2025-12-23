# Cancellation & Cleanup Logic

## The Problem
Standard `CommandChild::kill()` only terminates the immediate child process (e.g., `yt-dlp`). However, `yt-dlp` often spawns subprocesses like `aria2c` (for acceleration) or `ffmpeg` (for merging). These subprocesses were becoming "orphaned" and continuing to run even after the UI showed "Cancelled".

## The Solution: Process Tree Termination

We implemented a robust `kill_process_tree(pid)` function that handles platform-specific process management.

### Windows
We use the native `taskkill` command:
```rust
Command::new("taskkill")
    .args(["/F", "/T", "/PID", &pid.to_string()])
    .output();
```
- `/F`: Forcefully terminate.
- `/T`: Terminate child processes (Tree).
- `/PID`: Target the specific Process ID.

### Unix (Linux/macOS)
We target the **Process Group** by sending `SIGKILL` to the negative PID:
```rust
Command::new("kill").args(["-9", &format!("-{}", pid)])
```

## Architecture Decoupling
Previously, cancellation relied on a shared `DownloadState` mutex, which caused race conditions with concurrent downloads (overwriting the single active PID).

**New Approach:**
- Each `run_download_task` maintains its own `child` process and `pid` locally.
- When the cancellation signal (`cancel_rx.recv()`) is received, it triggers the kill on that specific PID.
- This ensures concurrent downloads are isolated and safe.

## Residual File Cleanup
Upon cancellation, we actively clean up temporary files to prevent disk clutter:
1. **Target File:** Removes the destination file if it exists.
2. **Partial Files:** Scans for and removes common temporary extensions:
   - `.part` (yt-dlp default)
   - `.ytdl` (yt-dlp temp)
   - `.aria2` (aria2c control file)

This logic ensures a "clean" cancel that behaves as the user expects.

---

# Version Management

## Single Source of Truth
- **Source:** `package.json` version
- **Syncs to:** `Cargo.toml`, `tauri.conf.json`
- **Script:** `yt_downloader_tauri/scripts/sync-versions.js`

## Commands
```bash
cd yt_downloader_tauri
npm run version:bump 1.0.3   # Set specific version (updates ALL files)
npm run version:sync         # Sync current package.json version to others
```

## Release Workflow
```bash
npm run version:bump X.X.X
git add -A && git commit -m "chore: Bump version to X.X.X"
git tag vX.X.X
git push origin main --tags
```

## Why This Matters
Tauri reads version from `Cargo.toml`, not `tauri.conf.json`. All 3 files MUST match.



