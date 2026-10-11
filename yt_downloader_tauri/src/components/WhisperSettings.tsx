import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { AutoSaveBadge, type SaveStatus } from "./AutoSaveBadge";
import {
    TranscribeIcon,
    UploadFileIcon,
    MovieIcon,
    AudioTrackIcon,
    CloseIcon,
    PsychologyIcon,
    FormatListIcon,
    FolderOpenIcon,
    SmartDisplayIcon,
    CheckIcon,
    DownloadIcon,
} from "./Icons";
import type { AppSettings, WhisperModel, WhisperProgress } from "../types";

interface WhisperSettingsProps {
    settings: AppSettings;
    onUpdateSettings: (updates: Partial<AppSettings>) => void;
    lastSaved?: Date | null;
    saveStatus?: SaveStatus;
}

interface ModelInfo {
    title: string;
    description: string;
    recommended?: boolean;
}

const FRIENDLY_MODEL_INFO: Record<string, ModelInfo> = {
    "ggml-tiny.bin": {
        title: "Fast Model",
        description: "Ultra-fast transcription (~75 MB). Lightweight and ideal for clear speech and quick turnarounds.",
    },
    "ggml-base.bin": {
        title: "Standard Model",
        description: "Best balance of high accuracy and speed (~142 MB). Recommended for most videos.",
        recommended: true,
    },
    "ggml-small.bin": {
        title: "High Accuracy Model",
        description: "Highest accuracy (~466 MB). Ideal for background noise, heavy accents, or music.",
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
    lastSaved,
    saveStatus,
}) => {
    const [models, setModels] = useState<WhisperModel[]>([]);
    const [loadingModels, setLoadingModels] = useState(true);
    const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    // Selected model for transcription
    const [selectedModel, setSelectedModel] = useState<string>("");

    // Bulk / Single File transcription state
    const [selectedFilePaths, setSelectedFilePaths] = useState<string[]>([]);
    const [transcribing, setTranscribing] = useState(false);
    const [batchStatusText, setBatchStatusText] = useState<string>("");
    const [transcribeProgress, setTranscribeProgress] = useState<WhisperProgress | null>(null);
    const [lastCompletedFile, setLastCompletedFile] = useState<string | null>(null);
    const [justCompletedCount, setJustCompletedCount] = useState<number | null>(null);

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
            const selected = await open({
                multiple: true,
                title: "Select Audio or Video Files to Transcribe",
                filters: [
                    {
                        name: "Audio & Video Media",
                        extensions: ["mp4", "mkv", "webm", "avi", "mov", "mp3", "m4a", "wav", "flac", "ogg"],
                    },
                ],
            });
            if (selected) {
                const newPaths = Array.isArray(selected) ? selected : [selected];
                setSelectedFilePaths((prev) => Array.from(new Set([...prev, ...newPaths])));
                setJustCompletedCount(null);
                setBatchStatusText("");
            }
        } catch (err) {
            console.error("Failed to select files:", err);
        }
    };

    const handleRemoveFile = (index: number) => {
        setSelectedFilePaths((prev) => prev.filter((_, i) => i !== index));
    };

    const handleClearFiles = () => {
        setSelectedFilePaths([]);
        setBatchStatusText("");
        setTranscribeProgress(null);
        setJustCompletedCount(null);
    };

    const handleSetActiveModel = (modelName: string) => {
        setSelectedModel(modelName);
        onUpdateSettings({ whisper_model: modelName });
    };

    const handleStartTranscription = async () => {
        if (selectedFilePaths.length === 0) return;

        const installedModels = models.filter((m) => m.is_downloaded);
        const activeModel =
            selectedModel ||
            settings.whisper_model ||
            (installedModels.length > 0 ? installedModels[0].name : "");

        if (!activeModel) {
            setDownloadError("Please download or select an AI Speech Model first.");
            return;
        }

        setTranscribing(true);
        setDownloadError(null);
        setBatchStatusText("");
        setJustCompletedCount(null);

        const totalFiles = selectedFilePaths.length;
        let successCount = 0;
        let lastSuccessPath = selectedFilePaths[0];

        for (let i = 0; i < totalFiles; i++) {
            const filePath = selectedFilePaths[i];
            const filename = getBasename(filePath);

            setBatchStatusText(
                totalFiles > 1
                    ? `Transcribing (${i + 1}/${totalFiles}): ${filename}`
                    : `Transcribing ${filename}...`
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
                lastSuccessPath = filePath;
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
        setLastCompletedFile(lastSuccessPath);
        setJustCompletedCount(successCount);

        if (successCount === totalFiles) {
            setBatchStatusText(
                totalFiles > 1
                    ? `✓ Successfully transcribed all ${totalFiles} files!`
                    : `✓ Transcription completed successfully!`
            );
        } else {
            setBatchStatusText(`Completed ${successCount} of ${totalFiles} files.`);
        }
    };

    const handleOpenFileLocation = async (pathStr: string) => {
        try {
            await invoke("open_file_location", { path: pathStr });
        } catch (err) {
            console.error("Failed to open file location:", err);
        }
    };

    const installedModels = models.filter((m) => m.is_downloaded);
    const hasDownloadedModel = installedModels.length > 0;
    const activeModelName = selectedModel || settings.whisper_model || (installedModels[0]?.name ?? "");
    const activeModelInfo = FRIENDLY_MODEL_INFO[activeModelName];

    return (
        <div className="w-full max-w-[800px] flex flex-col flex-1 px-4 pt-8 pb-32 md:px-8">
            {/* Header with Title and Auto-Saved Status */}
            <div className="pt-8 pb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold mb-2 text-[var(--color-text-primary)]">
                        Audio & Video Transcription
                    </h1>
                    <p className="text-[var(--color-text-secondary)] text-sm">
                        Generate subtitles (.srt), text (.txt), and timestamps (.json) offline with local AI.
                    </p>
                </div>
                <AutoSaveBadge status={saveStatus || "idle"} lastSaved={lastSaved} />
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                SECTION 1 (PRIMARY): TRANSCRIBE MEDIA FILES WORKSPACE
                ═══════════════════════════════════════════════════════════════ */}
            <div className="glass-card p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-[var(--color-text-primary)]">
                        <TranscribeIcon size={20} className="text-primary" />
                        Transcribe Media Files
                    </h2>
                    {selectedFilePaths.length > 0 && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleSelectFiles}
                                disabled={transcribing}
                                className="px-2.5 py-1 text-xs font-medium bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-elevated)] text-primary transition-colors cursor-pointer"
                            >
                                + Add More
                            </button>
                            <button
                                onClick={handleClearFiles}
                                disabled={transcribing}
                                className="px-2.5 py-1 text-xs font-medium text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                            >
                                Clear All
                            </button>
                        </div>
                    )}
                </div>

                {/* File Dropzone / Selected Files Area */}
                {selectedFilePaths.length === 0 ? (
                    <div
                        onClick={handleSelectFiles}
                        className="group border-2 border-dashed border-[var(--color-border)] hover:border-primary/60 bg-[var(--color-surface-muted)] hover:bg-[var(--color-surface-elevated)]/50 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 mb-5"
                    >
                        <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform mb-3">
                            <UploadFileIcon size={36} className="text-primary" />
                        </div>
                        <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                            Click to Select Audio or Video Files
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] mb-3">
                            Supports MP4, MKV, MP3, WAV, M4A, FLAC, AAC, MOV, WEBM
                        </p>
                        <span className="px-4 py-2 text-xs font-medium bg-primary/20 text-primary border border-primary/30 rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
                            Browse Local Files...
                        </span>
                    </div>
                ) : (
                    <div className="mb-5 space-y-2">
                        <div className="text-xs font-medium text-[var(--color-text-secondary)] flex items-center justify-between">
                            <span>Selected Files ({selectedFilePaths.length})</span>
                            <span className="text-[11px] text-[var(--color-text-muted)]">Subtitles will be saved in the same folder as each file</span>
                        </div>
                        <div className="max-h-44 overflow-y-auto no-scrollbar space-y-1.5 p-2 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-xl">
                            {selectedFilePaths.map((filePath, idx) => (
                                <div
                                    key={filePath}
                                    className="flex items-center justify-between px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border-subtle)] rounded-lg text-xs"
                                >
                                    <div className="flex items-center gap-2 truncate pr-2">
                                        {filePath.match(/\.(mp3|wav|m4a|flac|ogg)$/i) ? (
                                            <AudioTrackIcon size={16} className="text-primary shrink-0" />
                                        ) : (
                                            <MovieIcon size={16} className="text-primary shrink-0" />
                                        )}
                                        <span className="truncate text-[var(--color-text-primary)] font-medium" title={filePath}>
                                            {getBasename(filePath)}
                                        </span>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveFile(idx);
                                        }}
                                        disabled={transcribing}
                                        className="text-[var(--color-text-muted)] hover:text-red-400 p-1 rounded transition-colors shrink-0 cursor-pointer"
                                        title="Remove file"
                                    >
                                        <CloseIcon size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Inline Configuration: Engine & Output Formats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                    {/* Active Model Selector */}
                    <div className="p-4 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-xl">
                        <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1.5 flex items-center gap-1.5">
                            <PsychologyIcon size={16} className="text-primary" />
                            Transcription AI Engine
                        </label>
                        {installedModels.length > 0 ? (
                            <select
                                value={activeModelName}
                                onChange={(e) => handleSetActiveModel(e.target.value)}
                                disabled={transcribing}
                                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                            >
                                {installedModels.map((m) => {
                                    const info = FRIENDLY_MODEL_INFO[m.name];
                                    const title = info ? info.title : m.name;
                                    return (
                                        <option key={m.name} value={m.name}>
                                            {title} ({formatSize(m.size_bytes)}) {info?.recommended ? "★ Recommended" : ""}
                                        </option>
                                    );
                                })}
                            </select>
                        ) : (
                            <div className="text-xs text-amber-400 flex items-center justify-between pt-1">
                                <span>No AI model downloaded yet</span>
                                <button
                                    onClick={() => handleDownloadModel("ggml-base.bin")}
                                    disabled={downloadingModel !== null}
                                    className="px-2 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[11px] font-medium hover:bg-amber-500/30 transition-colors"
                                >
                                    {downloadingModel === "ggml-base.bin" ? "Downloading..." : "Download Base (~142MB)"}
                                </button>
                            </div>
                        )}
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">
                            {activeModelInfo?.description || "Select a local whisper model to run on your device."}
                        </p>
                    </div>

                    {/* Output Formats */}
                    <div className="p-4 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-xl flex flex-col justify-between">
                        <div>
                            <span className="block text-xs font-semibold text-[var(--color-text-primary)] mb-2 flex items-center gap-1.5">
                                <FormatListIcon size={16} className="text-primary" />
                                Output Formats
                            </span>
                            <div className="space-y-2">
                                {/* Plain Text (.txt) */}
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-[var(--color-text-primary)]">Text Transcript (.txt)</span>
                                    <span className="text-[10px] font-semibold text-green-400 bg-green-500/10 px-2 py-0.5 rounded">
                                        ✓ Default Always
                                    </span>
                                </div>

                                {/* Subtitles (.srt) */}
                                <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                                    <span className="text-[var(--color-text-primary)]">Subtitles (.srt)</span>
                                    <input
                                        type="checkbox"
                                        checked={settings.export_srt || false}
                                        onChange={(e) => onUpdateSettings({ export_srt: e.target.checked })}
                                        className="w-4 h-4 accent-primary rounded cursor-pointer"
                                    />
                                </label>

                                {/* Timestamps (.json) */}
                                <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                                    <span className="text-[var(--color-text-primary)]">Word Timestamps (.json)</span>
                                    <input
                                        type="checkbox"
                                        checked={settings.export_word_timestamps || false}
                                        onChange={(e) => onUpdateSettings({ export_word_timestamps: e.target.checked })}
                                        className="w-4 h-4 accent-primary rounded cursor-pointer"
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Primary Action Button */}
                <button
                    onClick={handleStartTranscription}
                    disabled={selectedFilePaths.length === 0 || transcribing || !hasDownloadedModel}
                    className="w-full py-3.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
                >
                    {transcribing ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>
                                Transcribing Media ({selectedFilePaths.length} file{selectedFilePaths.length > 1 ? "s" : ""})...
                            </span>
                        </>
                    ) : (
                        <>
                            <TranscribeIcon size={18} />
                            <span>
                                {selectedFilePaths.length === 0
                                    ? "Select Files to Transcribe"
                                    : selectedFilePaths.length === 1
                                        ? "Start Transcription (1 File)"
                                        : `Transcribe All (${selectedFilePaths.length} Files)`}
                            </span>
                        </>
                    )}
                </button>

                {/* Warning if no model installed */}
                {!hasDownloadedModel && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 flex items-center justify-between">
                        <span>⚠️ Please download an AI Model below before transcribing files.</span>
                        <button
                            onClick={() => handleDownloadModel("ggml-base.bin")}
                            disabled={downloadingModel !== null}
                            className="px-3 py-1 bg-amber-500 text-black font-semibold rounded text-xs hover:bg-amber-400 transition-colors cursor-pointer"
                        >
                            {downloadingModel === "ggml-base.bin" ? "Downloading..." : "Download Base Model"}
                        </button>
                    </div>
                )}

                {/* Live Progress or Completion Banner */}
                {(transcribeProgress || batchStatusText) && (
                    <div className="mt-4 p-4 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-xl space-y-2">
                        {batchStatusText && (
                            <div className="text-xs font-semibold text-primary flex items-center justify-between">
                                <span>{batchStatusText}</span>
                                {justCompletedCount && lastCompletedFile && (
                                    <button
                                        onClick={() => handleOpenFileLocation(lastCompletedFile)}
                                        className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                                    >
                                        <FolderOpenIcon size={14} />
                                        Open Output Folder
                                    </button>
                                )}
                            </div>
                        )}

                        {transcribeProgress && transcribing && (
                            <>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-medium text-[var(--color-text-primary)] capitalize">
                                        Phase: {transcribeProgress.status.replace("_", " ")}
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
                            </>
                        )}

                        {transcribeProgress?.error && (
                            <p className="text-xs text-red-400 pt-1 font-medium">{transcribeProgress.error}</p>
                        )}
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                SECTION 2: AUTOMATIC WORKFLOW (YOUTUBE DOWNLOAD SUBTITLES)
                ═══════════════════════════════════════════════════════════════ */}
            <div className="glass-card p-6 mb-6">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-[var(--color-text-primary)]">
                        <SmartDisplayIcon size={20} className="text-primary" />
                        Automatic YouTube Subtitles
                    </h2>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary/20 text-primary">
                        Workflow
                    </span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mb-4">
                    Automatically generate subtitles for videos downloaded in the YouTube tab.
                </p>

                <div className="p-4 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-sm font-medium text-[var(--color-text-primary)] block">
                                Auto-generate subtitles after video download
                            </label>
                            <p className="text-xs text-[var(--color-text-muted)]">
                                Generates a matching <b>.srt</b> file next to each downloaded video using your active model.
                            </p>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings.auto_transcribe || false}
                            onChange={(e) => onUpdateSettings({ auto_transcribe: e.target.checked })}
                            className="w-5 h-5 accent-primary cursor-pointer rounded"
                        />
                    </div>

                    <div className="pt-2.5 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                        <span className="truncate pr-4">
                            Storage folder: <b className="text-[var(--color-text-secondary)]">{settings.download_path || "Default YouTube folder"}</b>
                        </span>
                        {settings.download_path && (
                            <button
                                onClick={() => handleOpenFileLocation(settings.download_path)}
                                className="text-primary hover:underline font-medium text-[11px] shrink-0 cursor-pointer"
                            >
                                Open Folder
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                SECTION 3: AI SPEECH RECOGNITION MODELS MANAGEMENT
                ═══════════════════════════════════════════════════════════════ */}
            <div className="glass-card p-6 mb-6">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-[var(--color-text-primary)]">
                        <PsychologyIcon size={20} className="text-primary" />
                        AI Speech Recognition Models
                    </h2>
                    <button
                        onClick={handleImportCustomModel}
                        className="px-3 py-1.5 text-xs font-medium bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-elevated)] text-primary transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                        <FolderOpenIcon size={14} />
                        <span>Import Local Model (.bin)</span>
                    </button>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mb-4">
                    Speech models run 100% locally on your computer with zero cloud latency, data transmission, or API costs.
                </p>

                {downloadError && (
                    <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                        {downloadError}
                    </div>
                )}

                {loadingModels ? (
                    <div className="text-xs text-[var(--color-text-muted)] py-4 text-center">
                        Checking installed AI models...
                    </div>
                ) : (
                    <div className="space-y-3">
                        {models.map((model) => {
                            const info = FRIENDLY_MODEL_INFO[model.name];
                            const title = info ? info.title : model.name;
                            const desc = info ? info.description : "Custom speech model";
                            const isActive = activeModelName === model.name;

                            return (
                                <div
                                    key={model.name}
                                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                                        isActive
                                            ? "bg-primary/10 border-primary/40 shadow-sm"
                                            : "bg-[var(--color-surface-muted)] border-[var(--color-border)]"
                                    }`}
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

                                    <div>
                                        {model.is_downloaded ? (
                                            isActive ? (
                                                <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-white flex items-center gap-1">
                                                    <CheckIcon size={14} />
                                                    Active Model
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => handleSetActiveModel(model.name)}
                                                    className="px-3 py-1.5 text-xs font-medium bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-primary text-primary rounded-lg transition-colors cursor-pointer"
                                                >
                                                    Set as Active
                                                </button>
                                            )
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
                                                        <DownloadIcon size={14} />
                                                        <span>Download</span>
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
