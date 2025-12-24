
import React from "react";
import {
    RocketLaunchIcon,
    CheckCircleIcon,
    RefreshIcon,
    SystemUpdateAltIcon,
    OpenInNewIcon,
    LoadingIcon,
    ErrorIcon,
    NewReleasesIcon
} from "./Icons";
import type { UpdateInfo } from "../types";

interface UpdateTabProps {
    updateInfo: UpdateInfo | null;
    updateLoading: boolean;
    updateError: string | null;
    lastChecked: Date | null;
    onCheckUpdate: () => void;
    onInstallUpdate: () => void;
    isInstalling: boolean;
    downloadProgress: number;
    onDownloadExternal: (url: string) => void;
}

export const UpdateTab: React.FC<UpdateTabProps> = ({
    updateInfo,
    updateLoading,
    updateError,
    lastChecked,
    onCheckUpdate,
    onInstallUpdate,
    isInstalling,
    downloadProgress,
    onDownloadExternal

}) => {
    // State for fetched release notes (for current version or when API doesn't provide them)
    const [fetchedNotes, setFetchedNotes] = React.useState<string | null>(null);
    const [isLoadingNotes, setIsLoadingNotes] = React.useState(false);

    // Determine status and content based on state
    const isUpdateAvailable = updateInfo?.update_available;
    const currentVersion = updateInfo?.current_version || "1.0.0";
    const displayVersion = isUpdateAvailable ? updateInfo.latest_version : currentVersion;

    React.useEffect(() => {
        const fetchNotes = async () => {
            // If we already have notes from updateInfo, don't fetch
            if (isUpdateAvailable && updateInfo?.release_notes) return;

            // Check session storage first to avoid hitting API limits
            const cacheKey = `release_notes_v${displayVersion}`;
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                setFetchedNotes(cached);
                return;
            }

            setIsLoadingNotes(true);
            try {
                // Try to fetch release notes for the specific version
                const response = await fetch(`https://api.github.com/repos/PrasanthChowhan/youtube-video-downloader/releases/tags/v${displayVersion}`);

                if (response.ok) {
                    const data = await response.json();
                    setFetchedNotes(data.body);
                    sessionStorage.setItem(cacheKey, data.body);
                } else if (response.status === 403) {
                    setFetchedNotes("Release notes temporarily unavailable (API Rate Limit Exceeded). Please try again later or view on GitHub.");
                } else {
                    // Fallback to latest if tag not found (or handle error)
                    console.warn("Could not fetch release notes for version", displayVersion);
                    setFetchedNotes("Release notes not available for this version.");
                }
            } catch (error) {
                console.error("Error fetching release notes:", error);
                setFetchedNotes("Could not load release notes. Please check your internet connection.");
            } finally {
                setIsLoadingNotes(false);
            }
        };

        fetchNotes();
    }, [displayVersion, isUpdateAvailable, updateInfo]);

    const notesToShow = (isUpdateAvailable && updateInfo?.release_notes) ? updateInfo.release_notes : fetchedNotes;

    return (
        <div className="w-full max-w-[800px] flex flex-col flex-1 px-4 pt-8 pb-32 md:px-8 mx-auto" >
            {/* Main Status Card */}
            < div className="glass-card p-10 flex flex-col items-center justify-center text-center relative overflow-hidden mb-6" >
                {/* Background Glow Effect */}
                < div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

                {/* Icon Circle */}
                < div className="relative mb-6" >
                    <div className="w-24 h-24 rounded-3xl bg-[#1e293b] flex items-center justify-center border border-[var(--color-border)] shadow-xl relative z-10">
                        {isUpdateAvailable ? (
                            <NewReleasesIcon size={48} className="text-green-400" />
                        ) : (
                            <RocketLaunchIcon size={48} className="text-primary" />
                        )}

                    </div>
                    {/* Status Badge */}
                    <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full border-4 border-[var(--color-surface)] flex items-center justify-center z-20 ${isUpdateAvailable ? "bg-green-500" : "bg-green-500"
                        }`} >
                        {
                            updateLoading ? (
                                <LoadingIcon size={16} className="text-white animate-spin" />
                            ) : isUpdateAvailable ? (
                                <SystemUpdateAltIcon size={16} className="text-white" />
                            ) : (
                                <CheckCircleIcon size={16} className="text-white" />
                            )}
                    </div >
                </div >

                {/* Version Title */}
                < h2 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2 relative z-10" >
                    Version {displayVersion}
                </h2 >

                {/* Status Text */}
                < p className="text-[var(--color-text-secondary)] mb-1 relative z-10" >
                    {
                        updateError ? (
                            <span className="text-red-400 flex items-center gap-2 justify-center" >
                                <ErrorIcon size={16} /> {updateError}
                            </span>
                        ) : isUpdateAvailable ? (
                            "A new version is available for download."
                        ) : (
                            "You're using the latest version of Video Downloader."
                        )}
                </p >

                {/* Last Checked */}
                < p className="text-xs text-[var(--color-text-muted)] mb-8 relative z-10" >
                    {lastChecked ? `Last checked: ${lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Last checked: Never"}
                </p >

                {/* Action Button */}
                {
                    isUpdateAvailable ? (
                        <div className="flex flex-col gap-3 w-full max-w-xs relative z-10">
                            <button
                                onClick={onInstallUpdate}
                                disabled={isInstalling}
                                className="w-full py-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-primary/25 flex items-center justify-center gap-2"
                            >
                                {isInstalling ? (
                                    <>
                                        <LoadingIcon className="animate-spin" />
                                        {downloadProgress === 100 ? "Installing..." : `Downloading ${downloadProgress}%`}
                                    </>
                                ) : (
                                    <>
                                        <SystemUpdateAltIcon />
                                        Install Update
                                    </>
                                )}
                            </button>
                            {/* Progress Bar for downloading */}
                            {isInstalling && (
                                <div className="w-full h-1.5 bg-[var(--color-surface-muted)] rounded-full overflow-hidden mt-1">
                                    <div
                                        className="h-full bg-primary transition-all duration-300"
                                        style={{ width: `${downloadProgress}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={onCheckUpdate}
                            disabled={updateLoading}
                            className="w-full max-w-xs py-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-primary/25 flex items-center justify-center gap-2 relative z-10"
                        >
                            {updateLoading ? (
                                <>
                                    <LoadingIcon className="animate-spin" />
                                    Checking...
                                </>
                            ) : (
                                <>
                                    <RefreshIcon />
                                    Check for Updates
                                </>
                            )}
                        </button>
                    )
                }
            </div >

            {/* Release Notes */}
            < div className="glass-card p-6 border-t border-[var(--color-border)]" >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-[var(--color-text-primary)]">
                        <NewReleasesIcon className="text-primary" />
                        Release Notes
                    </h3>
                    <span className="px-2 py-1 rounded-md bg-[var(--color-surface-muted)] text-xs font-mono text-[var(--color-text-muted)]">
                        v{displayVersion}
                    </span>
                </div>

                <div className="p-4 rounded-xl bg-[var(--color-surface-muted)] text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {isLoadingNotes ? (
                        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                            <LoadingIcon className="animate-spin" /> Loading release notes...
                        </div>
                    ) : notesToShow ? (
                        notesToShow
                    ) : (
                        "No release notes available."
                    )}
                </div>

                {
                    isUpdateAvailable && (
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={() => onDownloadExternal(updateInfo!.release_url)}
                                className="text-primary hover:text-primary-dark text-sm font-medium flex items-center gap-1 transition-colors"
                            >
                                View on GitHub <OpenInNewIcon size={14} />
                            </button>
                        </div>
                    )
                }
            </div >

            {/* Feedback Section */}
            <div className="glass-card p-6 border-t border-[var(--color-border)] mt-6">
                <div className="flex flex-col items-center text-center">
                    <span className="text-3xl mb-3">💬</span>
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                        We'd love your feedback!
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                        Help us improve by sharing your thoughts, reporting bugs, or suggesting new features.
                    </p>
                    <button
                        onClick={() => {
                            const formUrl = "https://docs.google.com/forms/d/e/1FAIpQLSfCBypqJR0aIcBp3ku3asgohXFMDT9diysMvBy1f8isJwZYMg/viewform?usp=dialog";
                            onDownloadExternal(formUrl);
                        }}
                        className="px-6 py-3 rounded-xl font-medium transition-all duration-300 cursor-pointer flex items-center gap-2 bg-[var(--color-surface-muted)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)] hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <span>📝</span>
                        Send Feedback
                    </button>
                </div>
            </div>
        </div >
    );
};
