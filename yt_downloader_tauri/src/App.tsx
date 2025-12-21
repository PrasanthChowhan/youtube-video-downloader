/**
 * VideoGet - Main App Component
 */

import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSettings, useDownloadHistory, useDownloadManager, useTheme } from "./hooks";
import type { ThemeOption } from "./hooks";
import { UrlInput, BottomNav, DownloadHistoryItem, SortableQueueItem } from "./components";
import type { AccelerationConfig, CommandResponse, Platform } from "./types";
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

  // Platform filter state
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");

  // Hooks
  const { settings, outputPath, setOutputPath, updateSettings, saveSettings } = useSettings();
  const { records, isLoading: historyLoading, fetchHistory, deleteRecord, clearHistory, openFile, openInFolder } = useDownloadHistory();
  const { theme, setTheme } = useTheme();

  // Download manager with concurrent downloads
  const {
    queue: managerQueue,
    isLoading: managerLoading,
    error,
    downloadingCount,
    queuedCount,
    addToQueue: managerAddToQueue,
    removeFromQueue: managerRemoveFromQueue,
    reorderQueue,
    cancelDownload,
  } = useDownloadManager();

  // Load acceleration config on mount
  useEffect(() => {
    invoke<CommandResponse<AccelerationConfig>>("get_acceleration_config").then((res) => {
      if (res.success && res.data) {
        setAccelConfig(res.data);
      }
    });
  }, []);

  // Listen for history updates from queue
  useEffect(() => {
    const unlisten = listen("history-updated", () => {
      fetchHistory();
    });
    return () => { unlisten.then(fn => fn()); };
  }, [fetchHistory]);

  /**
   * Handle drag end for queue reordering
   */
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = managerQueue.findIndex(item => item.id === active.id);
      const newIndex = managerQueue.findIndex(item => item.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderQueue(active.id as string, newIndex);
      }
    }
  }, [managerQueue, reorderQueue]);

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
   * Handle download button click (Add to Queue)
   */
  const handleDownload = useCallback(async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    const result = await managerAddToQueue(trimmedUrl);
    if (result) {
      setUrl("");
    }
  }, [url, managerAddToQueue]);

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
    <div className="container mx-auto h-screen flex flex-col bg-transparent text-[var(--color-text-primary)] selection:bg-primary/30">
      {/* Animated Background */}
      <div className="animated-bg">
        <div className="floating-orb"></div>
        <div className="floating-orb"></div>
        <div className="floating-orb"></div>
        <div className="floating-orb"></div>
        <div className="floating-orb"></div>
      </div>

      <div className="flex flex-1 overflow-hidden">


        {/* Main Content */}
        <main className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col items-center">

          {activeTab === "youtube" && (
            <div className="w-full max-w-[800px] flex flex-col flex-1 px-4 py-8 md:px-8">
              {/* Headline */}
              <div className="pt-8 pb-6 text-center">
                <h1 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight mb-2 text-[var(--color-text-primary)]">
                  Download Video & Audio
                </h1>
                <p className="text-[var(--color-text-secondary)] text-base">
                  Paste a URL from YouTube, Vimeo, or other supported sites.
                </p>
              </div>

              {/* URL Input */}
              <div className="flex flex-col gap-3 mb-8">
                <UrlInput
                  url={url}
                  onUrlChange={setUrl}
                  onDownload={handleDownload}
                  isLoading={managerLoading}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-8 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Empty state when no downloads */}
              {managerQueue.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-muted)] py-16">
                  <span className="material-symbols-outlined text-6xl mb-4 opacity-30">download</span>
                  <p className="text-sm">Your downloads will appear here</p>
                </div>
              )}

              {/* Download Queue Section (New Manager) */}
              {managerQueue.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Download Queue</h3>
                      {downloadingCount > 0 && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400">
                          {downloadingCount} downloading
                        </span>
                      )}
                      {queuedCount > 0 && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary">
                          {queuedCount} queued
                        </span>
                      )}
                    </div>
                  </div>
                  <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={managerQueue.map(i => i.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {managerQueue.map((item) => (
                          <SortableQueueItem
                            key={item.id}
                            item={item}
                            onRemove={managerRemoveFromQueue}
                            onCancel={cancelDownload}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </div>
          )}

          {activeTab === "settings" && (
            <div className="w-full max-w-[800px] flex flex-col flex-1 px-4 py-8 md:px-8">
              <div className="pt-8 pb-6">
                <h1 className="text-3xl font-bold mb-2 text-[var(--color-text-primary)]">Settings</h1>
                <p className="text-[var(--color-text-secondary)]">Configure download options</p>
              </div>

              {/* Appearance Settings */}
              <div className="glass-card p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--color-text-primary)]">
                  <span className="material-symbols-outlined text-primary">palette</span>
                  Appearance
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[var(--color-text-secondary)]">Theme</label>
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as ThemeOption)}
                      className="w-full bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                    >
                      <option value="system">Default (System)</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                    <p className="text-xs text-[var(--color-text-muted)] mt-2">
                      Choose your preferred color theme or follow system settings
                    </p>
                  </div>
                </div>
              </div>

              {/* General Settings */}
              <div className="glass-card p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--color-text-primary)]">
                  <span className="material-symbols-outlined text-primary">folder</span>
                  General
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[var(--color-text-secondary)]">Download Location</label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={outputPath}
                        onChange={(e) => setOutputPath(e.target.value)}
                        className="flex-1 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                        placeholder="/path/to/downloads"
                      />
                      <button
                        onClick={handleBrowse}
                        className="px-4 py-3 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-elevated)] transition-colors text-[var(--color-text-primary)]"
                      >
                        <span className="material-symbols-outlined">folder_open</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-[var(--color-text-secondary)]">Filename Template</label>
                    <select
                      value={settings.filename_template}
                      onChange={(e) => updateSettings({ filename_template: e.target.value })}
                      className="w-full bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                    >
                      <option value="%(uploader)s/%(title)s.%(ext)s">Channel Folder / Title</option>
                      <option value="%(title)s.%(ext)s">Title Only</option>
                      <option value="%(upload_date)s - %(title)s.%(ext)s">Date - Title</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Download Booster Settings */}
              <div className="glass-card p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--color-text-primary)]">
                  <span className="material-symbols-outlined text-primary">bolt</span>
                  Download Booster
                  <div className="relative group flex items-center ml-1">
                    <span className="material-symbols-outlined text-[var(--color-text-muted)] hover:text-primary transition-colors text-lg cursor-help">info</span>

                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-4 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ease-out transform translate-y-1 group-hover:translate-y-0 z-50">
                      <div className="font-bold text-[var(--color-text-primary)] mb-2 text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-sm">rocket_launch</span>
                        Optimization Guide
                      </div>
                      <div className="space-y-2 text-xs text-[var(--color-text-secondary)]">
                        <div className="flex justify-between">
                          <span className="text-primary font-medium">Fragments:</span>
                          <span className="text-right"><b>16</b> (Safe) — <b>32</b> (Fastest)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-primary font-medium">Split Size:</span>
                          <span className="text-right"><b>1M</b> (Default) — <b>5M</b> (4K+)</span>
                        </div>
                        <div className="pt-2 border-t border-[var(--color-border)] mt-2 italic text-[var(--color-text-muted)]">
                          Use 16 connections to avoid YouTube temporary IP bans.
                        </div>
                      </div>
                      {/* Arrow */}
                      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[var(--color-border)]"></div>
                    </div>
                  </div>
                </h2>

                <div className="space-y-4">
                  {/* Enable toggle */}
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-[var(--color-text-primary)]">Enable Speed Boost</span>
                    <input
                      type="checkbox"
                      checked={accelConfig.enabled}
                      onChange={(e) => setAccelConfig({ ...accelConfig, enabled: e.target.checked })}
                      className="w-5 h-5 rounded bg-[var(--color-surface-muted)] border-[var(--color-border)] text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>

                  {/* Use aria2c */}
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-[var(--color-text-primary)]">Use aria2c (faster downloads)</span>
                    <input
                      type="checkbox"
                      checked={accelConfig.use_aria2c}
                      onChange={(e) => setAccelConfig({ ...accelConfig, use_aria2c: e.target.checked })}
                      className="w-5 h-5 rounded bg-[var(--color-surface-muted)] border-[var(--color-border)] text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>

                  {/* Smart Mode */}
                  <label className="flex items-center justify-between cursor-pointer p-3 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-lg">
                    <div>
                      <span className="block text-sm font-medium text-[var(--color-text-primary)]">Smart Mode</span>
                      <span className="block text-xs text-primary mt-0.5">Auto-optimizes for speed & large files</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={accelConfig.smart_mode}
                      onChange={(e) => setAccelConfig({ ...accelConfig, smart_mode: e.target.checked })}
                      className="w-5 h-5 rounded bg-[var(--color-surface-muted)] border-[var(--color-border)] text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>

                  {!accelConfig.smart_mode && (
                    <>
                      {/* Concurrent Fragments */}
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-sm text-[var(--color-text-secondary)]">Concurrent Fragments</label>
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">{accelConfig.max_concurrent_fragments}</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="32"
                          step="1"
                          value={accelConfig.max_concurrent_fragments}
                          onChange={(e) => setAccelConfig({ ...accelConfig, max_concurrent_fragments: parseInt(e.target.value) })}
                          className="w-full h-2 bg-[var(--color-surface-muted)] rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
                          <span>1</span>
                          <span>32</span>
                        </div>
                      </div>

                      {/* Min Split Size */}
                      <div>
                        <label className="block text-sm text-[var(--color-text-secondary)] mb-2">Aria2 Min Split Size (e.g. 1M)</label>
                        <input
                          type="text"
                          value={accelConfig.aria2_min_split_size || "1M"}
                          onChange={(e) => setAccelConfig({ ...accelConfig, aria2_min_split_size: e.target.value })}
                          className="w-full bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                          placeholder="1M"
                        />
                      </div>
                    </>
                  )}

                  {/* Min File Size */}
                  <div>
                    <label className="block text-sm text-[var(--color-text-secondary)] mb-2">Min File Size for Boost (MB)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={accelConfig.min_file_size_mb}
                      onChange={(e) => setAccelConfig({ ...accelConfig, min_file_size_mb: parseInt(e.target.value) || 10 })}
                      className="w-full bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                    />
                  </div>

                  {/* Throttle Protection */}
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-[var(--color-text-primary)]">Throttle Protection (prevents bans)</span>
                    <input
                      type="checkbox"
                      checked={accelConfig.use_throttle_protection}
                      onChange={(e) => setAccelConfig({ ...accelConfig, use_throttle_protection: e.target.checked })}
                      className="w-5 h-5 rounded bg-[var(--color-surface-muted)] border-[var(--color-border)] text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveAll}
                className="w-full py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded-lg font-medium transition-colors"
              >
                Save Settings
              </button>
            </div>
          )}

          {activeTab === "downloads" && (
            <div className="w-full max-w-[800px] flex flex-col flex-1 px-4 py-8 md:px-8">
              <div className="pt-8 pb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold mb-2 text-[var(--color-text-primary)]">Downloads</h1>
                  <p className="text-[var(--color-text-secondary)]">Your download history</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchHistory}
                    className="p-2 text-[var(--color-text-muted)] hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    title="Refresh"
                  >
                    <span className="material-symbols-outlined">refresh</span>
                  </button>
                  {records.length > 0 && (
                    <button
                      onClick={clearHistory}
                      className="p-2 text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      title="Clear all history"
                    >
                      <span className="material-symbols-outlined">delete_sweep</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setPlatformFilter("all")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${platformFilter === "all"
                    ? "bg-primary text-[var(--color-text-on-accent)]"
                    : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]"
                    }`}
                >
                  All
                </button>
                <button
                  onClick={() => setPlatformFilter("youtube")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${platformFilter === "youtube"
                    ? "bg-red-600 text-white"
                    : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]"
                    }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                  YouTube
                </button>
                <button
                  onClick={() => setPlatformFilter("instagram")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${platformFilter === "instagram"
                    ? "bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white"
                    : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]"
                    }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                  Instagram
                </button>
              </div>

              {historyLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
                </div>
              ) : records.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-muted)] py-16">
                  <span className="material-symbols-outlined text-6xl mb-4 opacity-30">folder_open</span>
                  <p className="text-sm">No downloads yet</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {records
                    .filter(record => platformFilter === "all" || (record.platform || "youtube") === platformFilter)
                    .map((record) => (
                      <DownloadHistoryItem
                        key={record.id}
                        record={record}
                        onOpenFile={openFile}
                        onOpenFolder={openInFolder}
                        onDelete={deleteRecord}
                      />
                    ))}
                </div>
              )}
            </div>
          )}
        </main>

      </div>
      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default App;
