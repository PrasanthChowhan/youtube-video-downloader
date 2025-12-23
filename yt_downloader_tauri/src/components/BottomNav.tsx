/** Bottom navigation component */

import {
    SettingsIcon,
    SmartDisplayIcon,
    FolderIcon,
    SystemUpdateIcon
} from "./Icons";

type Tab = "settings" | "youtube" | "downloads" | "update";

interface BottomNavProps {
    activeTab: Tab;
    onTabChange: (tab: Tab) => void;
    hasUpdate?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, hasUpdate }) => {
    const tabs = [
        { id: "settings" as Tab, Icon: SettingsIcon, label: "Settings" },
        { id: "youtube" as Tab, Icon: SmartDisplayIcon, label: "YouTube" },
        { id: "downloads" as Tab, Icon: FolderIcon, label: "Downloads" },
        { id: "update" as Tab, Icon: SystemUpdateIcon, label: "Update" },
    ];

    return (
        <nav className="absolute bottom-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md mx-auto border border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-xl py-2 rounded-2xl shadow-2xl z-50">
            <div className="grid grid-cols-4 items-center px-2">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const showBadge = tab.id === "update" && hasUpdate && !isActive;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`group flex flex-col items-center justify-center gap-1 py-2 relative transition-colors ${isActive
                                ? "text-primary"
                                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                                }`}
                        >
                            <div className={`p-1.5 rounded-full transition-colors relative ${isActive ? "bg-primary/10" : "group-hover:bg-[var(--color-accent-soft)]"
                                }`}>
                                <tab.Icon size={24} className={isActive ? "fill-current" : ""} />
                                {showBadge && (
                                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[var(--color-surface)] animate-pulse" />
                                )}
                            </div>
                            <span className={`text-[10px] tracking-wide ${isActive ? "font-bold" : "font-medium"
                                }`}>
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};
