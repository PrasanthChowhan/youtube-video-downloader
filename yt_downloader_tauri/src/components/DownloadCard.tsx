/** Download card component showing progress */

import type { VideoInfo, DownloadProgress } from "../types";
import { formatBytes } from "../utils/formatters";

interface DownloadCardProps {
    videoInfo: VideoInfo | null;
    progress: DownloadProgress | null;
    isDownloading: boolean;
    onCancel?: () => void;
    url?: string;
}

/**
 * Extract file extension from URL for direct downloads
 */
function getFileTypeFromUrl(url: string): string {
    try {
        const pathname = new URL(url).pathname;
        const ext = pathname.split('.').pop()?.toLowerCase();
        if (ext && ['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(ext)) {
            return ext.toUpperCase();
        }
        if (ext && ['mp3', 'wav', 'flac', 'aac', 'm4a'].includes(ext)) {
            return ext.toUpperCase() + ' Audio';
        }
        if (ext && ['iso', 'zip', 'tar', 'gz', '7z', 'rar'].includes(ext)) {
            return ext.toUpperCase() + ' Archive';
        }
    } catch {
        // Invalid URL
    }
    return 'File';
}

export const DownloadCard: React.FC<DownloadCardProps> = ({
    videoInfo,
    progress,
    isDownloading,
    onCancel,
    url = '',
}) => {
    if (!videoInfo && !isDownloading && !progress) return null;

    const title = videoInfo?.title || "Preparing download...";
    const thumbnail = videoInfo?.thumbnail;

    // Determine format based on source
    const format = videoInfo
        ? `MP4 • ${videoInfo.duration_string || 'Video'}`
        : url
            ? getFileTypeFromUrl(url)
            : 'Fetching...';

    return (
        <div className="glass-card p-5 mb-8">
            <div className="flex items-start gap-4">
                {/* Thumbnail */}
                <div
                    className="w-24 h-16 bg-[var(--color-surface-muted)] rounded-lg bg-cover bg-center shrink-0 relative overflow-hidden group flex items-center justify-center"
                    style={thumbnail ? { backgroundImage: `url('${thumbnail}')` } : {}}
                >
                    {!thumbnail && (
                        <span className="material-symbols-outlined text-[var(--color-text-muted)] text-3xl">
                            {url.includes('youtube') || url.includes('youtu.be') ? 'smart_display' : 'download'}
                        </span>
                    )}
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="font-medium text-sm leading-tight truncate pr-4 text-[var(--color-text-primary)]">{title}</h3>
                            <p className="text-[var(--color-text-secondary)] text-xs mt-1">{format}</p>
                        </div>
                        {onCancel && !progress?.status?.includes('finished') && (
                            <button
                                onClick={onCancel}
                                className="text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                                title="Cancel download"
                            >
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        )}
                    </div>

                    {/* Progress Bar */}
                    {(isDownloading || progress) && (
                        <>
                            <div className="relative w-full h-2 bg-[var(--color-surface-muted)] rounded-full overflow-hidden mb-2">
                                <div
                                    className={`absolute top-0 left-0 h-full rounded-full transition-all duration-300 ${progress?.status === 'finished' ? 'bg-green-500' : 'bg-primary'
                                        }`}
                                    style={{ width: `${progress?.percent || 0}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-xs text-[var(--color-text-secondary)]">
                                <span className={`font-medium ${progress?.status === 'finished' ? 'text-green-400' : 'text-primary'}`}>
                                    {progress?.status === "finished"
                                        ? "✓ Complete!"
                                        : progress?.status === "merging"
                                            ? "Merging files..."
                                            : `Downloading... ${progress?.speed || ""}`}
                                </span>
                                <span>
                                    {progress?.percent?.toFixed(0) || 0}%
                                    {progress?.downloaded_bytes ? ` • ${formatBytes(progress.downloaded_bytes)}` : ""}
                                    {progress?.total_bytes ? ` of ${formatBytes(progress.total_bytes)}` : ""}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
