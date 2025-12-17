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
    
    # Default download location
    default_download_path: Path = field(
        default_factory=lambda: Path.home() / "Downloads" / "YouTube"
    )
    
    # Output template options:
    # - "uploader_title": {uploader}/{title}.{ext} (default)
    # - "uploader_only": {uploader}/{title}.{ext} (no title subfolder)
    # - "direct": {title}.{ext} (no subfolders)
    # - "custom": uses custom_output_template
    output_template_preset: str = "uploader_title"
    
    # Custom output template (only used if output_template_preset is "custom")
    custom_output_template: str = "%(uploader)s/%(title)s.%(ext)s"
    
    # Subfolder settings
    use_uploader_subfolder: bool = True
    use_date_subfolder: bool = False  # Organize by upload date
    
    # Video format selection with quality cascade
    # Priority: 4K (2160p) → 1080p → 720p → best available
    # Uses bestvideo+bestaudio for separate streams (requires FFmpeg to merge)
    video_format: str = (
        "bestvideo[height<=2160]+bestaudio/bestvideo[height<=1080]+bestaudio/"
        "bestvideo[height<=720]+bestaudio/best"
    )
    
    # Merge output format (requires FFmpeg for merging)
    merge_output_format: str = "mp4"
    
    # Rate limiting settings to avoid hammering YouTube
    # Delay between downloads in seconds (randomized between min and max)
    delay_between_downloads_min: float = 2.0
    delay_between_downloads_max: float = 5.0
    
    # Maximum concurrent downloads (1-3)
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
    
    def get_output_template(self) -> str:
        """
        Get the output template based on preset or custom setting.
        
        Returns:
            yt-dlp compatible output template string.
        """
        templates = {
            "uploader_title": "%(uploader)s/%(title)s.%(ext)s",
            "uploader_only": "%(uploader)s/%(title)s.%(ext)s",
            "direct": "%(title)s.%(ext)s",
            "date_uploader": "%(upload_date)s/%(uploader)s/%(title)s.%(ext)s",
        }
        
        if self.output_template_preset == "custom":
            return self.custom_output_template
        
        return templates.get(self.output_template_preset, templates["uploader_title"])
    
    def _is_ffmpeg_available(self) -> bool:
        """Check if FFmpeg is available in the system."""
        import shutil
        
        # Check custom path first
        if self.ffmpeg_path:
            return Path(self.ffmpeg_path).exists()
        
        # Check if ffmpeg is in PATH
        return shutil.which('ffmpeg') is not None
    
    def get_yt_dlp_options(self, progress_hook=None) -> dict:
        """
        Generate yt-dlp options dictionary from config.
        
        Args:
            progress_hook: Optional callback function for progress updates.
            
        Returns:
            Dictionary of yt-dlp options.
        """
        # Use 'best' format if FFmpeg is not available (no merging needed)
        # Otherwise use best video + best audio which requires FFmpeg to merge
        ffmpeg_available = self._is_ffmpeg_available()
        
        if ffmpeg_available:
            video_format = self.video_format
        else:
            # Fallback: single file formats that don't require merging
            # Cascade: 4K → 1080p → 720p → best
            video_format = "best[height<=2160]/best[height<=1080]/best[height<=720]/best"
        
        options = {
            'format': video_format,
            'outtmpl': str(self.get_output_path() / self.get_output_template()),
            'socket_timeout': self.socket_timeout,
            'retries': self.retries,
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }
        
        # Only add merge options if FFmpeg is available
        if ffmpeg_available:
            options['merge_output_format'] = self.merge_output_format
        
        if self.ffmpeg_path:
            options['ffmpeg_location'] = self.ffmpeg_path
        
        # Only add FFmpeg-dependent postprocessors if available
        if ffmpeg_available:
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
