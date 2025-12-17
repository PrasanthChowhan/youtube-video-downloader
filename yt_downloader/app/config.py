# file: yt_downloader/app/config.py
"""
Configuration settings for the YouTube Downloader application.

Provides default paths, format settings, and rate limiting options.
Users can modify these settings to customize app behavior.
"""

import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class DownloadConfig:
    """Configuration for download behavior."""
    
    # Default output directory template
    # Available placeholders: {uploader}, {title}, {id}, {ext}
    output_template: str = "%(uploader)s/%(title)s.%(ext)s"
    
    # Default download location
    default_download_path: Path = field(
        default_factory=lambda: Path.home() / "Downloads" / "YouTube"
    )
    
    # Video format selection (up to 4K with best audio)
    # This selects best video up to 2160p + best audio, falls back to best single file
    video_format: str = "bestvideo[height<=2160]+bestaudio/best"
    
    # Merge output format (requires FFmpeg for merging)
    merge_output_format: str = "mp4"
    
    # Rate limiting settings to avoid hammering YouTube
    # Delay between downloads in seconds (randomized between min and max)
    delay_between_downloads_min: float = 2.0
    delay_between_downloads_max: float = 5.0
    
    # Maximum concurrent downloads (keep at 1 for safety)
    max_concurrent_downloads: int = 1
    
    # Network settings
    socket_timeout: int = 30  # seconds
    retries: int = 3
    
    # FFmpeg path (None = auto-detect from PATH)
    ffmpeg_path: Optional[str] = None
    
    # Subtitle settings
    download_subtitles: bool = False
    subtitle_langs: list = field(default_factory=lambda: ["en"])
    
    # Thumbnail embedding
    embed_thumbnail: bool = False
    
    # Metadata embedding
    embed_metadata: bool = True
    
    def get_output_path(self) -> Path:
        """Get the output path, creating it if it doesn't exist."""
        path = self.default_download_path
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    def get_yt_dlp_options(self, progress_hook=None) -> dict:
        """
        Generate yt-dlp options dictionary from config.
        
        Args:
            progress_hook: Optional callback function for progress updates.
            
        Returns:
            Dictionary of yt-dlp options.
        """
        options = {
            'format': self.video_format,
            'merge_output_format': self.merge_output_format,
            'outtmpl': str(self.get_output_path() / self.output_template),
            'socket_timeout': self.socket_timeout,
            'retries': self.retries,
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }
        
        if self.ffmpeg_path:
            options['ffmpeg_location'] = self.ffmpeg_path
        
        if self.embed_metadata:
            options['postprocessors'] = options.get('postprocessors', [])
            options['postprocessors'].append({
                'key': 'FFmpegMetadata',
                'add_metadata': True,
            })
        
        if self.embed_thumbnail:
            options['postprocessors'] = options.get('postprocessors', [])
            options['postprocessors'].append({
                'key': 'EmbedThumbnail',
            })
            options['writethumbnail'] = True
        
        if self.download_subtitles:
            options['writesubtitles'] = True
            options['subtitleslangs'] = self.subtitle_langs
        
        if progress_hook:
            options['progress_hooks'] = [progress_hook]
        
        return options


@dataclass
class AppConfig:
    """Main application configuration."""
    
    # Window settings
    window_title: str = "YouTube Downloader"
    window_width: int = 800
    window_height: int = 600
    min_width: int = 600
    min_height: int = 500
    
    # Theme settings (customtkinter themes)
    appearance_mode: str = "dark"  # "dark", "light", or "system"
    color_theme: str = "blue"  # "blue", "green", or "dark-blue"
    
    # Show disclaimer on startup
    show_disclaimer: bool = True
    
    # Download configuration
    download: DownloadConfig = field(default_factory=DownloadConfig)


# Global configuration instance
config = AppConfig()


def get_config() -> AppConfig:
    """Get the global application configuration."""
    return config


def reset_config() -> None:
    """Reset configuration to defaults."""
    global config
    config = AppConfig()
