/**
 * YouTube Downloader App - Main Component
 */

import { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useSettings, useVideoInfo, useDownload } from "./hooks";
import { VideoPopup } from "./components";
import { isYouTubeUrl, isValidUrl } from "./utils/formatters";
import "./App.css";

function App() {
  const [url, setUrl] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { settings, outputPath, setOutputPath, updateSettings, saveSettings } =
    useSettings();
  const { videoInfo, isLoading, error, downloadMode, fetchInfo, clearInfo } =
    useVideoInfo();
  const {
    progress,
    isDownloading,
    error: downloadError,
    startDownload,
  } = useDownload();

  const handleGo = useCallback(async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    if (isYouTubeUrl(trimmedUrl) || isValidUrl(trimmedUrl)) {
      setShowPopup(true);
      await fetchInfo(trimmedUrl);
    }
  }, [url, fetchInfo]);

  const handleDownload = useCallback(async () => {
    await startDownload(
      url.trim(),
      outputPath,
      downloadMode,
      settings.filename_template
    );
  }, [url, outputPath, downloadMode, settings.filename_template, startDownload]);

  const handleClosePopup = useCallback(() => {
    if (!isDownloading) {
      setShowPopup(false);
      clearInfo();
    }
  }, [isDownloading, clearInfo]);

  const handleBrowse = useCallback(async () => {
    const selected = await open({
      directory: true,
      title: "Select Download Folder",
      defaultPath: outputPath || undefined,
    });
    if (selected) {
      setOutputPath(selected as string);
    }
  }, [outputPath, setOutputPath]);

  const handleSaveSettings = useCallback(async () => {
    await saveSettings();
    setShowSettings(false);
  }, [saveSettings]);

  return (
    <div className="app-container">
      {/* Top Bar */}
      <header className="top-bar">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGo()}
          placeholder="Paste URL here..."
          className="url-input"
        />
        <button
          onClick={handleGo}
          className="btn-go"
          disabled={isLoading || !url.trim()}
        >
          Go
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="btn-settings"
          title="Settings"
        >
          ⚙️
        </button>
      </header>

      {/* Main Area */}
      <main className="main-area">
        <div className="empty-state">
          <span className="empty-icon">📥</span>
          <p>Paste a YouTube URL and click Go</p>
        </div>
      </main>

      {/* Bottom Bar */}
      <footer className="bottom-bar">
        <div className="source-indicator">
          {downloadMode === "youtube" && <span className="source-yt">YT</span>}
          {downloadMode === "direct" && <span className="source-direct">⬇</span>}
          {!downloadMode && <span className="source-none">—</span>}
        </div>
        <button
          onClick={() => url.trim() && handleGo()}
          className="btn-download-main"
          disabled={!url.trim() || isDownloading}
        >
          ⬇ Download
        </button>
      </footer>

      {/* Video Popup */}
      <VideoPopup
        isOpen={showPopup}
        onClose={handleClosePopup}
        onDownload={handleDownload}
        onBrowse={handleBrowse}
        videoInfo={videoInfo}
        outputPath={outputPath}
        onOutputPathChange={setOutputPath}
        isLoading={isLoading}
        isDownloading={isDownloading}
        progress={progress}
        error={error || downloadError}
        downloadMode={downloadMode}
        url={url}
      />

      {/* Settings Modal */}
      {showSettings && (
        <div className="popup-overlay" onClick={() => setShowSettings(false)}>
          <div
            className="popup-modal settings-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="popup-header">
              <h2>Settings</h2>
              <button
                className="btn-close"
                onClick={() => setShowSettings(false)}
              >
                ×
              </button>
            </div>

            <div className="popup-content">
              <div className="setting-group">
                <label>Download Location</label>
                <div className="output-row">
                  <input
                    type="text"
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    className="path-input"
                  />
                  <button onClick={handleBrowse} className="btn-browse">
                    📁
                  </button>
                </div>
              </div>

              <div className="setting-group">
                <label>Filename Format</label>
                <select
                  value={settings.filename_template}
                  onChange={(e) =>
                    updateSettings({ filename_template: e.target.value })
                  }
                  className="settings-select"
                >
                  <option value="%(uploader)s/%(title)s.%(ext)s">
                    Channel Folder / Title
                  </option>
                  <option value="%(title)s.%(ext)s">Title Only</option>
                  <option value="%(upload_date)s - %(title)s.%(ext)s">
                    Date - Title
                  </option>
                </select>
              </div>
            </div>

            <div className="popup-footer">
              <button
                onClick={() => setShowSettings(false)}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button onClick={handleSaveSettings} className="btn-download">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
