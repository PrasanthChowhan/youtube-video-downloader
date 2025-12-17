# file: yt_downloader/app/queue_manager.py
"""
Download Queue Manager for handling multiple concurrent downloads.

Provides a thread-safe queue system with configurable concurrent download limits.
"""

import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, Future
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Callable, Dict, List
from pathlib import Path

from .downloader import (
    fetch_video_info,
    download_video,
    VideoInfo,
    DownloadProgress,
    DownloadError,
)
from .config import get_config


class DownloadStatus(Enum):
    """Status of a download item."""
    PENDING = "pending"
    FETCHING_INFO = "fetching_info"
    READY = "ready"
    DOWNLOADING = "downloading"
    PAUSED = "paused"
    COMPLETED = "completed"
    ERROR = "error"
    CANCELLED = "cancelled"


@dataclass
class DownloadItem:
    """Represents a single download in the queue."""
    
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    url: str = ""
    status: DownloadStatus = DownloadStatus.PENDING
    progress: float = 0.0  # 0-100
    speed: Optional[float] = None  # bytes/sec
    eta: Optional[int] = None  # seconds
    video_info: Optional[VideoInfo] = None
    error_message: Optional[str] = None
    output_path: Optional[Path] = None
    downloaded_file: Optional[str] = None
    
    @property
    def title(self) -> str:
        """Get video title or URL if not fetched yet."""
        if self.video_info:
            return self.video_info.title
        return self.url[:50] + "..." if len(self.url) > 50 else self.url
    
    @property
    def status_text(self) -> str:
        """Human-readable status text."""
        status_map = {
            DownloadStatus.PENDING: "⏳ Pending",
            DownloadStatus.FETCHING_INFO: "🔍 Fetching info...",
            DownloadStatus.READY: "✅ Ready",
            DownloadStatus.DOWNLOADING: f"📥 {self.progress:.1f}%",
            DownloadStatus.PAUSED: "⏸ Paused",
            DownloadStatus.COMPLETED: "✅ Completed",
            DownloadStatus.ERROR: f"❌ Error",
            DownloadStatus.CANCELLED: "🚫 Cancelled",
        }
        return status_map.get(self.status, "Unknown")


class DownloadQueue:
    """
    Thread-safe download queue manager.
    
    Handles multiple downloads with configurable concurrency limit.
    """
    
    def __init__(
        self,
        max_concurrent: int = 1,
        on_item_updated: Optional[Callable[[DownloadItem], None]] = None,
        on_queue_changed: Optional[Callable[[], None]] = None,
    ):
        """
        Initialize the download queue.
        
        Args:
            max_concurrent: Maximum number of concurrent downloads (1-3).
            on_item_updated: Callback when an item's status/progress changes.
            on_queue_changed: Callback when items are added/removed.
        """
        self._items: Dict[str, DownloadItem] = {}
        self._order: List[str] = []  # Maintains insertion order
        self._lock = threading.RLock()
        self._executor: Optional[ThreadPoolExecutor] = None
        self._futures: Dict[str, Future] = {}
        self._max_concurrent = min(max(1, max_concurrent), 3)
        self._on_item_updated = on_item_updated
        self._on_queue_changed = on_queue_changed
        self._is_running = False
        self._stop_event = threading.Event()
    
    @property
    def max_concurrent(self) -> int:
        """Get maximum concurrent downloads."""
        return self._max_concurrent
    
    @max_concurrent.setter
    def max_concurrent(self, value: int) -> None:
        """Set maximum concurrent downloads (1-3)."""
        self._max_concurrent = min(max(1, value), 3)
        # Recreate executor if running
        if self._executor:
            old_executor = self._executor
            self._executor = ThreadPoolExecutor(max_workers=self._max_concurrent)
            old_executor.shutdown(wait=False)
    
    @property
    def items(self) -> List[DownloadItem]:
        """Get all items in queue order."""
        with self._lock:
            return [self._items[id] for id in self._order if id in self._items]
    
    @property
    def active_count(self) -> int:
        """Count of currently downloading items."""
        with self._lock:
            return sum(1 for item in self._items.values() 
                      if item.status == DownloadStatus.DOWNLOADING)
    
    @property
    def pending_count(self) -> int:
        """Count of pending items."""
        with self._lock:
            return sum(1 for item in self._items.values() 
                      if item.status in (DownloadStatus.PENDING, DownloadStatus.READY))
    
    def add(self, url: str, output_path: Optional[Path] = None) -> DownloadItem:
        """
        Add a URL to the download queue.
        
        Args:
            url: YouTube video URL.
            output_path: Optional custom output directory.
            
        Returns:
            The created DownloadItem.
        """
        item = DownloadItem(
            url=url,
            output_path=output_path or get_config().download.get_output_path(),
        )
        
        with self._lock:
            self._items[item.id] = item
            self._order.append(item.id)
        
        if self._on_queue_changed:
            self._on_queue_changed()
        
        # Start fetching info immediately
        self._fetch_info_async(item)
        
        # Try to start download if queue is running
        if self._is_running:
            self._try_start_next()
        
        return item
    
    def remove(self, item_id: str) -> bool:
        """
        Remove an item from the queue.
        
        Args:
            item_id: ID of the item to remove.
            
        Returns:
            True if removed, False if not found.
        """
        with self._lock:
            if item_id not in self._items:
                return False
            
            item = self._items[item_id]
            
            # Cancel if downloading
            if item_id in self._futures:
                self._futures[item_id].cancel()
                del self._futures[item_id]
            
            item.status = DownloadStatus.CANCELLED
            del self._items[item_id]
            self._order.remove(item_id)
        
        if self._on_queue_changed:
            self._on_queue_changed()
        
        return True
    
    def clear(self) -> None:
        """Clear all items from the queue."""
        with self._lock:
            # Cancel all active downloads
            for future in self._futures.values():
                future.cancel()
            self._futures.clear()
            
            # Mark all as cancelled
            for item in self._items.values():
                item.status = DownloadStatus.CANCELLED
            
            self._items.clear()
            self._order.clear()
        
        if self._on_queue_changed:
            self._on_queue_changed()
    
    def start(self) -> None:
        """Start processing the queue."""
        if self._is_running:
            return
        
        self._stop_event.clear()
        self._is_running = True
        self._executor = ThreadPoolExecutor(max_workers=self._max_concurrent)
        
        # Start pending downloads
        self._try_start_next()
    
    def stop(self) -> None:
        """Stop processing the queue (pause all)."""
        self._is_running = False
        self._stop_event.set()
        
        # Don't cancel running downloads, just stop starting new ones
    
    def pause_item(self, item_id: str) -> bool:
        """Pause a specific item (cancel if downloading)."""
        with self._lock:
            if item_id not in self._items:
                return False
            
            item = self._items[item_id]
            
            if item.status == DownloadStatus.DOWNLOADING:
                if item_id in self._futures:
                    self._futures[item_id].cancel()
                    del self._futures[item_id]
                item.status = DownloadStatus.PAUSED
                self._notify_item_updated(item)
                return True
            elif item.status in (DownloadStatus.PENDING, DownloadStatus.READY):
                item.status = DownloadStatus.PAUSED
                self._notify_item_updated(item)
                return True
        
        return False
    
    def resume_item(self, item_id: str) -> bool:
        """Resume a paused item."""
        with self._lock:
            if item_id not in self._items:
                return False
            
            item = self._items[item_id]
            
            if item.status == DownloadStatus.PAUSED:
                item.status = DownloadStatus.READY if item.video_info else DownloadStatus.PENDING
                item.progress = 0.0
                self._notify_item_updated(item)
                
                if self._is_running:
                    self._try_start_next()
                return True
        
        return False
    
    def _fetch_info_async(self, item: DownloadItem) -> None:
        """Fetch video info in background."""
        def fetch():
            try:
                item.status = DownloadStatus.FETCHING_INFO
                self._notify_item_updated(item)
                
                info = fetch_video_info(item.url)
                item.video_info = info
                item.status = DownloadStatus.READY
                self._notify_item_updated(item)
                
                # Try to start if queue is running
                if self._is_running:
                    self._try_start_next()
                    
            except Exception as e:
                item.status = DownloadStatus.ERROR
                item.error_message = str(e)
                self._notify_item_updated(item)
        
        thread = threading.Thread(target=fetch, daemon=True)
        thread.start()
    
    def _try_start_next(self) -> None:
        """Try to start the next pending download if capacity allows."""
        if not self._is_running or not self._executor:
            return
        
        with self._lock:
            # Check if we can start more downloads
            if self.active_count >= self._max_concurrent:
                return
            
            # Find next ready item
            for item_id in self._order:
                item = self._items.get(item_id)
                if item and item.status == DownloadStatus.READY:
                    self._start_download(item)
                    break
    
    def _start_download(self, item: DownloadItem) -> None:
        """Start downloading an item."""
        if not self._executor:
            return
        
        item.status = DownloadStatus.DOWNLOADING
        item.progress = 0.0
        self._notify_item_updated(item)
        
        def download_task():
            try:
                def progress_callback(progress: DownloadProgress):
                    if self._stop_event.is_set():
                        return
                    item.progress = progress.percent
                    item.speed = progress.speed
                    item.eta = progress.eta
                    self._notify_item_updated(item)
                
                result = download_video(
                    item.url,
                    output_path=item.output_path,
                    progress_callback=progress_callback,
                )
                
                item.downloaded_file = result
                item.status = DownloadStatus.COMPLETED
                item.progress = 100.0
                self._notify_item_updated(item)
                
            except Exception as e:
                item.status = DownloadStatus.ERROR
                item.error_message = str(e)
                self._notify_item_updated(item)
            
            finally:
                # Remove from futures
                with self._lock:
                    if item.id in self._futures:
                        del self._futures[item.id]
                
                # Apply rate limit delay
                config = get_config().download
                delay = (config.delay_between_downloads_min + 
                        config.delay_between_downloads_max) / 2
                time.sleep(delay)
                
                # Try to start next
                self._try_start_next()
        
        future = self._executor.submit(download_task)
        self._futures[item.id] = future
    
    def _notify_item_updated(self, item: DownloadItem) -> None:
        """Notify that an item was updated."""
        if self._on_item_updated:
            self._on_item_updated(item)
    
    def shutdown(self) -> None:
        """Shutdown the queue manager."""
        self.stop()
        self.clear()
        if self._executor:
            self._executor.shutdown(wait=False)
            self._executor = None
