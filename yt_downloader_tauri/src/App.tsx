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

  // Initialize app
  useEffect(() => {
    // Get default download path
    invoke<string>("get_default_download_path").then(setOutputPath);

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
    });
    if (selected) {
      setOutputPath(selected as string);
    }
  }, []);

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
      const response = await invoke<CommandResponse<string>>("start_download", {
        url,
        outputPath: outputPath || null,
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
  }, [url, outputPath]);

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
      {/* Header */}
      <header className="header">
        <h1>🎬 YT Downloader</h1>
        <span className="version">v1.0.0</span>
      </header>

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
