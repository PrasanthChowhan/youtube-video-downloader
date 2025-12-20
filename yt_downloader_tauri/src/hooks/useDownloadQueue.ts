/**
 * Hook for managing the download queue
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { QueueItem, CommandResponse, DownloadProgress } from "../types";

interface QueueProgressEvent {
    item_id: string;
    progress: DownloadProgress;
}

export function useDownloadQueue() {
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentProgress, setCurrentProgress] = useState<DownloadProgress | null>(null);

    // Track if we should auto-start the queue
    const autoStartRef = useRef(true);

    /**
     * Fetch current queue state from backend
     */
    const fetchQueue = useCallback(async () => {
        try {
            const response = await invoke<CommandResponse<QueueItem[]>>("get_queue");
            if (response.success && response.data) {
                setQueue(response.data);
                // Check if any item is downloading
                setIsProcessing(response.data.some(item => item.status === "downloading"));
            }
        } catch (e) {
            console.error("Failed to fetch queue:", e);
        }
    }, []);

    /**
     * Start processing the queue
     */
    const startQueue = useCallback(async () => {
        setIsProcessing(true);
        setCurrentProgress(null);
        try {
            const response = await invoke<CommandResponse<string>>("start_queue");
            if (!response.success && response.error) {
                setError(response.error);
                setIsProcessing(false);
            }
        } catch (e) {
            console.error("Failed to start queue:", e);
            setIsProcessing(false);
        }
    }, []);

    /**
     * Add a URL to the queue (auto-starts if not already processing)
     */
    const addToQueue = useCallback(async (url: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await invoke<CommandResponse<QueueItem>>("add_to_queue", { url });
            if (!response.success && response.error) {
                setError(response.error);
                return null;
            }

            // Auto-start queue if not already processing
            if (autoStartRef.current && !isProcessing && response.data) {
                setTimeout(() => {
                    startQueue();
                }, 100);
            }

            return response.data;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            setError(errorMsg);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [isProcessing, startQueue]);

    /**
     * Remove an item from the queue
     */
    const removeFromQueue = useCallback(async (id: string) => {
        try {
            await invoke<CommandResponse<boolean>>("remove_from_queue", { id });
        } catch (e) {
            console.error("Failed to remove from queue:", e);
        }
    }, []);

    /**
     * Clear all pending items from the queue
     */
    const clearQueue = useCallback(async () => {
        try {
            await invoke<CommandResponse<void>>("clear_queue");
        } catch (e) {
            console.error("Failed to clear queue:", e);
        }
    }, []);

    /**
     * Continue processing the queue after an item finishes
     */
    const continueQueue = useCallback(async () => {
        setCurrentProgress(null);
        // Always try to start next - backend will handle if queue is empty
        await startQueue();
    }, [startQueue]);

    // Listen for queue updates from backend
    useEffect(() => {
        const unlistenQueue = listen<QueueItem[]>("queue-updated", (event) => {
            setQueue(event.payload);
            // Check if any item is downloading
            const hasDownloading = event.payload.some(item => item.status === "downloading");
            setIsProcessing(hasDownloading);

            // Clear progress if nothing is downloading
            if (!hasDownloading) {
                setCurrentProgress(null);
            }
        });

        const unlistenProgress = listen<QueueProgressEvent>("queue-progress", (event) => {
            setCurrentProgress(event.payload.progress);
        });

        const unlistenFinished = listen("queue-item-finished", () => {
            // Trigger next item processing
            continueQueue();
        });

        // Fetch initial queue state
        fetchQueue();

        return () => {
            unlistenQueue.then(fn => fn());
            unlistenProgress.then(fn => fn());
            unlistenFinished.then(fn => fn());
        };
    }, [fetchQueue, continueQueue]);

    // Derived state
    const pendingCount = queue.filter(item => item.status === "pending").length;
    const downloadingItem = queue.find(item => item.status === "downloading");

    return {
        queue,
        isLoading,
        isProcessing,
        error,
        pendingCount,
        downloadingItem,
        currentProgress,
        addToQueue,
        removeFromQueue,
        clearQueue,
        startQueue,
        fetchQueue,
    };
}
