/**
 * Sortable Queue Item Component for Download Manager
 * Shows item details, progress, and supports drag-and-drop reordering
 */
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ManagerQueueItem } from "../types";

interface SortableQueueItemProps {
    item: ManagerQueueItem;
    onRemove: (id: string) => void;
    onCancel: (id: string) => void;
}

export function SortableQueueItem({ item, onRemove, onCancel }: SortableQueueItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: item.id,
        disabled: item.status !== "queued", // Only queued items can be dragged
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const getStatusColor = () => {
        switch (item.status) {
            case "downloading": return "text-blue-400 bg-blue-400/20";
            case "completed": return "text-green-400 bg-green-400/20";
            case "failed": return "text-red-400 bg-red-400/20";
            case "cancelled": return "text-orange-400 bg-orange-400/20";
            default: return "text-gray-400 bg-gray-400/20";
        }
    };

    const getStatusIcon = () => {
        switch (item.status) {
            case "downloading": return "downloading";
            case "completed": return "check_circle";
            case "failed": return "error";
            case "cancelled": return "cancel";
            default: return "schedule";
        }
    };

    const formatBytes = (bytes: number | null) => {
        if (!bytes) return "";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
        return (bytes / 1073741824).toFixed(2) + " GB";
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-3 p-3 rounded-xl bg-[#1a2433] border border-white/5 transition-all ${isDragging ? "shadow-xl ring-2 ring-primary/50" : "hover:border-white/10"
                }`}
        >
            {/* Drag Handle - only for queued items */}
            {item.status === "queued" ? (
                <div
                    {...attributes}
                    {...listeners}
                    className="flex-shrink-0 p-1 cursor-grab active:cursor-grabbing text-[#637588] hover:text-white/70 touch-none"
                >
                    <span className="material-symbols-outlined text-lg">drag_indicator</span>
                </div>
            ) : (
                <div className="flex-shrink-0 p-1 w-[28px]" /> // Placeholder for alignment
            )}

            {/* Thumbnail */}
            {item.thumbnail ? (
                <img
                    src={item.thumbnail}
                    alt=""
                    className="w-16 h-9 rounded object-cover flex-shrink-0"
                />
            ) : (
                <div className="w-16 h-9 rounded bg-[#2a3444] flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[#637588]">movie</span>
                </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium truncate">{item.title}</h4>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#637588]">
                    <span className="truncate">{item.uploader}</span>
                    {item.duration_string && (
                        <>
                            <span>•</span>
                            <span>{item.duration_string}</span>
                        </>
                    )}
                    {item.filesize_approx && (
                        <>
                            <span>•</span>
                            <span>{formatBytes(item.filesize_approx)}</span>
                        </>
                    )}
                </div>

                {/* Progress Bar - only for downloading items */}
                {item.status === "downloading" && (
                    <div className="mt-2">
                        <div className="flex items-center gap-2 text-xs">
                            <div className="flex-1 h-1.5 bg-[#2a3444] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-primary transition-all duration-300"
                                    style={{ width: `${item.progress.percent}%` }}
                                />
                            </div>
                            <span className="text-[#9dabb9] w-12 text-right">
                                {item.progress.percent.toFixed(0)}%
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[#637588] mt-1">
                            {item.progress.speed && (
                                <span>{item.progress.speed}</span>
                            )}
                            {item.progress.eta && (
                                <span>ETA: {item.progress.eta}</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Error message */}
                {item.error && (
                    <div className="mt-1 text-xs text-red-400 truncate">
                        {item.error}
                    </div>
                )}
            </div>

            {/* Status Badge */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${getStatusColor()}`}>
                <span className="material-symbols-outlined text-sm">{getStatusIcon()}</span>
                <span className="capitalize hidden sm:inline">{item.status}</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
                {item.status === "downloading" && (
                    <button
                        onClick={() => onCancel(item.id)}
                        className="p-1.5 text-[#637588] hover:text-orange-400 hover:bg-orange-400/10 rounded-lg transition-colors"
                        title="Cancel download"
                    >
                        <span className="material-symbols-outlined text-lg">stop</span>
                    </button>
                )}
                {item.status === "queued" && (
                    <button
                        onClick={() => onRemove(item.id)}
                        className="p-1.5 text-[#637588] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Remove from queue"
                    >
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                )}
            </div>
        </div>
    );
}
