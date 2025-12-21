/** TypeScript type definitions matching Rust backend. */

export type Platform = "youtube" | "instagram" | "unknown";

export interface VideoInfo {
    id: string;
    title: string;
    uploader: string;
    duration: number;
    duration_string: string;
    thumbnail: string | null;
    view_count: number | null;
    filesize_approx: number | null;
    url: string;
    platform: Platform;
}

export interface DownloadProgress {
    status: string;
    percent: number;
    speed: string;
    eta: string;
    downloaded_bytes: number;
    total_bytes: number | null;
    filename: string | null;
}

export interface CommandResponse<T> {
    success: boolean;
    data: T | null;
    error: string | null;
}

export interface AppSettings {
    download_path: string;
    filename_template: string;
    theme: string;
}

export interface AccelerationConfig {
    enabled: boolean;
    max_concurrent_fragments: number;
    use_throttle_protection: boolean;
    min_file_size_mb: number;
    use_aria2c: boolean;
    aria2_min_split_size: string;
    smart_mode: boolean;
}

export type DownloadMode = "youtube" | "direct" | null;

/** Status of a download record */
export type DownloadStatus = "completed" | "cancelled" | "failed" | "file_not_found";

/** A single download history record */
export interface DownloadRecord {
    id: string;
    url: string;
    title: string;
    uploader: string;
    thumbnail: string | null;
    file_path: string | null;
    file_size: number | null;
    status: DownloadStatus;
    created_at: number;
    completed_at: number | null;
    platform: Platform;
}

/** Download history container */
export interface DownloadHistory {
    records: DownloadRecord[];
}

/** Status of a queue item (matches new manager) */
export type ManagerQueueStatus = "queued" | "downloading" | "completed" | "failed" | "cancelled" | "fetching_metadata";

/** Per-item progress info */
export interface ItemProgress {
    percent: number;
    speed: string;
    eta: string;
    downloaded_bytes: number;
    total_bytes: number | null;
    filename: string | null;
}

/** A single item in the new download manager queue */
export interface ManagerQueueItem {
    id: string;
    url: string;
    title: string;
    uploader: string;
    thumbnail: string | null;
    duration_string: string | null;
    filesize_approx: number | null;
    status: ManagerQueueStatus;
    progress: ItemProgress;
    error: string | null;
}

/** Legacy queue status */
export type QueueStatus = "pending" | "downloading" | "completed" | "failed" | "cancelled";

/** Legacy queue item (for old queue system) */
export interface QueueItem {
    id: string;
    url: string;
    title: string;
    uploader: string;
    thumbnail: string | null;
    duration_string: string | null;
    filesize_approx: number | null;
    status: QueueStatus;
    error: string | null;
}
