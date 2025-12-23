# Tauri Auto-Update Implementation Guide

Complete step-by-step guide on implementing auto-update for Tauri v2 applications with GitHub Releases.

---

## Overview

The auto-update system consists of:
1. **Backend (Rust)** - Check for updates via GitHub API
2. **Frontend (React)** - UI to show updates and install button
3. **Signing Keys** - Verify updates are authentic
4. **CI/CD (GitHub Actions)** - Build and sign releases automatically

---

## Step 1: Install Dependencies

### Rust (Backend)
```bash
cd yt_downloader_tauri
npm run tauri add updater
```

This adds `tauri-plugin-updater` to `Cargo.toml` and updates `lib.rs`.

### JavaScript (Frontend)
```bash
npm install @tauri-apps/plugin-updater @tauri-apps/plugin-process
```

---

## Step 2: Generate Signing Keys

```bash
cd src-tauri
npm run tauri signer generate -- -w update-key.key
```

Enter a password when prompted. This creates:
- `update-key.key` - Private key (KEEP SECRET!)
- `update-key.key.pub` - Public key

**Save these values:**
- **Private Key**: Content of `update-key.key`
- **Password**: The password you entered

---

## Step 3: Configure tauri.conf.json

Add these settings:

```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "CONTENT_OF_update-key.key.pub",
      "endpoints": [
        "https://github.com/YOUR_USERNAME/YOUR_REPO/releases/latest/download/latest.json"
      ]
    }
  }
}
```

---

## Step 4: Update lib.rs

The `tauri add updater` command should have added this automatically:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_updater::Builder::new().build())
    // ... other plugins
```

---

## Step 5: Create Update Checker (Rust)

Create `src/updater.rs`:

```rust
use serde::{Deserialize, Serialize};

const GITHUB_API_URL: &str = "https://api.github.com/repos/USER/REPO/releases/latest";

#[derive(Debug, Serialize, Clone)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub release_url: String,
    pub download_url: String,
    pub release_notes: String,
    pub published_at: String,
}

pub async fn check_for_updates() -> Result<UpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION");
    
    let client = reqwest::Client::new();
    let response = client
        .get(GITHUB_API_URL)
        .header("User-Agent", "YourApp")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    // Parse response and compare versions
    // Return UpdateInfo
}
```

---

## Step 6: Create Frontend UI (React)

### Add Update Tab to Navigation
```tsx
// In BottomNav.tsx or navigation component
{ id: "update", icon: "system_update", label: "Update" }
```

### Add Update Check Handler
```tsx
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

const handleInstallUpdate = async () => {
  const update = await check();
  if (update) {
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          console.log(`Downloading ${event.data.contentLength} bytes`);
          break;
        case "Progress":
          // Update progress bar
          break;
        case "Finished":
          console.log("Download complete");
          break;
      }
    });
    await relaunch();
  }
};
```

---

## Step 7: Add GitHub Repository Secrets

Go to: `https://github.com/YOUR_REPO/settings/secrets/actions`

Add these **Repository Secrets**:

| Secret Name | Value |
|-------------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | Content of `update-key.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password you entered |

---

## Step 8: Update GitHub Actions Workflow

In `.github/workflows/release.yml`:

```yaml
- name: Build the app
  uses: tauri-apps/tauri-action@v0
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
  with:
    tagName: v__VERSION__
    releaseName: 'App v__VERSION__'
    includeUpdaterJson: true
```

Key additions:
- `TAURI_SIGNING_PRIVATE_KEY` and `PASSWORD` env vars
- `includeUpdaterJson: true`

---

## Step 9: Sync Versions (VERY IMPORTANT!)

Version must be the same in ALL 3 files:
- `package.json`
- `Cargo.toml`
- `tauri.conf.json`

Use the sync script:
```bash
npm run version:bump 1.0.3
```

---

## Step 10: Create a Release

```bash
# 1. Bump version
npm run version:bump 1.0.3

# 2. Commit
git add -A
git commit -m "chore: Bump version to 1.0.3"

# 3. Tag and push
git tag v1.0.3
git push origin main --tags
```

GitHub Actions will:
1. Build for all platforms
2. Sign the installers
3. Create `latest.json`
4. Create a draft release

---

## Common Errors & Fixes

### "Wrong password for that key"
- The `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` doesn't match
- Fix: Regenerate keys with known password

### "Invalid padding" / "failed to decode base64"
- Extra whitespace in the private key secret
- Fix: Copy key exactly, no spaces before/after

### Wrong version shown in app
- Version in `Cargo.toml` doesn't match `tauri.conf.json`
- Fix: Run `npm run version:sync`

### "No update available" when there should be
- `latest.json` not in release assets
- Fix: Add `includeUpdaterJson: true` to workflow

---

## File Locations Summary

| File | Purpose |
|------|---------|
| `src-tauri/tauri.conf.json` | App version, updater config, public key |
| `src-tauri/Cargo.toml` | Rust package version |
| `package.json` | Node package version |
| `src-tauri/src/updater.rs` | Update check logic |
| `src/App.tsx` | Update UI |
| `.github/workflows/release.yml` | CI/CD with signing |
| `update-key.key` | PRIVATE KEY (don't commit!) |
| `update-key.key.pub` | Public key |

---

## Release Checklist

- [ ] Sync version: `npm run version:bump X.X.X`
- [ ] Commit: `git commit -m "chore: Bump version to X.X.X"`
- [ ] Tag: `git tag vX.X.X`
- [ ] Push: `git push origin main --tags`
- [ ] Wait for build to complete
- [ ] Publish the draft release

---

**That's it!** Your app now auto-updates. 🎉
