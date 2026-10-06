import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { AppSettings, WhisperModel, WhisperProgress } from "../types";

interface WhisperSettingsProps {
    settings: AppSettings;
    onUpdateSettings: (updates: Partial<AppSettings>) => void;
}

interface ModelInfo {
    title: string;
    description: string;
    recommended?: boolean;
}

const FRIENDLY_MODEL_INFO: Record<string, ModelInfo> = {
    "ggml-tiny.bin": {
        title: "Fast Model",
        description: "Fastest transcription speed, lightweight (~75 MB). Good for clear audio and quick results.",
    },
    "ggml-base.bin": {
        title: "Standard Model",
        description: "Best balance of high accuracy and fast speed (~142 MB). Recommended for most videos.",
        recommended: true,
    },
    "ggml-small.bin": {
        title: "High Accuracy Model",
        description: "Highest accuracy (~466 MB). Best for background music, accents, or quiet speech.",
    },
};

const formatSize = (bytes: number): string => {
    if (bytes === 0) return "";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
};

const getBasename = (pathStr: string): string => {
    const parts = pathStr.split(/[/\\]/);
    return parts[parts.length - 1] || pathStr;
};

export const WhisperSettings: React.FC<WhisperSettingsProps> = ({
    settings,
    onUpdateSettings,
}) => {
    const [models, setModels] = useState<WhisperModel[]>([]);
    const [loadingModels, setLoadingModels] = useState(true);
    const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    // Selected model for transcription
    const [selectedModel, setSelectedModel] = useState<string>("");

    // Bulk File transcription state
    const [selectedFilePaths, setSelectedFilePaths] = useState<string[]>([]);
    const [transcribing, setTranscribing] = useState(false);
    const [batchStatusText, setBatchStatusText] = useState<string>("");
    const [transcribeProgress, setTranscribeProgress] = useState<WhisperProgress | null>(null);

    const loadModels = async () => {
        setLoadingModels(true);
        try {
            const result = await invoke<WhisperModel[]>("get_available_models");
            setModels(result);

            // Auto-select the first downloaded model if current selectedModel isn't installed
            const installedModels = result.filter((m) => m.is_downloaded);
            if (installedModels.length > 0) {
                const currentValid = installedModels.some((m) => m.name === settings.whisper_model);
                const target = currentValid
                    ? settings.whisper_model!
                    : installedModels[0].name;
                setSelectedModel(target);
                if (settings.whisper_model !== target) {
                    onUpdateSettings({ whisper_model: target });
                }
            }
        } catch (e) {
            console.error("Failed to fetch Whisper models:", e);
        } finally {
            setLoadingModels(false);
        }
    };

    useEffect(() => {
        loadModels();

        // Listen to whisper progress events
        const unlistenPromise = listen<WhisperProgress>("whisper-progress", (event) => {
            const p = event.payload;
            setTranscribeProgress(p);
            if (p.status === "transcribing" || p.status === "extracting_audio") {
                setTranscribing(true);
            }
        });

        return () => {
            unlistenPromise.then((unlisten) => unlisten());
        };
    }, []);

    const handleDownloadModel = async (modelName: string) => {
        setDownloadingModel(modelName);
        setDownloadError(null);
        try {
            await invoke<string>("download_whisper_model", { modelName });
            setSelectedModel(modelName);
            onUpdateSettings({ whisper_model: modelName });
            await loadModels();
        } catch (err: any) {
            setDownloadError(err?.toString() || "Failed to download model");
        } finally {
            setDownloadingModel(null);
        }
    };

    const handleImportCustomModel = async () => {
        try {
            const { open } = await import("@tauri-apps/plugin-dialog");
            const selected = await open({
                multiple: false,
                title: "Select Local Whisper Model File (.bin)",
                filters: [{ name: "Whisper Model (.bin)", extensions: ["bin"] }],
            });
            if (selected && typeof selected === "string") {
                const imported = await invoke<WhisperModel>("import_custom_model", { pathStr: selected });
                setSelectedModel(imported.name);
                onUpdateSettings({ whisper_model: imported.name });
                await loadModels();
            }
        } catch (err: any) {
            setDownloadError(err?.toString() || "Failed to import custom model file");
        }
    };

    const handleSelectFiles = async () => {
        try {
            const { open } = await import("@tauri-apps/plugin-dialog");
            const selected = await open({
                multiple: true,
                filters: [
                    {
                        name: "Audio / Video Media",
                        extensions: ["mp4", "mkv", "webm", "avi", "mov", "mp3", "m4a", "wav", "flac", "ogg"],
                    },
                ],
            });
            if (selected) {
                if (Array.isArray(selected)) {
                    setSelectedFilePaths(selected);
                } else if (typeof selected === "string") {
                    setSelectedFilePaths([selected]);
                }
            }
        } catch (err) {
            console.error("Failed to select files:", err);
        }
    };

    const handleStartTranscription = async () => {
        if (selectedFilePaths.length === 0) return;

        const installedModels = models.filter((m) => m.is_downloaded);
        const activeModel =
            selectedModel ||
            settings.whisper_model ||
            (installedModels.length > 0 ? installedModels[0].name : "");

        if (!activeModel) {
            setDownloadError("Please download a Speech Recognition Model first.");
            return;
        }

        setTranscribing(true);
        setDownloadError(null);

        const totalFiles = selectedFilePaths.length;
        let successCount = 0;

        for (let i = 0; i < totalFiles; i++) {
            const filePath = selectedFilePaths[i];
            const filename = getBasename(filePath);

            setBatchStatusText(
                totalFiles > 1
                    ? `File ${i + 1} of ${totalFiles}: ${filename}`
                    : `Processing ${filename}...`
            );

            setTranscribeProgress({
                status: "starting",
                percent: 0,
                current_file: filename,
            });

            try {
                await invoke<string>("transcribe_file", {
                    inputPath: filePath,
                    modelName: activeModel,
                    language: "auto",
                    exportJson: settings.export_word_timestamps || false,
                    exportSrt: settings.export_srt || false,
                });
                successCount++;
            } catch (err: any) {
                console.error(`Transcription failed for ${filename}:`, err);
                setTranscribeProgress({
                    status: "failed",
                    percent: 0,
                    current_file: filename,
                    error: err?.toString() || "Transcription failed",
                });
            }
        }

        setTranscribing(false);

        if (successCount === totalFiles) {
            setBatchStatusText(
                totalFiles > 1
                    ? `✓ Successfully transcribed all ${totalFiles} files!`
                    : `✓ Transcription completed!`
            );
        } else {
            setBatchStatusText(`Completed ${successCount} of ${totalFiles} files.`);
        }
    };

    const handleOpenFolder = async (pathStr: string) => {
        try {
            await invoke("open_file_location", { path: pathStr });
        } catch (err) {
            console.error("Failed to open folder:", err);
        }
    };

    const hasDownloadedModel = models.some((m) => m.is_downloaded);

    return (
        <div className="w-full max-w-[800px] flex flex-col flex-1 px-4 pt-8 pb-32 md:px-8">
            <div className="pt-8 pb-6">
                <h1 className="text-3xl font-bold mb-2 text-[var(--color-text-primary)]">
                    Audio & Video Transcription
                </h1>
                <p className="text-[var(--color-text-secondary)]">
                    Generate offline subtitle files (.srt, .txt, & optional .json) directly on your device.
                </p>
            </div>

            {/* Storage Location Info Banner */}
            <div className="p-4 mb-6 rounded-xl bg-[var(--color-surface-muted)] border border-[var(--color-border)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-primary text-sm">folder</span>
                        Downloaded Videos Location:
                    </span>
                    <button
                        onClick={() => handleOpenFolder(settings.download_path)}
                        className="text-primary hover:underline font-medium text-[11px] cursor-pointer"
                    >
                        Open Folder
                    </button>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] truncate pl-5">
                    {settings.download_path || "Default downloads directory"}
                </p>
                <div className="pt-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-green-400 text-sm">description</span>
                    <span>
                        Subtitles are saved in the <b>exact same folder right next to your video file</b>.
                    </span>
                </div>
            </div>

            {/* AI Speech Recognition Models Card */}
            <div className="glass-card p-6 mb-6">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-[var(--color-text-primary)]">
                        <span className="material-symbols-outlined text-primary">psychology</span>
                        Speech Recognition Models
                    </h2>
                    <button
                        onClick={handleImportCustomModel}
                        className="px-3 py-1.5 text-xs font-medium bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-elevated)] text-primary transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-sm">file_open</span>
                        <span>Import Existing Model (.bin)...</span>
                    </button>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mb-4">
                    Select or download an AI speech model for offline transcription. Models run 100% locally on your machine.
                </p>

                {downloadError && (
                    <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                        {downloadError}
                    </div>
                )}

                {loadingModels ? (
                    <div className="text-xs text-[var(--color-text-muted)] py-4 text-center">
                        Checking installed models...
                    </div>
                ) : (
                    <div className="space-y-3">
                        {models.map((model) => {
                            const info = FRIENDLY_MODEL_INFO[model.name];
                            const title = info ? info.title : model.name;
                            const desc = info ? info.description : "Custom speech model";

                            return (
                                <div
                                    key={model.name}
                                    className="flex items-center justify-between p-4 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-xl"
                                >
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                                                {title}
                                            </span>
                                            {info?.recommended && (
                                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary/20 text-primary">
                                                    Recommended
                                                </span>
                                            )}
                                            {model.is_downloaded && (
                                                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-500/20 text-green-400">
                                                    Installed ({formatSize(model.size_bytes)})
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                            {desc}
                                        </p>
                                    </div>

                                    {model.is_downloaded ? (
                                        <span className="text-xs text-green-400 font-medium px-3 py-1.5 rounded-lg bg-green-500/10">
                                            Ready
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => handleDownloadModel(model.name)}
                                            disabled={downloadingModel !== null}
                                            className="px-4 py-2 text-xs font-medium bg-primary text-white hover:bg-primary-hover disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                                        >
                                            {downloadingModel === model.name ? (
                                                <>
                                                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    <span>Downloading...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined text-sm">download</span>
                                                    <span>Download</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Bulk File Transcription Card */}
            <div className="glass-card p-6 mb-6">
                <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-[var(--color-text-primary)]">
                    <span className="material-symbols-outlined text-primary">video_library</span>
                    Transcribe Media Files (Single or Bulk)
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] mb-4">
                    Select one or multiple video/audio files on your computer to generate clean subtitles (.srt).
                </p>

                {/* Model Selector Dropdown */}
                <div className="mb-4">
                    <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
                        Selected AI Model
                    </label>
                    <select
                        value={selectedModel || settings.whisper_model || ""}
                        onChange={(e) => {
                            setSelectedModel(e.target.value);
                            onUpdateSettings({ whisper_model: e.target.value });
                        }}
                        className="w-full bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-lg px-3.5 py-2.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                    >
                        {models.map((m) => {
                            const info = FRIENDLY_MODEL_INFO[m.name];
                            const label = info ? `${info.title}` : m.name;
                            return (
                                <option key={m.name} value={m.name} disabled={!m.is_downloaded}>
                                    {label} {!m.is_downloaded ? "(Not Downloaded)" : "✓ Ready"}
                                </option>
                            );
                        })}
                    </select>
                </div>

                {/* Output Format Options */}
                <div className="mb-5 p-4 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-xl space-y-3">
                    <div className="text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                        Output Formats:
                    </div>

                    {/* Plain Text (.txt) - Always Default */}
                    <div className="flex items-center justify-between text-xs">
                        <div>
                            <span className="font-semibold text-[var(--color-text-primary)]">
                                Plain Text Transcript (.txt)
                            </span>
                            <p className="text-[11px] text-[var(--color-text-muted)]">
                                Standard plain text document with clean transcript text.
                            </p>
                        </div>
                        <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded">
                            ✓ Default Always
                        </span>
                    </div>

                    <div className="border-t border-[var(--color-border)] pt-2.5 flex items-center justify-between text-xs">
                        <div>
                            <span className="font-semibold text-[var(--color-text-primary)]">
                                Export Subtitles (.srt)
                            </span>
                            <p className="text-[11px] text-[var(--color-text-muted)]">
                                Subtitle file with line-by-line timestamps for video players.
                            </p>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings.export_srt || false}
                            onChange={(e) => onUpdateSettings({ export_srt: e.target.checked })}
                            className="w-4 h-4 accent-primary cursor-pointer rounded"
                        />
                    </div>

                    <div className="border-t border-[var(--color-border)] pt-2.5 flex items-center justify-between text-xs">
                        <div>
                            <span className="font-semibold text-[var(--color-text-primary)]">
                                Export Word-Level Timestamps (.json)
                            </span>
                            <p className="text-[11px] text-[var(--color-text-muted)]">
                                Detailed JSON with millisecond start & end timing for every word.
                            </p>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings.export_word_timestamps || false}
                            onChange={(e) => onUpdateSettings({ export_word_timestamps: e.target.checked })}
                            className="w-4 h-4 accent-primary cursor-pointer rounded"
                        />
                    </div>
                </div>

                {/* File selection box */}
                <div className="flex gap-2 mb-4">
                    <div className="flex-1 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-lg px-3.5 py-2.5 text-xs text-[var(--color-text-primary)] truncate">
                        {selectedFilePaths.length === 0 ? (
                            <span className="text-[var(--color-text-muted)]">
                                Click Browse to select video or audio files...
                            </span>
                        ) : selectedFilePaths.length === 1 ? (
                            getBasename(selectedFilePaths[0])
                        ) : (
                            <span className="font-semibold text-primary">
                                {selectedFilePaths.length} files selected ({selectedFilePaths.map(getBasename).join(", ")})
                            </span>
                        )}
                    </div>
                    <button
                        onClick={handleSelectFiles}
                        className="px-4 py-2.5 text-xs font-medium bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] transition-colors cursor-pointer"
                    >
                        Browse Files
                    </button>
                </div>

                {!hasDownloadedModel && (
                    <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                        ⚠️ Please download a Speech Recognition Model above before starting transcription.
                    </div>
                )}

                <button
                    onClick={handleStartTranscription}
                    disabled={selectedFilePaths.length === 0 || transcribing || !hasDownloadedModel}
                    className="w-full py-3 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                    {transcribing ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Transcribing Media ({selectedFilePaths.length} files)...</span>
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined text-base">closed_caption</span>
                            <span>
                                {selectedFilePaths.length > 1
                                    ? `Transcribe All (${selectedFilePaths.length} Files)`
                                    : "Start Transcription"}
                            </span>
                        </>
                    )}
                </button>

                {(transcribeProgress || batchStatusText) && (
                    <div className="mt-4 p-4 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-xl space-y-2">
                        {batchStatusText && (
                            <div className="text-xs font-semibold text-primary">
                                {batchStatusText}
                            </div>
                        )}
                        {transcribeProgress && (
                            <>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-medium text-[var(--color-text-primary)] capitalize">
                                        Status: {transcribeProgress.status.replace("_", " ")}
                                    </span>
                                    {transcribeProgress.status === "transcribing" && (
                                        <span className="font-bold text-primary">
                                            {transcribeProgress.percent.toFixed(0)}%
                                        </span>
                                    )}
                                </div>
                                {transcribeProgress.status === "transcribing" && (
                                    <div className="w-full h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-300"
                                            style={{ width: `${transcribeProgress.percent}%` }}
                                        />
                                    </div>
                                )}
                                {transcribeProgress.error && (
                                    <p className="text-xs text-red-400 pt-1">{transcribeProgress.error}</p>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Auto Transcribe Preference Card */}
            <div className="glass-card p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--color-text-primary)]">
                    <span className="material-symbols-outlined text-primary">subtitles</span>
                    Auto-Subtitle Preference
                </h2>

                <div className="p-4 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-sm font-medium text-[var(--color-text-primary)] block">
                                Auto-generate subtitles after video download
                            </label>
                            <p className="text-xs text-[var(--color-text-muted)]">
                                Automatically creates `.srt` subtitle files right next to downloaded videos
                            </p>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings.auto_transcribe || false}
                            onChange={(e) => onUpdateSettings({ auto_transcribe: e.target.checked })}
                            className="w-5 h-5 accent-primary cursor-pointer rounded"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
