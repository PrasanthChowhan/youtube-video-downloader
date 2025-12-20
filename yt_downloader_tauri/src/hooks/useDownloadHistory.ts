/**
 * Hook for managing download history state
 */

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DownloadRecord, DownloadHistory, CommandResponse } from "../types";

export function useDownloadHistory() {
    const [records, setRecords] = useState<DownloadRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /**
     * Fetch download history from backend
     */
    const fetchHistory = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await invoke<CommandResponse<DownloadHistory>>("get_download_history");
            if (response.success && response.data) {
                // Check file existence for each record and update status if needed
                const updatedRecords = await Promise.all(
                    response.data.records.map(async (record) => {
                        if (record.status === "completed" && record.file_path) {
                            const exists = await invoke<boolean>("check_file_exists", {
                                path: record.file_path
                            });
                            if (!exists) {
                                return { ...record, status: "file_not_found" as const };
                            }
                        }
                        return record;
                    })
                );
                setRecords(updatedRecords);
            } else if (response.error) {
                setError(response.error);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Delete a record from history
     */
    const deleteRecord = useCallback(async (id: string) => {
        try {
            const response = await invoke<CommandResponse<null>>("delete_history_record", { id });
            if (response.success) {
                setRecords((prev) => prev.filter((r) => r.id !== id));
            }
        } catch (e) {
            console.error("Failed to delete record:", e);
        }
    }, []);

    /**
     * Clear all history
     */
    const clearHistory = useCallback(async () => {
        try {
            const response = await invoke<CommandResponse<null>>("clear_download_history");
            if (response.success) {
                setRecords([]);
            }
        } catch (e) {
            console.error("Failed to clear history:", e);
        }
    }, []);

    /**
     * Open file in system default application
     */
    const openFile = useCallback(async (filePath: string) => {
        try {
            await invoke("open_file", { path: filePath });
        } catch (e) {
            console.error("Failed to open file:", e);
        }
    }, []);

    /**
     * Open containing folder in file explorer
     */
    const openInFolder = useCallback(async (filePath: string) => {
        try {
            await invoke("open_file_location", { path: filePath });
        } catch (e) {
            console.error("Failed to open folder:", e);
        }
    }, []);

    // Fetch history on mount
    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    return {
        records,
        isLoading,
        error,
        fetchHistory,
        deleteRecord,
        clearHistory,
        openFile,
        openInFolder,
    };
}
