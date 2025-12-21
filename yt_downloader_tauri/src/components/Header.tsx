/** Header component with app branding and window controls */

interface HeaderProps {
    title?: string;
}

export const Header: React.FC<HeaderProps> = ({ title = "VideoGet" }) => {
    return (
        <header className="flex-none flex items-center justify-between whitespace-nowrap border-b border-[var(--color-border)] px-6 py-3 bg-[var(--color-surface)] backdrop-blur-xl z-20 drag-region">
            <div className="flex items-center gap-3">
                <div className="size-8 rounded bg-primary flex items-center justify-center text-[var(--color-text-on-accent)] shadow-lg shadow-primary/30">
                    <span className="material-symbols-outlined text-[20px]">download</span>
                </div>
                <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] text-[var(--color-text-primary)]">{title}</h2>
            </div>
            <div className="flex gap-2">
                <button className="flex size-8 cursor-pointer items-center justify-center rounded-lg hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] transition-colors">
                    <span className="material-symbols-outlined text-[18px]">remove</span>
                </button>
                <button className="flex size-8 cursor-pointer items-center justify-center rounded-lg hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] transition-colors">
                    <span className="material-symbols-outlined text-[16px]">check_box_outline_blank</span>
                </button>
                <button className="flex size-8 cursor-pointer items-center justify-center rounded-lg hover:bg-red-500 hover:text-white text-[var(--color-text-primary)] transition-colors">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
            </div>
        </header>
    );
};
