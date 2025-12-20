/**
 * VideoGet - Main App Component
 */

import { useState, useCallback } from "react";
import { useSettings, useVideoInfo, useDownload } from "./hooks";
import { Header, UrlInput, DownloadCard, BottomNav, RecentDownloads } from "./components";
import "./App.css";

type Tab = "settings" | "youtube" | "downloads";

function App() {
  const [url, setUrl] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("youtube");

  // Hooks
  const { settings, outputPath, setOutputPath, saveSettings } = useSettings();
  const { videoInfo, isLoading, error, fetchInfo, clearInfo } = useVideoInfo();
  const { progress, isDownloading, startDownload } = useDownload();

  // Sample recent downloads (will be replaced with actual data)
  const recentDownloads = [
    { id: "1", title: "Lofi Hip Hop Radio - Beats to Relax/Study to", type: "audio" as const, size: "45.2 MB", time: "Just now" },
    { id: "2", title: "Complete Blender 3.0 Tutorial for Beginners", type: "video" as const, size: "1.2 GB", time: "2 hours ago" },
  ];

  /**
   * Handle download button click
   */
  const handleDownload = useCallback(async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    // First fetch video info
    await fetchInfo(trimmedUrl);

    // Then start download
    await startDownload(trimmedUrl, outputPath, "youtube", settings.filename_template);
  }, [url, outputPath, settings.filename_template, fetchInfo, startDownload]);

  /**
   * Cancel current download
   */
  const handleCancel = useCallback(() => {
    clearInfo();
  }, [clearInfo]);

  /**
   * Switch tabs
   */
  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <Header />

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
              />
            )}

            {/* Recent Downloads */}
            <RecentDownloads
              downloads={recentDownloads}
              onViewAll={() => setActiveTab("downloads")}
            />
          </div>
        )}

        {activeTab === "settings" && (
          <div className="w-full max-w-[800px] flex flex-col flex-1 px-4 py-8 md:px-8">
            <div className="pt-8 pb-6">
              <h1 className="text-3xl font-bold mb-2">Settings</h1>
              <p className="text-[#9dabb9]">Configure download options</p>
            </div>

            <div className="bg-surface-dark rounded-xl p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Download Location</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    className="flex-1 bg-[#111418] border border-[#283039] rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="/path/to/downloads"
                  />
                  <button className="px-4 py-3 bg-[#111418] border border-[#283039] rounded-lg hover:bg-[#283039] transition-colors">
                    <span className="material-symbols-outlined">folder_open</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Filename Template</label>
                <select
                  value={settings.filename_template}
                  className="w-full bg-[#111418] border border-[#283039] rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="%(uploader)s/%(title)s.%(ext)s">Channel Folder / Title</option>
                  <option value="%(title)s.%(ext)s">Title Only</option>
                  <option value="%(upload_date)s - %(title)s.%(ext)s">Date - Title</option>
                </select>
              </div>

              <button
                onClick={saveSettings}
                className="w-full py-3 bg-primary hover:bg-blue-600 rounded-lg font-medium transition-colors"
              >
                Save Settings
              </button>
            </div>
          </div>
        )}

        {activeTab === "downloads" && (
          <div className="w-full max-w-[800px] flex flex-col flex-1 px-4 py-8 md:px-8">
            <div className="pt-8 pb-6">
              <h1 className="text-3xl font-bold mb-2">Downloads</h1>
              <p className="text-[#9dabb9]">Your download history</p>
            </div>

            <RecentDownloads downloads={recentDownloads} />
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
}

export default App;
