/**
 * Hook for the new concurrent Download Manager
 * Supports multiple simultaneous downloads with drag-and-drop reordering
 */
import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ManagerQueueItem, CommandResponse } from "../types";

export function useDownloadManager() {
    const [queue, setQueue] = useState<ManagerQueueItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Fetch current queue state from backend
     */
    const fetchQueue = useCallback(async () => {
        try {
            const response = await invoke<CommandResponse<ManagerQueueItem[]>>("manager_get_queue_state");
            if (response.success && response.data) {
                setQueue(response.data);
            }
        } catch (e) {
            console.error("Failed to fetch queue:", e);
        }
    }, []);

    /**
     * Add a URL to the queue (auto-starts if capacity available)
     */
    const addToQueue = useCallback(async (url: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await invoke<CommandResponse<ManagerQueueItem>>("manager_add_to_queue", { url });
            if (!response.success && response.error) {
                setError(response.error);
                return null;
            }
            return response.data;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            setError(errorMsg);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Remove an item from the queue (cancels if downloading)
     */
    const removeFromQueue = useCallback(async (id: string) => {
        try {
            await invoke<CommandResponse<boolean>>("manager_remove_from_queue", { id });
        } catch (e) {
            console.error("Failed to remove from queue:", e);
        }
    }, []);

    /**
     * Reorder an item in the queue
     */
    const reorderQueue = useCallback(async (id: string, newIndex: number) => {
        try {
            await invoke<CommandResponse<boolean>>("manager_reorder_queue", { id, newIndex });
        } catch (e) {
            console.error("Failed to reorder queue:", e);
        }
    }, []);

    /**
     * Cancel a specific download
     */
    const cancelDownload = useCallback(async (id: string) => {
        try {
            await invoke<CommandResponse<boolean>>("manager_cancel_download", { id });
        } catch (e) {
            console.error("Failed to cancel download:", e);
        }
    }, []);

    /**
     * Set max concurrent downloads
     */
    const setMaxConcurrent = useCallback(async (max: number) => {
        try {
            await invoke<CommandResponse<number>>("manager_set_max_concurrent", { max });
        } catch (e) {
            console.error("Failed to set max concurrent:", e);
        }
    }, []);

    /**
     * Continue processing queue (called when download finishes)
     */
    const continueQueue = useCallback(async () => {
        try {
            await invoke<CommandResponse<void>>("manager_continue_queue");
        } catch (e) {
            console.error("Failed to continue queue:", e);
        }
    }, []);

    // Listen for queue state changes from backend
    useEffect(() => {
        const unlistenState = listen<ManagerQueueItem[]>("queue-state-changed", (event) => {
            setQueue(event.payload);
        });

        const unlistenFinished = listen("download-task-finished", () => {
            // Continue processing queue when a download finishes
            continueQueue();
        });

        // Fetch initial queue state
        fetchQueue();

        return () => {
            unlistenState.then(fn => fn());
            unlistenFinished.then(fn => fn());
        };
    }, [fetchQueue, continueQueue]);

    // Derived state
    const downloadingItems = queue.filter(item => item.status === "downloading");
    const queuedItems = queue.filter(item => item.status === "queued");
    const downloadingCount = downloadingItems.length;
    const queuedCount = queuedItems.length;

    return {
        queue,
        isLoading,
        error,
        downloadingCount,
        queuedCount,
        downloadingItems,
        queuedItems,
        addToQueue,
        removeFromQueue,
        reorderQueue,
        cancelDownload,
        setMaxConcurrent,
        fetchQueue,
    };
}
