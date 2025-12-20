/** Download management hook */

import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { DownloadProgress, CommandResponse, DownloadMode, DownloadRecord, VideoInfo } from "../types";

export function useDownload() {
    const [progress, setProgress] = useState<DownloadProgress | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Track current download info for history records
    const currentDownloadRef = useRef<{
        url: string;
        videoInfo?: VideoInfo;
        outputPath?: string;
    } | null>(null);

    // Track the last seen filename from progress events
    const lastFilenameRef = useRef<string | null>(null);

    useEffect(() => {
        const unlisten = listen<DownloadProgress>("download-progress", async (event) => {
            setProgress(event.payload);

            // Capture filename when it appears in progress events
            if (event.payload.filename) {
                lastFilenameRef.current = event.payload.filename;
            }

            if (event.payload.status === "finished") {
                setIsDownloading(false);

                // Create history record for successful download
                const downloadInfo = currentDownloadRef.current;
                if (downloadInfo?.videoInfo) {
                    // Use tracked filename, event filename, or fall back to outputPath
                    const filePath = lastFilenameRef.current || event.payload.filename || downloadInfo.outputPath || null;
                    // Use event total_bytes, or fall back to videoInfo.filesize_approx
                    const fileSize = event.payload.total_bytes || downloadInfo.videoInfo.filesize_approx || null;

                    const record: DownloadRecord = {
                        id: crypto.randomUUID(),
                        url: downloadInfo.url,
                        title: downloadInfo.videoInfo.title,
                        uploader: downloadInfo.videoInfo.uploader,
                        thumbnail: downloadInfo.videoInfo.thumbnail,
                        file_path: filePath,
                        file_size: fileSize,
                        status: "completed",
                        created_at: Math.floor(Date.now() / 1000),
                        completed_at: Math.floor(Date.now() / 1000),
                    };
                    await invoke("add_download_record", { record });
                }
                currentDownloadRef.current = null;
                lastFilenameRef.current = null;
            } else if (event.payload.status === "cancelled") {
                setIsDownloading(false);

                // Create history record for cancelled download
                const downloadInfo = currentDownloadRef.current;
                if (downloadInfo?.videoInfo) {
                    const record: DownloadRecord = {
                        id: crypto.randomUUID(),
                        url: downloadInfo.url,
                        title: downloadInfo.videoInfo.title,
                        uploader: downloadInfo.videoInfo.uploader,
                        thumbnail: downloadInfo.videoInfo.thumbnail,
                        file_path: null,
                        file_size: null,
                        status: "cancelled",
                        created_at: Math.floor(Date.now() / 1000),
                        completed_at: null,
                    };
                    await invoke("add_download_record", { record });
                }
                currentDownloadRef.current = null;
            }
        });
        return () => { unlisten.then((fn) => fn()); };
    }, []);

    const startDownload = useCallback(async (
        url: string,
        outputPath: string,
        _mode: DownloadMode,
        filenameTemplate?: string,
        videoInfo?: VideoInfo
    ) => {
        if (!url.trim() || !outputPath.trim()) {
            setError("Please enter a URL and select output folder");
            return false;
        }

        // Store info for history record (include outputPath for folder navigation)
        currentDownloadRef.current = { url: url.trim(), videoInfo, outputPath: outputPath.trim() };

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
                // Don't create record here - event listener handles all record creation
                currentDownloadRef.current = null;
                setError(response.error || "Download failed");
                setIsDownloading(false);
                return false;
            }
            return true;
        } catch (e) {
            currentDownloadRef.current = null;
            setError(String(e));
            setIsDownloading(false);
            return false;
        }
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return { progress, isDownloading, error, startDownload, clearError };
}
