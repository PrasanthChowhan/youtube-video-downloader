/**
 * VideoGet - Main App Component
 */

import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useSettings, useVideoInfo, useDownload } from "./hooks";
import { UrlInput, DownloadCard, BottomNav } from "./components";
import type { AccelerationConfig, CommandResponse } from "./types";
import "./App.css";

type Tab = "settings" | "youtube" | "downloads";

function App() {
  const [url, setUrl] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("youtube");

  // Acceleration config state
  const [accelConfig, setAccelConfig] = useState<AccelerationConfig>({
    enabled: true,
    max_concurrent_fragments: 4,
    use_throttle_protection: true,
    min_file_size_mb: 10,
    use_aria2c: true,
    aria2_min_split_size: "1M",
    smart_mode: true,
  });

  // Hooks
  const { settings, outputPath, setOutputPath, updateSettings, saveSettings } = useSettings();
  const { videoInfo, isLoading, error, downloadMode, fetchInfo, clearInfo } = useVideoInfo();
  const { progress, isDownloading, startDownload } = useDownload();

  // Load acceleration config on mount
  useEffect(() => {
    invoke<CommandResponse<AccelerationConfig>>("get_acceleration_config").then((res) => {
      if (res.success && res.data) {
        setAccelConfig(res.data);
      }
    });
  }, []);

  /**
   * Handle download button click
   */
  const handleDownload = useCallback(async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    // Fetch video info first
    await fetchInfo(trimmedUrl);

    // Start download
    await startDownload(trimmedUrl, outputPath, downloadMode, settings.filename_template);
  }, [url, outputPath, downloadMode, settings.filename_template, fetchInfo, startDownload]);

  /**
   * Cancel current download
   */
  const handleCancel = useCallback(async () => {
    try {
      await invoke("cancel_download");
    } catch (e) {
      console.error("Failed to cancel download:", e);
    }
    clearInfo();
  }, [clearInfo]);

  /**
   * Browse for folder
   */
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

  /**
   * Save acceleration config
   */
  const handleSaveAccelConfig = useCallback(async () => {
    await invoke("set_acceleration_config", { config: accelConfig });
  }, [accelConfig]);

  /**
   * Save all settings
   */
  const handleSaveAll = useCallback(async () => {
    await saveSettings();
    await handleSaveAccelConfig();
  }, [saveSettings, handleSaveAccelConfig]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background-dark">
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col items-center w-full">
        {activeTab === "youtube" && (
          <div className="w-full max-w-[800px] flex flex-col flex-1 px-4 py-8 md:px-8">
            {/* Headline */}
            <div className="pt-8 pb-6 text-center">
              <h1 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight mb-2">
                Download Video & Audio
              </h1>
              <p className="text-[#9dabb9] text-base">
                Paste a URL from YouTube, Vimeo, or other supported sites.
              </p>
            </div>

            {/* URL Input */}
            <UrlInput
              url={url}
              onUrlChange={setUrl}
              onDownload={handleDownload}
              isLoading={isLoading}
              disabled={isDownloading}
            />

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-8 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Download Card */}
            {(videoInfo || isDownloading) && (
              <DownloadCard
                videoInfo={videoInfo}
                progress={progress}
                isDownloading={isDownloading}
                onCancel={handleCancel}
                url={url}
              />
            )}

            {/* Empty state when no downloads */}
            {!videoInfo && !isDownloading && !error && (
              <div className="flex-1 flex flex-col items-center justify-center text-[#637588] py-16">
                <span className="material-symbols-outlined text-6xl mb-4 opacity-30">download</span>
                <p className="text-sm">Your downloads will appear here</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="w-full max-w-[800px] flex flex-col flex-1 px-4 py-8 md:px-8">
            <div className="pt-8 pb-6">
              <h1 className="text-3xl font-bold mb-2">Settings</h1>
              <p className="text-[#9dabb9]">Configure download options</p>
            </div>

            {/* General Settings */}
            <div className="bg-surface-dark rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">folder</span>
                General
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#9dabb9]">Download Location</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={outputPath}
                      onChange={(e) => setOutputPath(e.target.value)}
                      className="flex-1 bg-[#111418] border border-[#283039] rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="/path/to/downloads"
                    />
                    <button
                      onClick={handleBrowse}
                      className="px-4 py-3 bg-[#111418] border border-[#283039] rounded-lg hover:bg-[#283039] transition-colors"
                    >
                      <span className="material-symbols-outlined">folder_open</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-[#9dabb9]">Filename Template</label>
                  <select
                    value={settings.filename_template}
                    onChange={(e) => updateSettings({ filename_template: e.target.value })}
                    className="w-full bg-[#111418] border border-[#283039] rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary"

                  >
                    <option value="%(uploader)s/%(title)s.%(ext)s">Channel Folder / Title</option>
                    <option value="%(title)s.%(ext)s">Title Only</option>
                    <option value="%(upload_date)s - %(title)s.%(ext)s">Date - Title</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Download Booster Settings */}
            <div className="bg-surface-dark rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">bolt</span>
                Download Booster
                <div className="relative group flex items-center ml-1">
                  <span className="material-symbols-outlined text-[#5c6b7f] hover:text-primary transition-colors text-lg cursor-help">info</span>

                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-4 bg-[#1e2329] border border-[#283039] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ease-out transform translate-y-1 group-hover:translate-y-0 z-50">
                    <div className="font-bold text-white mb-2 text-sm flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-sm">rocket_launch</span>
                      Optimization Guide
                    </div>
                    <div className="space-y-2 text-xs text-[#9dabb9]">
                      <div className="flex justify-between">
                        <span className="text-primary font-medium">Fragments:</span>
                        <span className="text-right"><b>16</b> (Safe) — <b>32</b> (Fastest)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-primary font-medium">Split Size:</span>
                        <span className="text-right"><b>1M</b> (Default) — <b>5M</b> (4K+)</span>
                      </div>
                      <div className="pt-2 border-t border-[#283039] mt-2 italic text-[#5c6b7f]">
                        Use 16 connections to avoid YouTube temporary IP bans.
                      </div>
                    </div>
                    {/* Arrow */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#283039]"></div>
                  </div>
                </div>
              </h2>

              <div className="space-y-4">
                {/* Enable toggle */}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">Enable Speed Boost</span>
                  <input
                    type="checkbox"
                    checked={accelConfig.enabled}
                    onChange={(e) => setAccelConfig({ ...accelConfig, enabled: e.target.checked })}
                    className="w-5 h-5 rounded bg-[#111418] border-[#283039] text-primary focus:ring-primary focus:ring-offset-0"
                  />
                </label>

                {/* Use aria2c */}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">Use aria2c (faster downloads)</span>
                  <input
                    type="checkbox"
                    checked={accelConfig.use_aria2c}
                    onChange={(e) => setAccelConfig({ ...accelConfig, use_aria2c: e.target.checked })}
                    className="w-5 h-5 rounded bg-[#111418] border-[#283039] text-primary focus:ring-primary focus:ring-offset-0"
                  />
                </label>

                {/* Smart Mode */}
                <label className="flex items-center justify-between cursor-pointer p-3 bg-[#1e2329] border border-[#283039] rounded-lg">
                  <div>
                    <span className="block text-sm font-medium text-white">Smart Mode</span>
                    <span className="block text-xs text-primary mt-0.5">Auto-optimizes for speed & large files</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={accelConfig.smart_mode}
                    onChange={(e) => setAccelConfig({ ...accelConfig, smart_mode: e.target.checked })}
                    className="w-5 h-5 rounded bg-[#111418] border-[#283039] text-primary focus:ring-primary focus:ring-offset-0"
                  />
                </label>

                {!accelConfig.smart_mode && (
                  <>
                    {/* Concurrent Fragments */}
                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-sm text-[#9dabb9]">Concurrent Fragments</label>
                        <span className="text-sm font-medium">{accelConfig.max_concurrent_fragments}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="32"
                        step="1"
                        value={accelConfig.max_concurrent_fragments}
                        onChange={(e) => setAccelConfig({ ...accelConfig, max_concurrent_fragments: parseInt(e.target.value) })}
                        className="w-full h-2 bg-[#111418] rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <div className="flex justify-between text-xs text-[#9dabb9] mt-1">
                        <span>1</span>
                        <span>32</span>
                      </div>
                    </div>

                    {/* Min Split Size */}
                    <div>
                      <label className="block text-sm text-[#9dabb9] mb-2">Aria2 Min Split Size (e.g. 1M)</label>
                      <input
                        type="text"
                        value={accelConfig.aria2_min_split_size || "1M"}
                        onChange={(e) => setAccelConfig({ ...accelConfig, aria2_min_split_size: e.target.value })}
                        className="w-full bg-[#111418] border border-[#283039] rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="1M"
                      />
                    </div>
                  </>
                )}

                {/* Min File Size */}
                <div>
                  <label className="block text-sm text-[#9dabb9] mb-2">Min File Size for Boost (MB)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={accelConfig.min_file_size_mb}
                    onChange={(e) => setAccelConfig({ ...accelConfig, min_file_size_mb: parseInt(e.target.value) || 10 })}
                    className="w-full bg-[#111418] border border-[#283039] rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Throttle Protection */}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">Throttle Protection (prevents bans)</span>
                  <input
                    type="checkbox"
                    checked={accelConfig.use_throttle_protection}
                    onChange={(e) => setAccelConfig({ ...accelConfig, use_throttle_protection: e.target.checked })}
                    className="w-5 h-5 rounded bg-[#111418] border-[#283039] text-primary focus:ring-primary focus:ring-offset-0"
                  />
                </label>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveAll}
              className="w-full py-3 bg-primary hover:bg-blue-600 rounded-lg font-medium transition-colors"
            >
              Save Settings
            </button>
          </div>
        )}

        {activeTab === "downloads" && (
          <div className="w-full max-w-[800px] flex flex-col flex-1 px-4 py-8 md:px-8">
            <div className="pt-8 pb-6">
              <h1 className="text-3xl font-bold mb-2">Downloads</h1>
              <p className="text-[#9dabb9]">Your download history</p>
            </div>

            {/* Empty state */}
            <div className="flex-1 flex flex-col items-center justify-center text-[#637588] py-16">
              <span className="material-symbols-outlined text-6xl mb-4 opacity-30">folder_open</span>
              <p className="text-sm">No downloads yet</p>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default App;
