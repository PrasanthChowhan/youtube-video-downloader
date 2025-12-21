/**
 * Queue Item Component
 * Displays a single item in the download queue
 */
import React from "react";
import { ManagerQueueItem as QueueItemType } from "../types";

interface QueueItemProps {
    item: QueueItemType;
    onRemove: (id: string) => void;
    isCurrentlyDownloading?: boolean;
    progress?: number;
}

const formatBytes = (bytes: number | null): string => {
    if (bytes === null || bytes === 0) return "";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const getStatusBadge = (status: string) => {
    switch (status) {
        case "queued":
            return (
                <span className="px-2 py-0.5 text-xs rounded-full bg-gray-500/20 text-gray-400">
                    Queued
                </span>
            );
        case "downloading":
            return (
                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400 animate-pulse">
                    Downloading
                </span>
            );
        case "completed":
            return (
                <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">
                    Completed
                </span>
            );
        case "failed":
            return (
                <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400">
                    Failed
                </span>
            );
        case "cancelled":
            return (
                <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400">
                    Cancelled
                </span>
            );
        case "fetching_metadata":
            return (
                <div className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-400">
                    <span className="w-2 h-2 rounded-full border border-blue-400 border-t-transparent animate-spin" />
                    <span>Loading...</span>
                </div>
            );
        default:
            return null;
    }
};

export const QueueItemComponent: React.FC<QueueItemProps> = ({
    item,
    onRemove,
    isCurrentlyDownloading = false,
    progress = 0,
}) => {
    const isDisabled = item.status === "completed" || item.status === "failed" || item.status === "cancelled";

    return (
        <div
            className={`flex items-center gap-4 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)] transition-colors group ${isDisabled ? "opacity-60" : ""
                }`}
        >
            {/* Thumbnail */}
            <div className="relative w-20 h-12 rounded overflow-hidden flex-shrink-0 bg-[var(--color-surface-muted)]">
                {item.thumbnail ? (
                    <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className={`w-full h-full flex items-center justify-center ${item.status === 'fetching_metadata' ? 'animate-pulse' : ''}`}>
                        <span className="material-symbols-outlined text-2xl text-[var(--color-text-muted)]">movie</span>
                    </div>
                )}
                {/* Progress overlay when downloading */}
                {isCurrentlyDownloading && (
                    <div
                        className="absolute bottom-0 left-0 h-1 bg-primary transition-all"
                        style={{ width: `${progress}%` }}
                    />
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-[var(--color-text-primary)] truncate">{item.title}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[var(--color-text-muted)] truncate">{item.uploader}</span>
                    {item.duration_string && (
                        <>
                            <span className="text-[var(--color-text-muted)]">•</span>
                            <span className="text-xs text-[var(--color-text-muted)]">{item.duration_string}</span>
                        </>
                    )}
                    {item.filesize_approx && (
                        <>
                            <span className="text-[var(--color-text-muted)]">•</span>
                            <span className="text-xs text-[var(--color-text-muted)]">{formatBytes(item.filesize_approx)}</span>
                        </>
                    )}
                </div>
                {item.error && (
                    <p className="text-xs text-red-400 mt-1 truncate">{item.error}</p>
                )}
            </div>

            {/* Status Badge */}
            <div className="flex-shrink-0">
                {getStatusBadge(item.status)}
            </div>

            {/* Remove button - for queued, fetching, or completed/failed items */}
            <button
                onClick={() => onRemove(item.id)}
                className="flex-shrink-0 p-1.5 text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="Remove from queue"
            >
                <span className="material-symbols-outlined text-lg">close</span>
            </button>
        </div>
    );
};
