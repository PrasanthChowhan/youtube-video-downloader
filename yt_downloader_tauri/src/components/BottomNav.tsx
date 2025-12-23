/** Bottom navigation component */

type Tab = "settings" | "youtube" | "downloads" | "update";

interface BottomNavProps {
    activeTab: Tab;
    onTabChange: (tab: Tab) => void;
    hasUpdate?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, hasUpdate }) => {
    const tabs = [
        { id: "settings" as Tab, icon: "settings", label: "Settings" },
        { id: "youtube" as Tab, icon: "smart_display", label: "YouTube" },
        { id: "downloads" as Tab, icon: "folder", label: "Downloads" },
        { id: "update" as Tab, icon: "system_update", label: "Update" },
    ];

    return (
        <nav className="flex-none border-t border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-xl px-10 pb-6 pt-3 z-20">
            <div className="flex justify-center items-center gap-16 max-w-[400px] mx-auto">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const showBadge = tab.id === "update" && hasUpdate && !isActive;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`group flex flex-col items-center gap-1.5 w-16 relative transition-colors ${isActive
                                ? "text-primary"
                                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                                }`}
                        >
                            <div className={`p-1 rounded-full transition-colors relative ${isActive ? "bg-primary/10" : "group-hover:bg-[var(--color-accent-soft)]"
                                }`}>
                                <span className="material-symbols-outlined">{tab.icon}</span>
                                {showBadge && (
                                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[var(--color-surface)] animate-pulse" />
                                )}
                            </div>
                            <span className={`text-[11px] tracking-wide ${isActive ? "font-bold" : "font-medium"
                                }`}>
                                {tab.label}
                            </span>
                            {isActive && (
                                <div className="absolute -bottom-3 w-1 h-1 rounded-full bg-primary"></div>
                            )}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};
