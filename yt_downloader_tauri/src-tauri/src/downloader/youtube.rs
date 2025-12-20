//! YouTube-specific URL handling utilities.

/// Cleans a YouTube URL by removing playlist parameters.
pub fn clean_youtube_url(url: &str) -> String {
    if url.contains("youtube.com/watch?v=") {
        if let Some(v_pos) = url.find("v=") {
            let after_v = &url[v_pos + 2..];
            let video_id = after_v.split('&').next().unwrap_or(after_v);
            return format!("https://www.youtube.com/watch?v={}", video_id);
        }
    }

    if url.contains("youtu.be/") {
        if let Some(id_start) = url.find("youtu.be/") {
            let after_domain = &url[id_start + 9..];
            let video_id = after_domain.split('?').next().unwrap_or(after_domain);
            return format!("https://www.youtube.com/watch?v={}", video_id);
        }
    }

    url.to_string()
}
