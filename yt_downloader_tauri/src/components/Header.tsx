/** Header component with app branding and window controls */

interface HeaderProps {
    title?: string;
}

export const Header: React.FC<HeaderProps> = ({ title = "VideoGet" }) => {
    return (
        <header className="flex-none flex items-center justify-between whitespace-nowrap border-b border-[#283039] px-6 py-3 bg-[#111418] z-20 drag-region">
            <div className="flex items-center gap-3">
                <div className="size-8 rounded bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30">
                    <span className="material-symbols-outlined text-[20px]">download</span>
                </div>
                <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">{title}</h2>
            </div>
            <div className="flex gap-2">
                <button className="flex size-8 cursor-pointer items-center justify-center rounded-lg hover:bg-[#283039] text-white transition-colors">
                    <span className="material-symbols-outlined text-[18px]">remove</span>
                </button>
                <button className="flex size-8 cursor-pointer items-center justify-center rounded-lg hover:bg-[#283039] text-white transition-colors">
                    <span className="material-symbols-outlined text-[16px]">check_box_outline_blank</span>
                </button>
                <button className="flex size-8 cursor-pointer items-center justify-center rounded-lg hover:bg-red-500 hover:text-white text-white transition-colors">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
            </div>
        </header>
    );
};
