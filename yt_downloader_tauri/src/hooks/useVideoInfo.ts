/** Video info fetching hook */

import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { VideoInfo, CommandResponse, DownloadMode } from "../types";
import { isYouTubeUrl, isValidUrl } from "../utils/formatters";

export function useVideoInfo() {
    const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [downloadMode, setDownloadMode] = useState<DownloadMode>(null);

    const fetchInfo = useCallback(async (url: string): Promise<VideoInfo | null> => {
        const trimmedUrl = url.trim();
        if (!trimmedUrl) {
            setVideoInfo(null);
            setDownloadMode(null);
            return null;
        }

        if (isYouTubeUrl(trimmedUrl)) {
            setDownloadMode("youtube");
            setIsLoading(true);
            setError(null);

            try {
                const response = await invoke<CommandResponse<VideoInfo>>("get_video_info", { url: trimmedUrl });
                if (response.success && response.data) {
                    setVideoInfo(response.data);
                    return response.data;
                } else {
                    setError(response.error || "Failed to fetch video info");
                    return null;
                }
            } catch (e) {
                setError(String(e));
                return null;
            } finally {
                setIsLoading(false);
            }
        } else if (isValidUrl(trimmedUrl)) {
            setDownloadMode("direct");
            setVideoInfo(null);
            setError(null);
            return null;
        } else {
            setDownloadMode(null);
            setError("Invalid URL");
            return null;
        }
    }, []);

    const clearInfo = useCallback(() => {
        setVideoInfo(null);
        setDownloadMode(null);
        setError(null);
    }, []);

    return { videoInfo, isLoading, error, downloadMode, fetchInfo, clearInfo };
}
