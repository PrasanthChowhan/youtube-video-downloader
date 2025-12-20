/** Video popup modal component */

import type { VideoInfo, DownloadProgress, DownloadMode } from "../types";
import { formatBytes } from "../utils/formatters";
import { ProgressBar } from "./ProgressBar";

interface VideoPopupProps {
    isOpen: boolean;
    onClose: () => void;
    onDownload: () => void;
    onBrowse: () => void;
    videoInfo: VideoInfo | null;
    outputPath: string;
    onOutputPathChange: (path: string) => void;
    isLoading: boolean;
    isDownloading: boolean;
    progress: DownloadProgress | null;
    error: string | null;
    downloadMode: DownloadMode;
    url: string;
}

export const VideoPopup: React.FC<VideoPopupProps> = ({
    isOpen,
    onClose,
    onDownload,
    onBrowse,
    videoInfo,
    outputPath,
    onOutputPathChange,
    isLoading,
    isDownloading,
    progress,
    error,
    downloadMode,
    url,
}) => {
    if (!isOpen) return null;

    return (
        <div className="popup-overlay" onClick={() => !isDownloading && onClose()}>
            <div className="popup-modal" onClick={(e) => e.stopPropagation()}>
                <div className="popup-header">
                    <h2>Download Video</h2>
                    <button className="btn-close" onClick={onClose} disabled={isDownloading}>×</button>
                </div>

                <div className="popup-content">
                    {isLoading ? (
                        <div className="loading-state">
                            <div className="spinner" />
                            <p>Parsing URL...</p>
                        </div>
                    ) : error ? (
                        <div className="error-state">
                            <span className="error-icon">⚠️</span>
                            <p>{error}</p>
                            <button onClick={onClose} className="btn-secondary">Close</button>
                        </div>
                    ) : videoInfo ? (
                        <>
                            <div className="video-info-row">
                                {videoInfo.thumbnail && <img src={videoInfo.thumbnail} alt="" className="video-thumb" />}
                                <div className="video-details">
                                    <h3 className="video-title">{videoInfo.title}</h3>
                                    <div className="video-meta">
                                        {videoInfo.uploader && <span>📺 {videoInfo.uploader}</span>}
                                        {videoInfo.duration_string && <span>⏱️ {videoInfo.duration_string}</span>}
                                        {videoInfo.filesize_approx && <span>📦 ~{formatBytes(videoInfo.filesize_approx)}</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="output-row">
                                <input type="text" value={outputPath} onChange={(e) => onOutputPathChange(e.target.value)} placeholder="Output folder..." className="path-input" />
                                <button onClick={onBrowse} className="btn-browse">📁</button>
                            </div>

                            {isDownloading && progress && <ProgressBar progress={progress} />}
                        </>
                    ) : downloadMode === "direct" ? (
                        <div className="direct-download-info">
                            <span className="direct-icon">⬇️</span>
                            <p>Direct download: {url}</p>
                            <div className="output-row">
                                <input type="text" value={outputPath} onChange={(e) => onOutputPathChange(e.target.value)} placeholder="Output folder..." className="path-input" />
                                <button onClick={onBrowse} className="btn-browse">📁</button>
                            </div>
                        </div>
                    ) : null}
                </div>

                <div className="popup-footer">
                    <button onClick={onClose} className="btn-cancel" disabled={isDownloading}>Cancel</button>
                    <button onClick={onDownload} className="btn-download" disabled={isDownloading || isLoading || (!videoInfo && downloadMode !== "direct")}>
                        {isDownloading ? "Downloading..." : "Download"}
                    </button>
                </div>
            </div>
        </div>
    );
};
