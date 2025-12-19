// src/App.tsx
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";

// Types matching Rust structs
interface VideoInfo {
  id: string;
  title: string;
  uploader: string;
  duration: number;
  duration_string: string;
  thumbnail: string | null;
  view_count: number | null;
  filesize_approx: number | null;
  url: string;
}

interface DownloadProgress {
  status: string;
  percent: number;
  speed: string;
  eta: string;
  downloaded_bytes: number;
  total_bytes: number | null;
  filename: string | null;
}

interface CommandResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

interface AppSettings {
  download_path: string;
  filename_template: string;
  theme: string;
}

interface AccelerationConfig {
  enabled: boolean;
  max_concurrent_fragments: number;
  use_throttle_protection: boolean;
  min_file_size_mb: number;
  use_aria2c: boolean;
}

function App() {
  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [outputPath, setOutputPath] = useState("");
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Ready");
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    download_path: "",
    filename_template: "%(uploader)s/%(title)s.%(ext)s",
    theme: "dark"
  });
  const [accelConfig, setAccelConfig] = useState<AccelerationConfig>({
    enabled: true,
    max_concurrent_fragments: 4,
    use_throttle_protection: true,
    min_file_size_mb: 10,
    use_aria2c: false,
  });

  // Initialize app
  useEffect(() => {
    // Load settings
    invoke<CommandResponse<AppSettings>>("get_settings").then((res) => {
      if (res.success && res.data) {
        setSettings(res.data);
        setOutputPath(res.data.download_path);
      } else {
        // Fallback default
        invoke<string>("get_default_download_path").then(setOutputPath);
      }
    });

    // Load acceleration config
    invoke<CommandResponse<AccelerationConfig>>("get_acceleration_config").then((res) => {
      if (res.success && res.data) {
        setAccelConfig(res.data);
      }
    });

    // Listen for download progress events
    const unlisten = listen<DownloadProgress>("download-progress", (event) => {
      setProgress(event.payload);
      if (event.payload.status === "finished") {
        setIsDownloading(false);
        setStatus("Download completed!");
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleSaveSettings = async () => {
    try {
      await invoke("save_settings", { settings });
      await invoke("set_acceleration_config", { config: accelConfig });
      setShowSettings(false);

      // Update local overrides if they match defaults
      if (!outputPath) setOutputPath(settings.download_path);
    } catch (e) {
      setError("Failed to save settings: " + e);
    }
  };

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text.trim());
      setError(null);
    } catch {
      setError("Failed to read clipboard");
    }
  }, []);

  const handleFetchInfo = useCallback(async () => {
    if (!url.trim()) {
      setError("Please enter a YouTube URL");
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatus("Fetching video information...");

    try {
      const response = await invoke<CommandResponse<VideoInfo>>("get_video_info", { url });

      if (response.success && response.data) {
        setVideoInfo(response.data);
        setStatus("Video info loaded");
      } else {
        setError(response.error || "Failed to fetch video info");
        setStatus("Error");
      }
    } catch (e) {
      setError(String(e));
      setStatus("Error");
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  const handleBrowse = useCallback(async () => {
    const selected = await open({
      directory: true,
      title: "Select Download Folder",
      defaultPath: outputPath || undefined,
    });
    if (selected) {
      setOutputPath(selected as string);
    }
  }, [outputPath]);

  const handleSettingsBrowse = useCallback(async () => {
    const selected = await open({
      directory: true,
      title: "Select Default Download Folder",
      defaultPath: settings.download_path || undefined,
    });
    if (selected) {
      setSettings(s => ({ ...s, download_path: selected as string }));
    }
  }, [settings.download_path]);

  const handleDownload = useCallback(async () => {
    if (!url.trim()) {
      setError("Please enter a YouTube URL");
      return;
    }

    setIsDownloading(true);
    setError(null);
    setProgress({ status: "starting", percent: 0, speed: "", eta: "", downloaded_bytes: 0, total_bytes: null, filename: null });
    setStatus("Starting download...");

    try {
      // Use current output path (which defaults to settings value)
      // Use settings.filename_template
      const response = await invoke<CommandResponse<string>>("start_download", {
        url,
        outputPath: outputPath || settings.download_path,
        filenameTemplate: settings.filename_template,
      });

      if (!response.success) {
        setError(response.error || "Download failed");
        setStatus("Error");
        setIsDownloading(false);
      }
    } catch (e) {
      setError(String(e));
      setStatus("Error");
      setIsDownloading(false);
    }
  }, [url, outputPath, settings]);

  const formatBytes = (bytes: number): string => {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  // Settings Modal
  const SettingsModal = () => (
    <div className="disclaimer-overlay">
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ Settings</h2>
          <button className="btn-close" onClick={() => setShowSettings(false)}>✕</button>
        </div>

        <div className="settings-content">
          <div className="setting-group">
            <label>Default Download Folder</label>
            <div className="input-row">
              <input
                value={settings.download_path}
                onChange={e => setSettings({ ...settings, download_path: e.target.value })}
                className="path-input"
              />
              <button onClick={handleSettingsBrowse} className="btn-secondary">📁</button>
            </div>
          </div>

          <div className="setting-group">
            <label>Filename Format</label>
            <select
              value={settings.filename_template}
              onChange={e => setSettings({ ...settings, filename_template: e.target.value })}
              className="settings-select"
            >
              <option value="%(uploader)s/%(title)s.%(ext)s">Channel Folder / Title</option>
              <option value="%(title)s.%(ext)s">Title Only</option>
              <option value="%(upload_date)s - %(title)s.%(ext)s">Date - Title</option>
            </select>
          </div>

          <div className="setting-group">
            <label>⚡ Download Acceleration</label>
            <div className="acceleration-controls">
              <div className="toggle-row">
                <span>Enable Acceleration</span>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={accelConfig.enabled}
                    onChange={e => setAccelConfig({ ...accelConfig, enabled: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {accelConfig.enabled && (
                <>
                  <div className="slider-row">
                    <label>Concurrent Connections: {accelConfig.max_concurrent_fragments}</label>
                    <input
                      type="range"
                      min="1"
                      max="8"
                      value={accelConfig.max_concurrent_fragments}
                      onChange={e => setAccelConfig({ ...accelConfig, max_concurrent_fragments: parseInt(e.target.value) })}
                      className="connection-slider"
                    />
                    <div className="slider-labels">
                      <span>1 (Safe)</span>
                      <span>8 (Fast)</span>
                    </div>
                  </div>

                  <div className="warning-box">
                    ⚠️ Higher values = faster downloads but increased risk of YouTube rate limiting. Recommended: 3-5
                  </div>


                  <div className="toggle-row">
                    <span>Throttle Protection</span>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={accelConfig.use_throttle_protection}
                        onChange={e => setAccelConfig({ ...accelConfig, use_throttle_protection: e.target.checked })}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="toggle-row">
                    <span>Use aria2c (faster speeds)</span>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={accelConfig.use_aria2c}
                        onChange={e => setAccelConfig({ ...accelConfig, use_aria2c: e.target.checked })}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  {accelConfig.use_aria2c && (
                    <div className="warning-box">
                      ℹ️ Requires aria2c to be installed separately. Can provide 2-5x speed improvements but may trigger throttling if used aggressively.
                    </div>
                  )}

                  <div className="slider-row">
                    <label>Min file size for acceleration: {accelConfig.min_file_size_mb} MB</label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={accelConfig.min_file_size_mb}
                      onChange={e => setAccelConfig({ ...accelConfig, min_file_size_mb: parseInt(e.target.value) })}
                      className="connection-slider"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleSaveSettings}>Save Settings</button>
        </div>
      </div>
    </div>
  );

  // Disclaimer Modal
  if (showDisclaimer) {
    return (
      <div className="disclaimer-overlay">
        <div className="disclaimer-modal">
          <h2>⚠️ Personal Use Disclaimer</h2>
          <div className="disclaimer-content">
            <p>This application is intended for <strong>PERSONAL and FAIR USE ONLY</strong>.</p>
            <p>By using this software, you agree to:</p>
            <ul>
              <li>Only download videos for which you have permission</li>
              <li>Respect YouTube's Terms of Service</li>
              <li>Use downloaded content for personal, educational, or fair use purposes only</li>
              <li>Not redistribute copyrighted content</li>
              <li>Comply with all applicable laws in your jurisdiction</li>
            </ul>
            <p className="disclaimer-warning">
              The developers are not responsible for any misuse of this software.
            </p>
          </div>
          <div className="disclaimer-buttons">
            <button className="btn-secondary" onClick={() => window.close()}>
              Decline
            </button>
            <button className="btn-primary" onClick={() => setShowDisclaimer(false)}>
              I Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="container">
      {/* Settings Modal */}
      {showSettings && <SettingsModal />}

      {/* Header */}
      <header className="header">
        <div className="header-left">
          <h1>🎬 YT Downloader</h1>
          <span className="version">v1.0.0</span>
        </div>
        <button className="btn-icon-small" onClick={() => setShowSettings(true)} title="Settings">
          ⚙️
        </button>
      </header>

      {/* URL Input Section */}

      {/* URL Input Section */}
      <section className="card">
        <h3>YouTube URL</h3>
        <div className="input-row">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube URL here..."
            className="url-input"
          />
          <button onClick={handlePaste} className="btn-icon" title="Paste">
            📋
          </button>
          <button
            onClick={handleFetchInfo}
            disabled={isLoading || isDownloading}
            className="btn-primary"
          >
            {isLoading ? "Loading..." : "🔍 Fetch"}
          </button>
        </div>
      </section>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          ⚠️ {error}
        </div>
      )}

      {/* Video Info Section */}
      {videoInfo && (
        <section className="card video-info">
          <h3>Video Information</h3>
          <div className="video-details">
            {videoInfo.thumbnail && (
              <img
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                className="thumbnail"
              />
            )}
            <div className="video-meta">
              <p className="video-title">{videoInfo.title}</p>
              <p className="video-uploader">📺 {videoInfo.uploader}</p>
              <p className="video-duration">⏱️ {videoInfo.duration_string}</p>
              {videoInfo.filesize_approx && (
                <p className="video-size">
                  📦 ~{formatBytes(videoInfo.filesize_approx)}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Output Path Section */}
      <section className="card">
        <h3>Output Folder</h3>
        <div className="input-row">
          <input
            type="text"
            value={outputPath}
            onChange={(e) => setOutputPath(e.target.value)}
            placeholder="Select output folder..."
            className="path-input"
          />
          <button onClick={handleBrowse} className="btn-secondary">
            📁 Browse
          </button>
        </div>
      </section>

      {/* Download Section */}
      <section className="card download-section">
        <button
          onClick={handleDownload}
          disabled={isDownloading || isLoading}
          className="btn-download"
        >
          {isDownloading ? "⏳ Downloading..." : "⬇️ Download"}
        </button>

        {progress && (
          <div className="progress-container">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${Math.min(progress.percent, 100)}%` }}
              />
            </div>
            <div className="progress-stats">
              <span className="percent">{progress.percent.toFixed(1)}%</span>
              <span className="speed">{progress.speed || "--"}</span>
              <span className="eta">ETA: {progress.eta || "--:--"}</span>
            </div>
            {progress.status === "merging" && (
              <p className="merge-status">🔄 Merging video and audio...</p>
            )}
          </div>
        )}
      </section>

      {/* Status Bar */}
      <footer className="status-bar">
        {status}
      </footer>
    </main>
  );
}

export default App;
