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
