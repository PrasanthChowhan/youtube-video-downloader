/**
 * Download history item component
 * Displays a single download record with actions
 */

import type { DownloadRecord } from "../types";

interface DownloadHistoryItemProps {
    record: DownloadRecord;
    onOpenFile?: (path: string) => void;
    onOpenFolder?: (path: string) => void;
    onDelete?: (id: string) => void;
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number | null): string {
    if (!bytes) return "Unknown size";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
        size /= 1024;
        i++;
    }
    return `${size.toFixed(1)} ${units[i]}`;
}

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp * 1000; // timestamp is in seconds

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return new Date(timestamp * 1000).toLocaleDateString();
}

export const DownloadHistoryItem: React.FC<DownloadHistoryItemProps> = ({
    record,
    onOpenFile,
    onOpenFolder,
    onDelete,
}) => {
    const isDisabled = record.status === "cancelled" || record.status === "failed" || record.status === "file_not_found";

    return (
        <div
            className={`group flex items-center gap-4 p-4 rounded-xl border border-[#283039] bg-surface-dark/50 transition-all hover:border-primary/30 ${isDisabled ? "opacity-50" : ""
                }`}
        >
            {/* Thumbnail */}
            <div className="relative w-24 h-14 rounded-lg overflow-hidden bg-[#111418] shrink-0">
                {record.thumbnail ? (
                    <img
                        src={record.thumbnail}
                        alt={record.title}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#637588]">
                        <span className="material-symbols-outlined">movie</span>
                    </div>
                )}

                {/* Status badge */}
                {isDisabled && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-xs font-medium text-[#9dabb9] capitalize">
                            {record.status === "file_not_found" ? "File deleted" : record.status}
                        </span>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <h4 className={`font-medium text-sm truncate ${isDisabled ? "text-[#637588]" : "text-white"}`}>
                    {record.title}
                </h4>
                <p className="text-xs text-[#637588] truncate">
                    {record.uploader}
                </p>
                <p className="text-xs text-[#5c6b7f] mt-1">
                    {formatBytes(record.file_size)} • {formatRelativeTime(record.created_at)}
                </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Open file - only if file path exists and status is completed */}
                {record.file_path && record.status === "completed" && onOpenFile && (
                    <button
                        onClick={() => onOpenFile(record.file_path!)}
                        className="p-2 text-[#9dabb9] hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Open file"
                    >
                        <span className="material-symbols-outlined text-[20px]">play_circle</span>
                    </button>
                )}

                {/* Open in folder - show for completed downloads with file path */}
                {record.file_path && record.status === "completed" && onOpenFolder && (
                    <button
                        onClick={() => onOpenFolder(record.file_path!)}
                        className="p-2 text-[#9dabb9] hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Open in folder"
                    >
                        <span className="material-symbols-outlined text-[20px]">folder_open</span>
                    </button>
                )}

                {/* Delete from history */}
                {onDelete && (
                    <button
                        onClick={() => onDelete(record.id)}
                        className="p-2 text-[#9dabb9] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Remove from history"
                    >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                )}
            </div>
        </div>
    );
};
