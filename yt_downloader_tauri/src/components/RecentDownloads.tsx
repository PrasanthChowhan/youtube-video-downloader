/** Recent downloads list component */

interface RecentDownload {
    id: string;
    title: string;
    type: "audio" | "video";
    size: string;
    time: string;
}

interface RecentDownloadsProps {
    downloads: RecentDownload[];
    onOpenFolder?: (id: string) => void;
    onViewAll?: () => void;
}

export const RecentDownloads: React.FC<RecentDownloadsProps> = ({
    downloads,
    onOpenFolder,
    onViewAll,
}) => {
    if (downloads.length === 0) return null;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-1">
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">Recent Downloads</h3>
                {onViewAll && (
                    <button
                        onClick={onViewAll}
                        className="text-sm text-primary hover:text-[var(--color-accent-hover)] font-medium"
                    >
                        View All
                    </button>
                )}
            </div>

            {downloads.map((download) => (
                <div
                    key={download.id}
                    className="group flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-surface)] transition-colors cursor-default border border-transparent hover:border-[var(--color-border)]"
                >
                    <div className="flex items-center gap-4 overflow-hidden">
                        <div className="size-10 rounded-lg bg-[var(--color-surface)] flex items-center justify-center shrink-0 text-primary">
                            <span className="material-symbols-outlined">
                                {download.type === "audio" ? "music_note" : "movie"}
                            </span>
                        </div>
                        <div className="flex flex-col min-w-0">
                            <p className="font-medium text-sm truncate text-[var(--color-text-primary)] group-hover:text-primary transition-colors">
                                {download.title}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)]">
                                {download.type === "audio" ? "Audio MP3" : "Video MP4"} • {download.size} • {download.time}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onOpenFolder && (
                            <button
                                onClick={() => onOpenFolder(download.id)}
                                className="p-2 text-[var(--color-text-muted)] hover:text-primary transition-colors rounded-full hover:bg-[var(--color-surface-muted)]"
                            >
                                <span className="material-symbols-outlined text-[20px]">folder_open</span>
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
