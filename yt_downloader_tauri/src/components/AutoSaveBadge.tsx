import React from "react";
import { CheckCircleIcon, CloudDoneIcon } from "./Icons";

export type SaveStatus = "idle" | "saving" | "saved";

interface AutoSaveBadgeProps {
    status: SaveStatus;
    lastSaved?: Date | null;
    className?: string;
}

export const AutoSaveBadge: React.FC<AutoSaveBadgeProps> = ({
    status,
    lastSaved,
    className = "",
}) => {
    if (status === "saving") {
        return (
            <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/40 text-xs font-semibold text-primary shadow-sm transition-all duration-300 select-none animate-pulse ${className}`}
                title="Saving changes to disk..."
            >
                <span className="w-2.5 h-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                <span>Saving...</span>
            </div>
        );
    }

    if (status === "saved") {
        return (
            <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/15 border border-green-500/40 text-xs font-semibold text-green-400 shadow-sm animate-save-pop transition-all duration-300 select-none ${className}`}
                title="All changes saved to your computer"
            >
                <CheckCircleIcon size={14} className="text-green-400 shrink-0" />
                <span>Saved!</span>
            </div>
        );
    }

    return (
        <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-surface-muted)] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-muted)] transition-all duration-300 select-none hover:text-[var(--color-text-secondary)] ${className}`}
            title={lastSaved ? `Last saved at ${lastSaved.toLocaleTimeString()}` : "Changes are saved automatically"}
        >
            <CloudDoneIcon size={14} className="text-green-400/80 shrink-0" />
            <span>{lastSaved ? "Auto-saved" : "Auto-save active"}</span>
        </div>
    );
};
