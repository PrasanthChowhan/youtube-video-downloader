/** Bottom navigation component */

type Tab = "settings" | "youtube" | "downloads";

interface BottomNavProps {
    activeTab: Tab;
    onTabChange: (tab: Tab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
    const tabs = [
        { id: "settings" as Tab, icon: "settings", label: "Settings" },
        { id: "youtube" as Tab, icon: "smart_display", label: "YouTube" },
        { id: "downloads" as Tab, icon: "folder", label: "Downloads" },
    ];

    return (
        <nav className="flex-none border-t border-[#283039] bg-[#111418] px-10 pb-6 pt-3 z-20">
            <div className="flex justify-center items-center gap-16 max-w-[400px] mx-auto">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`group flex flex-col items-center gap-1.5 w-16 relative transition-colors ${isActive
                                    ? "text-primary"
                                    : "text-[#9dabb9] hover:text-white"
                                }`}
                        >
                            <div className={`p-1 rounded-full transition-colors ${isActive ? "bg-primary/10" : "group-hover:bg-white/10"
                                }`}>
                                <span className="material-symbols-outlined">{tab.icon}</span>
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
