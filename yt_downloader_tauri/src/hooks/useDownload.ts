/** Download management hook */

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { DownloadProgress, CommandResponse, DownloadMode } from "../types";

export function useDownload() {
    const [progress, setProgress] = useState<DownloadProgress | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const unlisten = listen<DownloadProgress>("download-progress", (event) => {
            setProgress(event.payload);
            if (event.payload.status === "finished") {
                setIsDownloading(false);
            }
        });
        return () => { unlisten.then((fn) => fn()); };
    }, []);

    const startDownload = useCallback(async (
        url: string,
        outputPath: string,
        _mode: DownloadMode,
        filenameTemplate?: string
    ) => {
        if (!url.trim() || !outputPath.trim()) {
            setError("Please enter a URL and select output folder");
            return false;
        }

        setIsDownloading(true);
        setError(null);
        setProgress({ status: "starting", percent: 0, speed: "", eta: "", downloaded_bytes: 0, total_bytes: null, filename: null });

        try {
            const response = await invoke<CommandResponse<string>>("start_download", {
                url: url.trim(),
                outputPath,
                filenameTemplate,
            });

            if (!response.success) {
                setError(response.error || "Download failed");
                setIsDownloading(false);
                return false;
            }
            return true;
        } catch (e) {
            setError(String(e));
            setIsDownloading(false);
            return false;
        }
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return { progress, isDownloading, error, startDownload, clearError };
}
