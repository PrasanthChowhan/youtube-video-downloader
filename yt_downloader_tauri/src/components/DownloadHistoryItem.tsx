/**
 * Download history item component
 * Displays a single download record with actions
 */

import { useState, useMemo } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { DownloadRecord } from "../types";
import {
    YouTubeIcon,
    InstagramIcon,
    MovieIcon,
    PlayCircleIcon,
    FolderOpenIcon,
    DeleteIcon
} from "./Icons";

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

/**
 * Get platform icon component
 */
function PlatformBadge({ platform }: { platform: string }) {
    if (platform === "youtube") {
        return (
            <div className="absolute bottom-1 right-1 p-1 bg-red-600 rounded" title="YouTube">
                <YouTubeIcon size={12} className="text-white" />
            </div>
        );
    }
    if (platform === "instagram") {
        return (
            <div className="absolute bottom-1 right-1 p-1 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 rounded" title="Instagram">
                <InstagramIcon size={12} className="text-white" />
            </div>
        );
    }
    return null;
}

export const DownloadHistoryItem: React.FC<DownloadHistoryItemProps> = ({
    record,
    onOpenFile,
    onOpenFolder,
    onDelete,
}) => {
    const isDisabled = record.status === "cancelled" || record.status === "failed" || record.status === "file_not_found";
    const [imageError, setImageError] = useState(false);

    // Convert local file paths to Tauri asset URLs
    const thumbnailSrc = useMemo(() => {
        if (!record.thumbnail) return null;
        // If it's a local file path (starts with drive letter or /), convert it
        if (record.thumbnail.match(/^[A-Za-z]:\\/) || record.thumbnail.startsWith("/")) {
            return convertFileSrc(record.thumbnail);
        }
        // Otherwise, it's a URL - use as-is
        return record.thumbnail;
    }, [record.thumbnail]);

    return (
        <div
            className={`group flex items-center gap-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-all hover:border-primary/30 ${isDisabled ? "opacity-50" : ""
                }`}
        >
            {/* Thumbnail */}
            <div className="relative w-24 h-14 rounded-lg overflow-hidden bg-[var(--color-surface-muted)] shrink-0">
                {thumbnailSrc && !imageError ? (
                    <img
                        src={thumbnailSrc}
                        alt={record.title}
                        className="w-full h-full object-cover"
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
                        <MovieIcon size={24} />
                    </div>
                )}

                {/* Platform badge */}
                <PlatformBadge platform={record.platform || "youtube"} />

                {/* Status badge */}
                {isDisabled && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-xs font-medium text-[var(--color-text-secondary)] capitalize">
                            {record.status === "file_not_found" ? "File deleted" : record.status}
                        </span>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <h4 className={`font-medium text-sm truncate ${isDisabled ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]"}`}>
                    {record.title}
                </h4>
                <p className="text-xs text-[var(--color-text-muted)] truncate">
                    {record.uploader}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {formatBytes(record.file_size)} • {formatRelativeTime(record.created_at)}
                </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Open file - only if file path exists and status is completed */}
                {record.file_path && record.status === "completed" && onOpenFile && (
                    <button
                        onClick={() => onOpenFile(record.file_path!)}
                        className="p-2 text-[var(--color-text-muted)] hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Open file"
                    >
                        <PlayCircleIcon size={20} />
                    </button>
                )}

                {/* Open in folder - show for completed downloads with file path */}
                {record.file_path && record.status === "completed" && onOpenFolder && (
                    <button
                        onClick={() => onOpenFolder(record.file_path!)}
                        className="p-2 text-[var(--color-text-muted)] hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Open in folder"
                    >
                        <FolderOpenIcon size={20} />
                    </button>
                )}

                {/* Delete from history */}
                {onDelete && (
                    <button
                        onClick={() => onDelete(record.id)}
                        className="p-2 text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Remove from history"
                    >
                        <DeleteIcon size={20} />
                    </button>
                )}
            </div>
        </div>
    );
};
