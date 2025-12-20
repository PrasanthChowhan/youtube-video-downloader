/** Download card component showing progress */

import type { VideoInfo, DownloadProgress } from "../types";
import { formatBytes } from "../utils/formatters";

interface DownloadCardProps {
    videoInfo: VideoInfo | null;
    progress: DownloadProgress | null;
    isDownloading: boolean;
    onCancel?: () => void;
}

export const DownloadCard: React.FC<DownloadCardProps> = ({
    videoInfo,
    progress,
    isDownloading,
    onCancel,
}) => {
    if (!videoInfo && !isDownloading) return null;

    const title = videoInfo?.title || "Preparing download...";
    const thumbnail = videoInfo?.thumbnail;
    const format = "MP4 • 1080p";

    return (
        <div className="bg-surface-dark rounded-xl p-5 mb-8 shadow-sm border border-[#283039]">
            <div className="flex items-start gap-4">
                {/* Thumbnail */}
                <div
                    className="w-24 h-16 bg-[#111418] rounded-lg bg-cover bg-center shrink-0 relative overflow-hidden group flex items-center justify-center"
                    style={thumbnail ? { backgroundImage: `url('${thumbnail}')` } : {}}
                >
                    {!thumbnail && (
                        <span className="material-symbols-outlined text-[#637588] text-3xl">smart_display</span>
                    )}
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="font-medium text-sm leading-tight truncate pr-4">{title}</h3>
                            <p className="text-[#9dabb9] text-xs mt-1">{format}</p>
                        </div>
                        {onCancel && (
                            <button
                                onClick={onCancel}
                                className="text-[#9dabb9] hover:text-white transition-colors"
                            >
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        )}
                    </div>

                    {/* Progress Bar */}
                    {(isDownloading || progress) && (
                        <>
                            <div className="relative w-full h-2 bg-[#3b4754] rounded-full overflow-hidden mb-2">
                                <div
                                    className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-300"
                                    style={{ width: `${progress?.percent || 0}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-xs text-[#9dabb9]">
                                <span className="font-medium text-primary">
                                    {progress?.status === "finished"
                                        ? "Complete!"
                                        : progress?.status === "merging"
                                            ? "Merging..."
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
