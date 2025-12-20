/** TypeScript type definitions matching Rust backend. */

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
}

/** Download history container */
export interface DownloadHistory {
    records: DownloadRecord[];
}
