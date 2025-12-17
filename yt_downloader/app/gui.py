# file: yt_downloader/app/gui.py
"""
CustomTkinter GUI for the YouTube Downloader application.

Provides a modern dark-themed interface for downloading YouTube videos
with progress tracking and video information preview.
"""

import io
import threading
import tkinter as tk
from tkinter import filedialog, messagebox
from pathlib import Path
from typing import Optional

import customtkinter as ctk
from PIL import Image
import requests

from . import __app_name__, __version__
from .config import get_config, AppConfig
from .downloader import (
    fetch_video_info,
    download_video,
    VideoInfo,
    DownloadProgress,
    DownloadError,
    VideoNotFoundError,
    NetworkError,
    InvalidURLError,
    validate_youtube_url,
)


class DisclaimerDialog(ctk.CTkToplevel):
    """Disclaimer dialog shown at application startup."""
    
    def __init__(self, parent: ctk.CTk):
        super().__init__(parent)
        
        self.title("Important Notice")
        self.geometry("500x350")
        self.resizable(False, False)
        
        # Make modal
        self.transient(parent)
        self.grab_set()
        
        self.accepted = False
        
        self._create_widgets()
        
        # Center on parent
        self.update_idletasks()
        x = parent.winfo_x() + (parent.winfo_width() - self.winfo_width()) // 2
        y = parent.winfo_y() + (parent.winfo_height() - self.winfo_height()) // 2
        self.geometry(f"+{x}+{y}")
        
        # Handle window close
        self.protocol("WM_DELETE_WINDOW", self._on_decline)
    
    def _create_widgets(self) -> None:
        """Create dialog widgets."""
        # Title
        title_label = ctk.CTkLabel(
            self,
            text="⚠️ Personal Use Disclaimer",
            font=ctk.CTkFont(size=20, weight="bold"),
        )
        title_label.pack(pady=(20, 10))
        
        # Disclaimer text
        disclaimer_text = """
This application is intended for PERSONAL and FAIR USE ONLY.

By using this software, you agree to:

• Only download videos for which you have permission
• Respect YouTube's Terms of Service
• Use downloaded content for personal, educational, 
  or fair use purposes only
• Not redistribute copyrighted content
• Comply with all applicable laws in your jurisdiction

The developers are not responsible for any misuse
of this software. Use at your own risk.
        """
        
        text_label = ctk.CTkLabel(
            self,
            text=disclaimer_text,
            font=ctk.CTkFont(size=13),
            justify="left",
            wraplength=450,
        )
        text_label.pack(pady=10, padx=20)
        
        # Buttons frame
        button_frame = ctk.CTkFrame(self, fg_color="transparent")
        button_frame.pack(pady=20, fill="x", padx=40)
        
        decline_btn = ctk.CTkButton(
            button_frame,
            text="Decline",
            width=120,
            fg_color="gray40",
            hover_color="gray30",
            command=self._on_decline,
        )
        decline_btn.pack(side="left", padx=(0, 20))
        
        accept_btn = ctk.CTkButton(
            button_frame,
            text="I Accept",
            width=120,
            command=self._on_accept,
        )
        accept_btn.pack(side="right")
    
    def _on_accept(self) -> None:
        """Handle accept button click."""
        self.accepted = True
        self.destroy()
    
    def _on_decline(self) -> None:
        """Handle decline button click."""
        self.accepted = False
        self.destroy()


class YouTubeDownloaderApp(ctk.CTk):
    """Main application window for YouTube Downloader."""
    
    def __init__(self):
        super().__init__()
        
        self.config: AppConfig = get_config()
        self.current_video_info: Optional[VideoInfo] = None
        self.download_thread: Optional[threading.Thread] = None
        self.is_downloading: bool = False
        
        # Configure window
        self.title(f"{__app_name__} v{__version__}")
        self.geometry(f"{self.config.window_width}x{self.config.window_height}")
        self.minsize(self.config.min_width, self.config.min_height)
        
        # Set appearance
        ctk.set_appearance_mode(self.config.appearance_mode)
        ctk.set_default_color_theme(self.config.color_theme)
        
        # Create UI
        self._create_widgets()
        
        # Show disclaimer
        if self.config.show_disclaimer:
            self.after(100, self._show_disclaimer)
    
    def _show_disclaimer(self) -> None:
        """Show the disclaimer dialog."""
        dialog = DisclaimerDialog(self)
        self.wait_window(dialog)
        
        if not dialog.accepted:
            self.destroy()
    
    def _create_widgets(self) -> None:
        """Create all UI widgets."""
        # Main container
        self.main_frame = ctk.CTkFrame(self)
        self.main_frame.pack(fill="both", expand=True, padx=20, pady=20)
        
        # Header
        self._create_header()
        
        # URL Input Section
        self._create_url_section()
        
        # Video Info Section
        self._create_info_section()
        
        # Output Path Section
        self._create_output_section()
        
        # Download Section
        self._create_download_section()
        
        # Status Bar
        self._create_status_bar()
    
    def _create_header(self) -> None:
        """Create header section."""
        header_frame = ctk.CTkFrame(self.main_frame, fg_color="transparent")
        header_frame.pack(fill="x", pady=(0, 15))
        
        title_label = ctk.CTkLabel(
            header_frame,
            text=f"🎬 {__app_name__}",
            font=ctk.CTkFont(size=24, weight="bold"),
        )
        title_label.pack(side="left")
        
        version_label = ctk.CTkLabel(
            header_frame,
            text=f"v{__version__}",
            font=ctk.CTkFont(size=12),
            text_color="gray60",
        )
        version_label.pack(side="left", padx=(10, 0), pady=(8, 0))
    
    def _create_url_section(self) -> None:
        """Create URL input section."""
        url_frame = ctk.CTkFrame(self.main_frame)
        url_frame.pack(fill="x", pady=(0, 15))
        
        url_label = ctk.CTkLabel(
            url_frame,
            text="YouTube URL:",
            font=ctk.CTkFont(size=14, weight="bold"),
        )
        url_label.pack(anchor="w", padx=15, pady=(10, 5))
        
        input_frame = ctk.CTkFrame(url_frame, fg_color="transparent")
        input_frame.pack(fill="x", padx=15, pady=(0, 10))
        
        self.url_entry = ctk.CTkEntry(
            input_frame,
            placeholder_text="Paste YouTube URL here...",
            height=40,
            font=ctk.CTkFont(size=13),
        )
        self.url_entry.pack(side="left", fill="x", expand=True, padx=(0, 10))
        
        paste_btn = ctk.CTkButton(
            input_frame,
            text="📋 Paste",
            width=80,
            height=40,
            command=self._paste_url,
        )
        paste_btn.pack(side="left", padx=(0, 10))
        
        self.fetch_btn = ctk.CTkButton(
            input_frame,
            text="🔍 Fetch Info",
            width=110,
            height=40,
            command=self._fetch_info,
        )
        self.fetch_btn.pack(side="left")
    
    def _create_info_section(self) -> None:
        """Create video information display section."""
        self.info_frame = ctk.CTkFrame(self.main_frame)
        self.info_frame.pack(fill="x", pady=(0, 15))
        
        info_label = ctk.CTkLabel(
            self.info_frame,
            text="Video Information:",
            font=ctk.CTkFont(size=14, weight="bold"),
        )
        info_label.pack(anchor="w", padx=15, pady=(10, 5))
        
        content_frame = ctk.CTkFrame(self.info_frame, fg_color="transparent")
        content_frame.pack(fill="x", padx=15, pady=(0, 10))
        
        # Thumbnail
        self.thumbnail_label = ctk.CTkLabel(
            content_frame,
            text="No video loaded",
            width=160,
            height=90,
            fg_color="gray20",
            corner_radius=8,
        )
        self.thumbnail_label.pack(side="left", padx=(0, 15))
        
        # Video details
        details_frame = ctk.CTkFrame(content_frame, fg_color="transparent")
        details_frame.pack(side="left", fill="both", expand=True)
        
        self.title_label = ctk.CTkLabel(
            details_frame,
            text="Title: --",
            font=ctk.CTkFont(size=13, weight="bold"),
            anchor="w",
            wraplength=400,
        )
        self.title_label.pack(fill="x", pady=(0, 5))
        
        self.uploader_label = ctk.CTkLabel(
            details_frame,
            text="Channel: --",
            font=ctk.CTkFont(size=12),
            anchor="w",
        )
        self.uploader_label.pack(fill="x", pady=(0, 3))
        
        self.duration_label = ctk.CTkLabel(
            details_frame,
            text="Duration: --",
            font=ctk.CTkFont(size=12),
            anchor="w",
        )
        self.duration_label.pack(fill="x", pady=(0, 3))
        
        self.size_label = ctk.CTkLabel(
            details_frame,
            text="Est. Size: --",
            font=ctk.CTkFont(size=12),
            anchor="w",
        )
        self.size_label.pack(fill="x")
    
    def _create_output_section(self) -> None:
        """Create output path selection section."""
        output_frame = ctk.CTkFrame(self.main_frame)
        output_frame.pack(fill="x", pady=(0, 15))
        
        output_label = ctk.CTkLabel(
            output_frame,
            text="Output Folder:",
            font=ctk.CTkFont(size=14, weight="bold"),
        )
        output_label.pack(anchor="w", padx=15, pady=(10, 5))
        
        path_frame = ctk.CTkFrame(output_frame, fg_color="transparent")
        path_frame.pack(fill="x", padx=15, pady=(0, 10))
        
        default_path = str(self.config.download.get_output_path())
        self.output_entry = ctk.CTkEntry(
            path_frame,
            height=40,
            font=ctk.CTkFont(size=12),
        )
        self.output_entry.insert(0, default_path)
        self.output_entry.pack(side="left", fill="x", expand=True, padx=(0, 10))
        
        browse_btn = ctk.CTkButton(
            path_frame,
            text="📁 Browse",
            width=100,
            height=40,
            command=self._browse_output,
        )
        browse_btn.pack(side="left")
    
    def _create_download_section(self) -> None:
        """Create download button and progress section."""
        download_frame = ctk.CTkFrame(self.main_frame)
        download_frame.pack(fill="x", pady=(0, 15))
        
        # Download button
        self.download_btn = ctk.CTkButton(
            download_frame,
            text="⬇️ Download",
            height=50,
            font=ctk.CTkFont(size=16, weight="bold"),
            command=self._start_download,
        )
        self.download_btn.pack(fill="x", padx=15, pady=15)
        
        # Progress section
        progress_frame = ctk.CTkFrame(download_frame, fg_color="transparent")
        progress_frame.pack(fill="x", padx=15, pady=(0, 15))
        
        self.progress_bar = ctk.CTkProgressBar(progress_frame)
        self.progress_bar.pack(fill="x", pady=(0, 10))
        self.progress_bar.set(0)
        
        stats_frame = ctk.CTkFrame(progress_frame, fg_color="transparent")
        stats_frame.pack(fill="x")
        
        self.percent_label = ctk.CTkLabel(
            stats_frame,
            text="0%",
            font=ctk.CTkFont(size=12, weight="bold"),
        )
        self.percent_label.pack(side="left")
        
        self.eta_label = ctk.CTkLabel(
            stats_frame,
            text="ETA: --:--",
            font=ctk.CTkFont(size=12),
        )
        self.eta_label.pack(side="left", padx=(20, 0))
        
        self.speed_label = ctk.CTkLabel(
            stats_frame,
            text="Speed: -- B/s",
            font=ctk.CTkFont(size=12),
        )
        self.speed_label.pack(side="right")
    
    def _create_status_bar(self) -> None:
        """Create status bar at bottom."""
        self.status_label = ctk.CTkLabel(
            self.main_frame,
            text="Ready",
            font=ctk.CTkFont(size=11),
            text_color="gray60",
            anchor="w",
        )
        self.status_label.pack(fill="x")
    
    def _paste_url(self) -> None:
        """Paste URL from clipboard."""
        try:
            clipboard = self.clipboard_get()
            self.url_entry.delete(0, "end")
            self.url_entry.insert(0, clipboard.strip())
            self._set_status("URL pasted from clipboard")
        except tk.TclError:
            self._set_status("Clipboard is empty")
    
    def _browse_output(self) -> None:
        """Open folder browser dialog."""
        folder = filedialog.askdirectory(
            title="Select Output Folder",
            initialdir=self.output_entry.get() or str(Path.home()),
        )
        if folder:
            self.output_entry.delete(0, "end")
            self.output_entry.insert(0, folder)
            self._set_status(f"Output folder: {folder}")
    
    def _fetch_info(self) -> None:
        """Fetch video information in background thread."""
        url = self.url_entry.get().strip()
        
        if not url:
            messagebox.showwarning("Warning", "Please enter a YouTube URL")
            return
        
        if not validate_youtube_url(url):
            messagebox.showerror("Error", "Invalid YouTube URL format")
            return
        
        self._set_status("Fetching video information...")
        self.fetch_btn.configure(state="disabled")
        
        def fetch_thread():
            try:
                info = fetch_video_info(url)
                self.after(0, lambda: self._update_video_info(info))
            except InvalidURLError as e:
                self.after(0, lambda: self._show_error("Invalid URL", str(e)))
            except VideoNotFoundError as e:
                self.after(0, lambda: self._show_error("Video Not Found", str(e)))
            except NetworkError as e:
                self.after(0, lambda: self._show_error("Network Error", str(e)))
            except DownloadError as e:
                self.after(0, lambda: self._show_error("Error", str(e)))
            finally:
                self.after(0, lambda: self.fetch_btn.configure(state="normal"))
        
        thread = threading.Thread(target=fetch_thread, daemon=True)
        thread.start()
    
    def _update_video_info(self, info: VideoInfo) -> None:
        """Update UI with video information."""
        self.current_video_info = info
        
        self.title_label.configure(text=f"Title: {info.title}")
        self.uploader_label.configure(text=f"Channel: {info.uploader}")
        self.duration_label.configure(text=f"Duration: {info.duration_str}")
        self.size_label.configure(text=f"Est. Size: {info.filesize_str}")
        
        self._set_status("Video info loaded successfully")
        
        # Load thumbnail in background
        if info.thumbnail_url:
            def load_thumbnail():
                try:
                    response = requests.get(info.thumbnail_url, timeout=10)
                    if response.status_code == 200:
                        image_data = io.BytesIO(response.content)
                        pil_image = Image.open(image_data)
                        pil_image = pil_image.resize((160, 90), Image.Resampling.LANCZOS)
                        ctk_image = ctk.CTkImage(
                            light_image=pil_image,
                            dark_image=pil_image,
                            size=(160, 90),
                        )
                        self.after(0, lambda: self.thumbnail_label.configure(
                            image=ctk_image,
                            text="",
                        ))
                        # Keep reference to prevent garbage collection
                        self.thumbnail_label.image = ctk_image
                except Exception:
                    pass  # Silently fail for thumbnail
            
            thread = threading.Thread(target=load_thumbnail, daemon=True)
            thread.start()
    
    def _start_download(self) -> None:
        """Start video download in background thread."""
        url = self.url_entry.get().strip()
        
        if not url:
            messagebox.showwarning("Warning", "Please enter a YouTube URL")
            return
        
        if not validate_youtube_url(url):
            messagebox.showerror("Error", "Invalid YouTube URL format")
            return
        
        if self.is_downloading:
            messagebox.showinfo("Info", "A download is already in progress")
            return
        
        output_path = Path(self.output_entry.get().strip())
        
        # Reset progress
        self.progress_bar.set(0)
        self.percent_label.configure(text="0%")
        self.eta_label.configure(text="ETA: --:--")
        self.speed_label.configure(text="Speed: -- B/s")
        
        self.is_downloading = True
        self.download_btn.configure(state="disabled", text="⏳ Downloading...")
        self._set_status("Starting download...")
        
        def download_thread():
            try:
                download_video(
                    url,
                    output_path=output_path,
                    progress_callback=lambda p: self.after(0, lambda: self._update_progress(p)),
                )
                self.after(0, self._download_complete)
            except (InvalidURLError, VideoNotFoundError, NetworkError, DownloadError) as e:
                self.after(0, lambda: self._download_error(str(e)))
            except Exception as e:
                self.after(0, lambda: self._download_error(f"Unexpected error: {e}"))
        
        self.download_thread = threading.Thread(target=download_thread, daemon=True)
        self.download_thread.start()
    
    def _update_progress(self, progress: DownloadProgress) -> None:
        """Update progress UI."""
        self.progress_bar.set(progress.percent / 100)
        self.percent_label.configure(text=progress.percent_str)
        self.eta_label.configure(text=f"ETA: {progress.eta_str}")
        self.speed_label.configure(text=f"Speed: {progress.speed_str}")
        self._set_status(f"Downloading... {progress.percent_str}")
    
    def _download_complete(self) -> None:
        """Handle download completion."""
        self.is_downloading = False
        self.download_btn.configure(state="normal", text="⬇️ Download")
        self.progress_bar.set(1)
        self.percent_label.configure(text="100%")
        self._set_status("Download completed successfully!")
        messagebox.showinfo("Success", "Download completed successfully!")
    
    def _download_error(self, error_msg: str) -> None:
        """Handle download error."""
        self.is_downloading = False
        self.download_btn.configure(state="normal", text="⬇️ Download")
        self.progress_bar.set(0)
        self._set_status("Download failed")
        messagebox.showerror("Download Error", error_msg)
    
    def _show_error(self, title: str, message: str) -> None:
        """Show error message and update status."""
        self._set_status(f"Error: {title}")
        messagebox.showerror(title, message)
    
    def _set_status(self, message: str) -> None:
        """Update status bar message."""
        self.status_label.configure(text=message)


def main() -> None:
    """Application entry point."""
    app = YouTubeDownloaderApp()
    app.mainloop()


if __name__ == "__main__":
    main()
