# file: yt_downloader/app/downloader.py
"""
YouTube download logic using yt-dlp.

Provides functions for fetching video information and downloading videos
with progress tracking. All yt-dlp interactions are encapsulated here.
"""

import re
import time
import random
from dataclasses import dataclass
from typing import Optional, Callable, Any
from pathlib import Path

import yt_dlp

from .config import get_config, DownloadConfig


@dataclass
class VideoInfo:
    """Container for video metadata."""
    
    url: str
    title: str
    duration: int  # seconds
    duration_str: str
    uploader: str
    thumbnail_url: Optional[str]
    view_count: Optional[int]
    upload_date: Optional[str]
    description: Optional[str]
    filesize_approx: Optional[int]  # bytes
    formats_available: list
    video_id: str
    
    @property
    def filesize_str(self) -> str:
        """Human-readable file size."""
        if self.filesize_approx:
            return format_size(self.filesize_approx)
        return "Unknown size"


@dataclass
class DownloadProgress:
    """Container for download progress information."""
    
    status: str  # 'downloading', 'finished', 'error'
    downloaded_bytes: int = 0
    total_bytes: Optional[int] = None
    speed: Optional[float] = None  # bytes per second
    eta: Optional[int] = None  # seconds
    filename: Optional[str] = None
    percent: float = 0.0
    
    @property
    def speed_str(self) -> str:
        """Human-readable download speed."""
        if self.speed:
            return f"{format_size(self.speed)}/s"
        return "-- B/s"
    
    @property
    def eta_str(self) -> str:
        """Human-readable ETA."""
        if self.eta:
            return format_duration(self.eta)
        return "--:--"
    
    @property
    def percent_str(self) -> str:
        """Formatted percentage string."""
        return f"{self.percent:.1f}%"


class DownloadError(Exception):
    """Custom exception for download errors."""
    pass


class VideoNotFoundError(DownloadError):
    """Raised when video is not found or unavailable."""
    pass


class NetworkError(DownloadError):
    """Raised when network issues occur."""
    pass


class InvalidURLError(DownloadError):
    """Raised when URL is invalid."""
    pass


def format_duration(seconds: int) -> str:
    """
    Format duration in seconds to human-readable string.
    
    Args:
        seconds: Duration in seconds.
        
    Returns:
        Formatted string like "1:23:45" or "23:45".
    """
    if seconds is None or seconds < 0:
        return "Unknown"
    
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def format_size(bytes_size: int) -> str:
    """
    Format bytes to human-readable size string.
    
    Args:
        bytes_size: Size in bytes.
        
    Returns:
        Formatted string like "1.5 GB" or "256 MB".
    """
    if bytes_size is None or bytes_size < 0:
        return "Unknown"
    
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_size < 1024:
            return f"{bytes_size:.1f} {unit}"
        bytes_size /= 1024
    return f"{bytes_size:.1f} PB"


def validate_youtube_url(url: str) -> bool:
    """
    Validate if a URL is a valid YouTube URL.
    
    Args:
        url: URL string to validate.
        
    Returns:
        True if valid YouTube URL, False otherwise.
    """
    youtube_patterns = [
        r'^https?://(www\.)?youtube\.com/watch\?v=[\w-]+',
        r'^https?://(www\.)?youtube\.com/shorts/[\w-]+',
        r'^https?://youtu\.be/[\w-]+',
        r'^https?://(www\.)?youtube\.com/embed/[\w-]+',
        r'^https?://(www\.)?youtube\.com/v/[\w-]+',
    ]
    
    for pattern in youtube_patterns:
        if re.match(pattern, url.strip()):
            return True
    return False


def fetch_video_info(url: str) -> VideoInfo:
    """
    Fetch video information from YouTube URL.
    
    Args:
        url: YouTube video URL.
        
    Returns:
        VideoInfo object with video metadata.
        
    Raises:
        InvalidURLError: If URL is not a valid YouTube URL.
        VideoNotFoundError: If video is not found or unavailable.
        NetworkError: If network issues occur.
        DownloadError: For other yt-dlp errors.
    """
    url = url.strip()
    
    if not validate_youtube_url(url):
        raise InvalidURLError(f"Invalid YouTube URL: {url}")
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'skip_download': True,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            if info is None:
                raise VideoNotFoundError("Could not extract video information")
            
            # Calculate approximate file size from best format
            filesize_approx = None
            formats = info.get('formats', [])
            
            # Try to get filesize from the best video+audio combination
            for fmt in reversed(formats):
                if fmt.get('filesize'):
                    if filesize_approx is None:
                        filesize_approx = fmt['filesize']
                    else:
                        filesize_approx = max(filesize_approx, fmt['filesize'])
            
            # If no filesize, try filesize_approx
            if filesize_approx is None:
                for fmt in reversed(formats):
                    if fmt.get('filesize_approx'):
                        filesize_approx = fmt['filesize_approx']
                        break
            
            return VideoInfo(
                url=url,
                title=info.get('title', 'Unknown Title'),
                duration=info.get('duration', 0) or 0,
                duration_str=format_duration(info.get('duration', 0) or 0),
                uploader=info.get('uploader', 'Unknown Uploader'),
                thumbnail_url=info.get('thumbnail'),
                view_count=info.get('view_count'),
                upload_date=info.get('upload_date'),
                description=info.get('description'),
                filesize_approx=filesize_approx,
                formats_available=formats,
                video_id=info.get('id', ''),
            )
            
    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e).lower()
        if 'video unavailable' in error_msg or 'private video' in error_msg:
            raise VideoNotFoundError(f"Video is unavailable or private: {url}")
        elif 'removed' in error_msg or 'deleted' in error_msg:
            raise VideoNotFoundError(f"Video has been removed: {url}")
        elif 'network' in error_msg or 'connection' in error_msg or 'timeout' in error_msg:
            raise NetworkError(f"Network error while fetching video info: {e}")
        else:
            raise DownloadError(f"Error fetching video info: {e}")
    except Exception as e:
        raise DownloadError(f"Unexpected error: {e}")


def download_video(
    url: str,
    output_path: Optional[Path] = None,
    progress_callback: Optional[Callable[[DownloadProgress], None]] = None,
    config: Optional[DownloadConfig] = None,
) -> str:
    """
    Download a YouTube video.
    
    Args:
        url: YouTube video URL.
        output_path: Optional custom output directory.
        progress_callback: Optional callback for progress updates.
        config: Optional download configuration (uses global config if None).
        
    Returns:
        Path to the downloaded file.
        
    Raises:
        InvalidURLError: If URL is not a valid YouTube URL.
        VideoNotFoundError: If video is not found or unavailable.
        NetworkError: If network issues occur.
        DownloadError: For other yt-dlp errors.
    """
    url = url.strip()
    
    if not validate_youtube_url(url):
        raise InvalidURLError(f"Invalid YouTube URL: {url}")
    
    if config is None:
        config = get_config().download
    
    downloaded_file = None
    
    def progress_hook(d: dict) -> None:
        nonlocal downloaded_file
        
        status = d.get('status', 'unknown')
        
        if status == 'downloading':
            progress = DownloadProgress(
                status='downloading',
                downloaded_bytes=d.get('downloaded_bytes', 0),
                total_bytes=d.get('total_bytes') or d.get('total_bytes_estimate'),
                speed=d.get('speed'),
                eta=d.get('eta'),
                filename=d.get('filename'),
            )
            
            if progress.total_bytes and progress.total_bytes > 0:
                progress.percent = (progress.downloaded_bytes / progress.total_bytes) * 100
            
            if progress_callback:
                progress_callback(progress)
                
        elif status == 'finished':
            downloaded_file = d.get('filename')
            progress = DownloadProgress(
                status='finished',
                percent=100.0,
                filename=downloaded_file,
            )
            if progress_callback:
                progress_callback(progress)
                
        elif status == 'error':
            progress = DownloadProgress(
                status='error',
                filename=d.get('filename'),
            )
            if progress_callback:
                progress_callback(progress)
    
    # Get yt-dlp options from config
    ydl_opts = config.get_yt_dlp_options(progress_hook=progress_hook)
    
    # Override output path if specified
    if output_path:
        output_path = Path(output_path)
        output_path.mkdir(parents=True, exist_ok=True)
        ydl_opts['outtmpl'] = str(output_path / config.output_template)
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
            
        return downloaded_file or "Download completed"
        
    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e).lower()
        if 'video unavailable' in error_msg or 'private video' in error_msg:
            raise VideoNotFoundError(f"Video is unavailable or private: {url}")
        elif 'removed' in error_msg or 'deleted' in error_msg:
            raise VideoNotFoundError(f"Video has been removed: {url}")
        elif 'network' in error_msg or 'connection' in error_msg or 'timeout' in error_msg:
            raise NetworkError(f"Network error during download: {e}")
        else:
            raise DownloadError(f"Download error: {e}")
    except Exception as e:
        raise DownloadError(f"Unexpected error during download: {e}")


def get_random_delay(config: Optional[DownloadConfig] = None) -> float:
    """
    Get a random delay for rate limiting between downloads.
    
    Args:
        config: Optional download configuration.
        
    Returns:
        Random delay in seconds.
    """
    if config is None:
        config = get_config().download
    
    return random.uniform(
        config.delay_between_downloads_min,
        config.delay_between_downloads_max
    )


def apply_rate_limit(config: Optional[DownloadConfig] = None) -> None:
    """
    Apply rate limiting delay between downloads.
    
    Args:
        config: Optional download configuration.
    """
    delay = get_random_delay(config)
    time.sleep(delay)
