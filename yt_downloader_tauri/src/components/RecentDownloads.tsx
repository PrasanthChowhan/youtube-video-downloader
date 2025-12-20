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
                <h3 className="text-base font-bold">Recent Downloads</h3>
                {onViewAll && (
                    <button
                        onClick={onViewAll}
                        className="text-sm text-primary hover:text-blue-400 font-medium"
                    >
                        View All
                    </button>
                )}
            </div>

            {downloads.map((download) => (
                <div
                    key={download.id}
                    className="group flex items-center justify-between p-3 rounded-lg hover:bg-surface-dark/50 transition-colors cursor-default border border-transparent hover:border-[#283039]"
                >
                    <div className="flex items-center gap-4 overflow-hidden">
                        <div className="size-10 rounded-lg bg-surface-dark flex items-center justify-center shrink-0 text-primary">
                            <span className="material-symbols-outlined">
                                {download.type === "audio" ? "music_note" : "movie"}
                            </span>
                        </div>
                        <div className="flex flex-col min-w-0">
                            <p className="font-medium text-sm truncate text-white group-hover:text-primary transition-colors">
                                {download.title}
                            </p>
                            <p className="text-xs text-[#9dabb9]">
                                {download.type === "audio" ? "Audio MP3" : "Video MP4"} • {download.size} • {download.time}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onOpenFolder && (
                            <button
                                onClick={() => onOpenFolder(download.id)}
                                className="p-2 text-[#9dabb9] hover:text-primary transition-colors rounded-full hover:bg-background-dark"
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
