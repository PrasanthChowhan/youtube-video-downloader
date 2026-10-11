/** Settings management hook */

import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, CommandResponse } from "../types";

const DEFAULT_SETTINGS: AppSettings = {
    download_path: "",
    filename_template: "%(uploader)s/%(title)s.%(ext)s",
    theme: "dark",
    auto_transcribe: false,
    whisper_model: "ggml-base.bin",
    export_word_timestamps: false,
    export_srt: false,
    cookies_from_browser: "",
    cookies_file_path: "",
};

import type { SaveStatus } from "../components/AutoSaveBadge";

export function useSettings() {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [outputPath, setOutputPathState] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

    // Keep ref to latest settings and output path for sync
    const settingsRef = useRef(settings);
    settingsRef.current = settings;
    const outputPathRef = useRef(outputPath);
    outputPathRef.current = outputPath;

    const saveTimerRef = useRef<any>(null);
    const statusResetTimerRef = useRef<any>(null);

    useEffect(() => {
        async function load() {
            try {
                const res = await invoke<CommandResponse<AppSettings>>("get_settings");
                if (res.success && res.data) {
                    setSettings(res.data);
                    setOutputPathState(res.data.download_path);
                } else {
                    const defaultPath = await invoke<string>("get_default_download_path");
                    setOutputPathState(defaultPath);
                }
            } catch (e) {
                console.error("Failed to load settings:", e);
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, []);

    const persistSettings = useCallback((newSettings: AppSettings, path: string, immediate = false) => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }

        setSaveStatus("saving");

        const doSave = async () => {
            try {
                await invoke("save_settings", {
                    settings: { ...newSettings, download_path: path || newSettings.download_path },
                });
                setLastSaved(new Date());
                setSaveStatus("saved");

                if (statusResetTimerRef.current) {
                    clearTimeout(statusResetTimerRef.current);
                }
                statusResetTimerRef.current = setTimeout(() => {
                    setSaveStatus("idle");
                }, 2200);
            } catch (e) {
                console.error("Failed to auto-save settings:", e);
                setSaveStatus("idle");
            }
        };

        if (immediate) {
            doSave();
        } else {
            saveTimerRef.current = setTimeout(doSave, 250);
        }
    }, []);

    const updateSettings = useCallback((updates: Partial<AppSettings>) => {
        setSettings((prev) => {
            const next = { ...prev, ...updates };
            const currentPath = outputPathRef.current || next.download_path;
            persistSettings(next, currentPath);
            return next;
        });
    }, [persistSettings]);

    const setOutputPath = useCallback((path: string) => {
        setOutputPathState(path);
        setSettings((prev) => {
            const next = { ...prev, download_path: path };
            persistSettings(next, path);
            return next;
        });
    }, [persistSettings]);

    const saveSettings = useCallback(async () => {
        persistSettings(settings, outputPath, true);
    }, [persistSettings, settings, outputPath]);

    return { settings, outputPath, setOutputPath, updateSettings, saveSettings, isLoading, lastSaved, saveStatus };
}
