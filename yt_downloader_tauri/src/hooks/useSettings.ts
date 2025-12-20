/** Settings management hook */

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, CommandResponse } from "../types";

const DEFAULT_SETTINGS: AppSettings = {
    download_path: "",
    filename_template: "%(uploader)s/%(title)s.%(ext)s",
    theme: "dark",
};

export function useSettings() {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [outputPath, setOutputPath] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const res = await invoke<CommandResponse<AppSettings>>("get_settings");
                if (res.success && res.data) {
                    setSettings(res.data);
                    setOutputPath(res.data.download_path);
                } else {
                    const defaultPath = await invoke<string>("get_default_download_path");
                    setOutputPath(defaultPath);
                }
            } catch (e) {
                console.error("Failed to load settings:", e);
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, []);

    const updateSettings = useCallback((updates: Partial<AppSettings>) => {
        setSettings((prev) => ({ ...prev, ...updates }));
    }, []);

    const saveSettings = useCallback(async () => {
        await invoke("save_settings", {
            settings: { ...settings, download_path: outputPath },
        });
    }, [settings, outputPath]);

    return { settings, outputPath, setOutputPath, updateSettings, saveSettings, isLoading };
}
