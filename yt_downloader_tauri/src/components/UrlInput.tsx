import { IconLink, DownloadIcon } from "./Icons";

interface UrlInputProps {
    url: string;
    onUrlChange: (url: string) => void;
    onDownload: () => void;
    isLoading?: boolean;
    disabled?: boolean;
}

export const UrlInput: React.FC<UrlInputProps> = ({
    url,
    onUrlChange,
    onDownload,
    isLoading = false,
    disabled = false,
}) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !disabled) {
            onDownload();
        }
    };

    return (
        <div className="flex flex-col md:flex-row gap-3 items-stretch mb-8 w-full">
            <div className="relative flex-1 group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none flex items-center">
                    <IconLink size={24} />
                </div>
                <input
                    type="text"
                    value={url}
                    onChange={(e) => onUrlChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex w-full min-w-0 resize-none overflow-hidden rounded-xl text-[var(--color-text-primary)] focus:outline-0 focus:ring-2 focus:ring-primary border-none bg-[var(--color-surface)] h-14 placeholder:text-[var(--color-text-muted)] pl-12 pr-4 text-base font-normal leading-normal shadow-sm transition-all"
                    placeholder="https://www.youtube.com/watch?v..."
                />
            </div>
            <button
                onClick={() => url.trim() && onDownload()}
                disabled={disabled || isLoading}
                className={`flex-none h-14 px-8 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] text-base font-bold leading-normal tracking-[0.015em] shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${!url.trim() ? 'opacity-100 cursor-default hover:bg-[var(--color-accent)]' : 'cursor-pointer'}`}
            >
                <DownloadIcon size={24} />
                <span>{isLoading ? "Adding..." : "Download"}</span>
            </button>
        </div>
    );
};
