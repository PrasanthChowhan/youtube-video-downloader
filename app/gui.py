# file: yt_downloader/app/gui.py
"""
CustomTkinter GUI for the YouTube Downloader application.

Simple single-download interface with settings persistence.
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
from .settings_manager import save_settings, load_settings
from .updater import UpdateChecker, UpdateError, ReleaseInfo, format_release_notes
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
    normalize_youtube_url,
    format_duration,
    format_size,
)


class DisclaimerDialog(ctk.CTkToplevel):
    """Disclaimer dialog shown at application startup."""
    
    def __init__(self, parent: ctk.CTk):
        super().__init__(parent)
        self.title("Important Notice")
        self.geometry("500x350")
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()
        self.accepted = False
        self._create_widgets()
        self.update_idletasks()
        x = parent.winfo_x() + (parent.winfo_width() - self.winfo_width()) // 2
        y = parent.winfo_y() + (parent.winfo_height() - self.winfo_height()) // 2
        self.geometry(f"+{x}+{y}")
        self.protocol("WM_DELETE_WINDOW", self._on_decline)
    
    def _create_widgets(self) -> None:
        ctk.CTkLabel(self, text="⚠️ Personal Use Disclaimer",
            font=ctk.CTkFont(size=20, weight="bold")).pack(pady=(20, 10))
        
        disclaimer_text = """
This application is intended for PERSONAL and FAIR USE ONLY.

By using this software, you agree to:

• Only download videos for which you have permission
• Respect YouTube's Terms of Service
• Use downloaded content for personal, educational, 
  or fair use purposes only
• Not redistribute copyrighted content

The developers are not responsible for any misuse.
        """
        ctk.CTkLabel(self, text=disclaimer_text, font=ctk.CTkFont(size=13),
            justify="left", wraplength=450).pack(pady=10, padx=20)
        
        button_frame = ctk.CTkFrame(self, fg_color="transparent")
        button_frame.pack(pady=20, fill="x", padx=40)
        ctk.CTkButton(button_frame, text="Decline", width=120,
            fg_color="gray40", hover_color="gray30", 
            command=self._on_decline).pack(side="left")
        ctk.CTkButton(button_frame, text="I Accept", width=120,
            command=self._on_accept).pack(side="right")
    
    def _on_accept(self) -> None:
        self.accepted = True
        self.destroy()
    
    def _on_decline(self) -> None:
        self.accepted = False
        self.destroy()


class UpdateDialog(ctk.CTkToplevel):
    """Dialog for showing update information and downloading."""
    
    def __init__(self, parent: ctk.CTk, release: ReleaseInfo):
        super().__init__(parent)
        self.title("🚀 Update Available")
        self.geometry("500x400")
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()
        self.release = release
        self.parent_window = parent
        self._downloading = False
        self._create_widgets()
        self.update_idletasks()
        x = parent.winfo_x() + (parent.winfo_width() - self.winfo_width()) // 2
        y = parent.winfo_y() + (parent.winfo_height() - self.winfo_height()) // 2
        self.geometry(f"+{x}+{y}")
    
    def _create_widgets(self) -> None:
        # Header
        ctk.CTkLabel(self, text=f"🎉 Version {self.release.version} Available!",
            font=ctk.CTkFont(size=18, weight="bold")).pack(pady=(20, 10))
        
        ctk.CTkLabel(self, text=f"Current: v{__version__} → New: v{self.release.version}",
            text_color="gray60").pack(pady=(0, 15))
        
        # Release notes
        notes_frame = ctk.CTkFrame(self)
        notes_frame.pack(fill="both", expand=True, padx=20, pady=(0, 10))
        ctk.CTkLabel(notes_frame, text="📝 Release Notes:",
            font=ctk.CTkFont(size=13, weight="bold")).pack(anchor="w", padx=10, pady=(10, 5))
        
        notes_text = ctk.CTkTextbox(notes_frame, height=150, wrap="word")
        notes_text.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        notes_text.insert("1.0", format_release_notes(self.release.body, max_length=800))
        notes_text.configure(state="disabled")
        
        # Progress bar (hidden initially)
        self.progress_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.progress_frame.pack(fill="x", padx=20)
        self.progress_bar = ctk.CTkProgressBar(self.progress_frame)
        self.progress_bar.set(0)
        self.progress_label = ctk.CTkLabel(self.progress_frame, text="")
        
        # Buttons
        button_frame = ctk.CTkFrame(self, fg_color="transparent")
        button_frame.pack(fill="x", padx=20, pady=15)
        
        ctk.CTkButton(button_frame, text="Later", width=100,
            fg_color="gray40", hover_color="gray30",
            command=self.destroy).pack(side="left")
        
        self.download_btn = ctk.CTkButton(button_frame, text="⬇️ Download & Install", width=160,
            command=self._start_download)
        self.download_btn.pack(side="right")
        
        if not self.release.download_url:
            self.download_btn.configure(state="disabled", text="No download available")
    
    def _start_download(self) -> None:
        if self._downloading:
            return
        self._downloading = True
        self.download_btn.configure(state="disabled", text="⏳ Downloading...")
        
        # Show progress bar
        self.progress_bar.pack(fill="x", pady=(0, 5))
        self.progress_label.pack()
        
        checker = UpdateChecker(__version__)
        
        def on_progress(downloaded: int, total: int):
            if total > 0:
                pct = downloaded / total
                self.after(0, lambda: self._update_progress(pct, downloaded, total))
        
        def on_complete(path):
            self.after(0, lambda: self._download_complete(path))
        
        def on_error(msg: str):
            self.after(0, lambda: self._download_error(msg))
        
        checker.download_update_async(
            self.release,
            progress_callback=on_progress,
            complete_callback=on_complete,
            error_callback=on_error
        )
    
    def _update_progress(self, pct: float, downloaded: int, total: int) -> None:
        self.progress_bar.set(pct)
        mb_down = downloaded / (1024 * 1024)
        mb_total = total / (1024 * 1024)
        self.progress_label.configure(text=f"{mb_down:.1f} / {mb_total:.1f} MB")
    
    def _download_complete(self, path) -> None:
        self._downloading = False
        self.download_btn.configure(text="✅ Downloaded!")
        self.progress_bar.set(1)
        self.progress_label.configure(text=f"Saved to: {path}")
        
        # Ask user to run installer
        if messagebox.askyesno("Install Update", 
            f"Update downloaded to:\n{path}\n\nWould you like to run the installer now?\nThe application will close."):
            import subprocess
            import sys
            subprocess.Popen([str(path)], shell=True)
            self.parent_window.destroy()
    
    def _download_error(self, msg: str) -> None:
        self._downloading = False
        self.download_btn.configure(state="normal", text="⬇️ Retry Download")
        self.progress_label.configure(text="Download failed")
        messagebox.showerror("Download Failed", msg)


class SettingsDialog(ctk.CTkToplevel):
    """Settings dialog for download preferences."""
    
    def __init__(self, parent: ctk.CTk, config: AppConfig):
        super().__init__(parent)
        self.title("⚙️ Settings")
        self.geometry("480x450")  # Increased height for update button
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()
        self.config = config
        self.saved = False
        self.parent_window = parent
        self._create_widgets()
        self.update_idletasks()
        x = parent.winfo_x() + (parent.winfo_width() - self.winfo_width()) // 2
        y = parent.winfo_y() + (parent.winfo_height() - self.winfo_height()) // 2
        self.geometry(f"+{x}+{y}")
    
    def _create_widgets(self) -> None:
        # Download Location
        loc_frame = ctk.CTkFrame(self)
        loc_frame.pack(fill="x", padx=20, pady=(20, 10))
        ctk.CTkLabel(loc_frame, text="📁 Download Location",
            font=ctk.CTkFont(size=14, weight="bold")).pack(anchor="w", padx=15, pady=(10, 5))
        
        path_frame = ctk.CTkFrame(loc_frame, fg_color="transparent")
        path_frame.pack(fill="x", padx=15, pady=(0, 10))
        self.path_entry = ctk.CTkEntry(path_frame, height=35)
        self.path_entry.insert(0, str(self.config.download.default_download_path))
        self.path_entry.pack(side="left", fill="x", expand=True, padx=(0, 10))
        ctk.CTkButton(path_frame, text="Browse", width=80, height=35,
            command=self._browse_folder).pack(side="left")
        
        # Folder Structure
        folder_frame = ctk.CTkFrame(self)
        folder_frame.pack(fill="x", padx=20, pady=10)
        ctk.CTkLabel(folder_frame, text="📂 Folder Structure",
            font=ctk.CTkFont(size=14, weight="bold")).pack(anchor="w", padx=15, pady=(10, 5))
        
        self.folder_var = tk.StringVar(value=self.config.download.output_template_preset)
        options = [
            ("uploader_title", "Channel / Video Title"),
            ("uploader_only", "Channel folder only"),
            ("direct", "Direct (no subfolders)"),
        ]
        for value, text in options:
            ctk.CTkRadioButton(folder_frame, text=text, 
                variable=self.folder_var, value=value).pack(anchor="w", padx=25, pady=3)
        
        # Updates Section
        update_frame = ctk.CTkFrame(self)
        update_frame.pack(fill="x", padx=20, pady=10)
        ctk.CTkLabel(update_frame, text="🔄 Updates",
            font=ctk.CTkFont(size=14, weight="bold")).pack(anchor="w", padx=15, pady=(10, 5))
        
        update_btn_frame = ctk.CTkFrame(update_frame, fg_color="transparent")
        update_btn_frame.pack(fill="x", padx=15, pady=(0, 10))
        
        self.update_btn = ctk.CTkButton(update_btn_frame, text="🔍 Check for Updates",
            command=self._check_for_updates)
        self.update_btn.pack(side="left")
        
        self.update_status = ctk.CTkLabel(update_btn_frame, text=f"Current: v{__version__}",
            text_color="gray60")
        self.update_status.pack(side="right")
        
        # Buttons
        button_frame = ctk.CTkFrame(self, fg_color="transparent")
        button_frame.pack(fill="x", padx=20, pady=20)
        ctk.CTkButton(button_frame, text="Cancel", width=100,
            fg_color="gray40", hover_color="gray30",
            command=self.destroy).pack(side="left")
        ctk.CTkButton(button_frame, text="💾 Save", width=100,
            command=self._save).pack(side="right")
    
    def _browse_folder(self) -> None:
        folder = filedialog.askdirectory(title="Select Download Folder",
            initialdir=self.path_entry.get() or str(Path.home()))
        if folder:
            self.path_entry.delete(0, "end")
            self.path_entry.insert(0, folder)
    
    def _save(self) -> None:
        self.config.download.default_download_path = Path(self.path_entry.get())
        self.config.download.output_template_preset = self.folder_var.get()
        if save_settings(self.config):
            self.saved = True
            self.destroy()
        else:
            messagebox.showerror("Error", "Failed to save settings")
    
    def _check_for_updates(self) -> None:
        """Check GitHub for updates."""
        self.update_btn.configure(state="disabled", text="⏳ Checking...")
        self.update_status.configure(text="Checking...")
        
        def check():
            try:
                checker = UpdateChecker(__version__)
                release = checker.check_for_updates()
                self.after(0, lambda: self._on_check_complete(release))
            except UpdateError as e:
                self.after(0, lambda: self._on_check_error(str(e)))
            except Exception as e:
                self.after(0, lambda: self._on_check_error(str(e)))
        
        threading.Thread(target=check, daemon=True).start()
    
    def _on_check_complete(self, release: Optional[ReleaseInfo]) -> None:
        self.update_btn.configure(state="normal", text="🔍 Check for Updates")
        if release:
            self.update_status.configure(text=f"New: v{release.version} available!", text_color="#4CAF50")
            # Show update dialog
            self.grab_release()
            UpdateDialog(self.parent_window, release)
        else:
            self.update_status.configure(text="✅ You're up to date!", text_color="#4CAF50")
    
    def _on_check_error(self, msg: str) -> None:
        self.update_btn.configure(state="normal", text="🔍 Check for Updates")
        self.update_status.configure(text="❌ Check failed", text_color="#F44336")
        messagebox.showerror("Update Check Failed", msg)


class YouTubeDownloaderApp(ctk.CTk):
    """Main application window - simple single download."""
    
    def __init__(self):
        super().__init__()
        
        # Load saved settings
        load_settings()
        self.config: AppConfig = get_config()
        self.current_video_info: Optional[VideoInfo] = None
        self.is_downloading: bool = False
        
        # Window setup
        self.title(f"{__app_name__} v{__version__}")
        self.geometry("700x550")
        self.minsize(600, 500)
        
        ctk.set_appearance_mode(self.config.appearance_mode)
        ctk.set_default_color_theme(self.config.color_theme)
        
        self._create_widgets()
        
        if self.config.show_disclaimer:
            self.after(100, self._show_disclaimer)
    
    def _show_disclaimer(self) -> None:
        dialog = DisclaimerDialog(self)
        self.wait_window(dialog)
        if not dialog.accepted:
            self.destroy()
    
    def _create_widgets(self) -> None:
        main = ctk.CTkFrame(self)
        main.pack(fill="both", expand=True, padx=20, pady=20)
        
        # Header
        header = ctk.CTkFrame(main, fg_color="transparent")
        header.pack(fill="x", pady=(0, 15))
        ctk.CTkLabel(header, text=f"🎬 {__app_name__}",
            font=ctk.CTkFont(size=24, weight="bold")).pack(side="left")
        ctk.CTkButton(header, text="⚙️", width=40,
            command=self._open_settings).pack(side="right")
        
        # URL Input
        url_frame = ctk.CTkFrame(main)
        url_frame.pack(fill="x", pady=(0, 15))
        ctk.CTkLabel(url_frame, text="YouTube URL:",
            font=ctk.CTkFont(size=14, weight="bold")).pack(anchor="w", padx=15, pady=(10, 5))
        
        input_frame = ctk.CTkFrame(url_frame, fg_color="transparent")
        input_frame.pack(fill="x", padx=15, pady=(0, 10))
        self.url_entry = ctk.CTkEntry(input_frame, 
            placeholder_text="Paste YouTube URL here...", height=40)
        self.url_entry.pack(side="left", fill="x", expand=True, padx=(0, 10))
        ctk.CTkButton(input_frame, text="📋 Paste", width=80, height=40,
            command=self._paste_url).pack(side="left", padx=(0, 10))
        self.fetch_btn = ctk.CTkButton(input_frame, text="🔍 Fetch", width=80, height=40,
            command=self._fetch_info)
        self.fetch_btn.pack(side="left")
        
        # Video Info
        info_frame = ctk.CTkFrame(main)
        info_frame.pack(fill="x", pady=(0, 15))
        ctk.CTkLabel(info_frame, text="Video Info:",
            font=ctk.CTkFont(size=14, weight="bold")).pack(anchor="w", padx=15, pady=(10, 5))
        
        content = ctk.CTkFrame(info_frame, fg_color="transparent")
        content.pack(fill="x", padx=15, pady=(0, 10))
        
        self.thumbnail_label = ctk.CTkLabel(content, text="No video", width=160, height=90,
            fg_color="gray20", corner_radius=8)
        self.thumbnail_label.pack(side="left", padx=(0, 15))
        
        details = ctk.CTkFrame(content, fg_color="transparent")
        details.pack(side="left", fill="both", expand=True)
        self.title_label = ctk.CTkLabel(details, text="Title: --",
            font=ctk.CTkFont(size=13, weight="bold"), anchor="w", wraplength=350)
        self.title_label.pack(fill="x", pady=(0, 5))
        self.channel_label = ctk.CTkLabel(details, text="Channel: --", anchor="w")
        self.channel_label.pack(fill="x")
        self.duration_label = ctk.CTkLabel(details, text="Duration: --", anchor="w")
        self.duration_label.pack(fill="x")
        self.size_label = ctk.CTkLabel(details, text="Size: --", anchor="w")
        self.size_label.pack(fill="x")
        
        # Download Section
        dl_frame = ctk.CTkFrame(main)
        dl_frame.pack(fill="x", pady=(0, 15))
        
        self.download_btn = ctk.CTkButton(dl_frame, text="⬇️ Download", height=50,
            font=ctk.CTkFont(size=16, weight="bold"), command=self._start_download)
        self.download_btn.pack(fill="x", padx=15, pady=15)
        
        prog_frame = ctk.CTkFrame(dl_frame, fg_color="transparent")
        prog_frame.pack(fill="x", padx=15, pady=(0, 15))
        self.progress_bar = ctk.CTkProgressBar(prog_frame)
        self.progress_bar.pack(fill="x", pady=(0, 5))
        self.progress_bar.set(0)
        
        stats = ctk.CTkFrame(prog_frame, fg_color="transparent")
        stats.pack(fill="x")
        self.percent_label = ctk.CTkLabel(stats, text="0%", font=ctk.CTkFont(weight="bold"))
        self.percent_label.pack(side="left")
        self.speed_label = ctk.CTkLabel(stats, text="")
        self.speed_label.pack(side="right")
        self.eta_label = ctk.CTkLabel(stats, text="")
        self.eta_label.pack(side="right", padx=(0, 20))
        
        # Status
        self.status_label = ctk.CTkLabel(main, text="Ready", text_color="gray60", anchor="w")
        self.status_label.pack(fill="x")
    
    def _paste_url(self) -> None:
        try:
            raw_url = self.clipboard_get().strip()
            # Normalize the URL to remove playlist params, tracking, etc.
            clean_url = normalize_youtube_url(raw_url)
            self.url_entry.delete(0, "end")
            self.url_entry.insert(0, clean_url)
        except tk.TclError:
            pass
    
    def _fetch_info(self) -> None:
        url = self.url_entry.get().strip()
        if not url:
            messagebox.showwarning("Warning", "Please enter a URL")
            return
        if not validate_youtube_url(url):
            messagebox.showerror("Error", "Invalid YouTube URL")
            return
        
        # Normalize URL and update the entry field
        url = normalize_youtube_url(url)
        self.url_entry.delete(0, "end")
        self.url_entry.insert(0, url)
        
        self._set_status("🔍 Fetching video info...")
        self.fetch_btn.configure(state="disabled")
        
        def fetch():
            try:
                info = fetch_video_info(url)
                self.after(0, lambda: self._update_info(info))
            except Exception as e:
                err = str(e)
                self.after(0, lambda: self._show_error(err))
            finally:
                self.after(0, lambda: self.fetch_btn.configure(state="normal"))
        
        threading.Thread(target=fetch, daemon=True).start()
    
    def _update_info(self, info: VideoInfo) -> None:
        self.current_video_info = info
        self.title_label.configure(text=f"Title: {info.title[:60]}...")
        self.channel_label.configure(text=f"Channel: {info.uploader}")
        self.duration_label.configure(text=f"Duration: {info.duration_str}")
        self.size_label.configure(text=f"Size: {info.filesize_str}")
        self._set_status("✅ Ready to download")
        
        # Load thumbnail
        if info.thumbnail_url:
            def load_thumb():
                try:
                    resp = requests.get(info.thumbnail_url, timeout=10)
                    if resp.status_code == 200:
                        img = Image.open(io.BytesIO(resp.content))
                        img = img.resize((160, 90), Image.Resampling.LANCZOS)
                        ctk_img = ctk.CTkImage(light_image=img, dark_image=img, size=(160, 90))
                        self.after(0, lambda: self.thumbnail_label.configure(image=ctk_img, text=""))
                        self.thumbnail_label.image = ctk_img
                except Exception:
                    pass
            threading.Thread(target=load_thumb, daemon=True).start()
    
    def _show_error(self, msg: str) -> None:
        self._set_status(f"❌ Error")
        messagebox.showerror("Error", msg)
    
    def _start_download(self) -> None:
        url = self.url_entry.get().strip()
        if not url:
            messagebox.showwarning("Warning", "Please enter a URL")
            return
        if not validate_youtube_url(url):
            messagebox.showerror("Error", "Invalid YouTube URL")
            return
        if self.is_downloading:
            return
        
        self.is_downloading = True
        self.download_btn.configure(state="disabled", text="⏳ Downloading...")
        self.progress_bar.set(0)
        self._set_status("📥 Starting download...")
        
        def download():
            try:
                def on_progress(p: DownloadProgress):
                    self.after(0, lambda: self._update_progress(p))
                
                download_video(url, 
                    output_path=self.config.download.default_download_path,
                    progress_callback=on_progress)
                self.after(0, self._download_complete)
            except Exception as e:
                err = str(e)
                self.after(0, lambda: self._download_error(err))
        
        threading.Thread(target=download, daemon=True).start()
    
    def _update_progress(self, p: DownloadProgress) -> None:
        self.progress_bar.set(p.percent / 100)
        self.percent_label.configure(text=f"{p.percent:.1f}%")
        self.speed_label.configure(text=p.speed_str)
        self.eta_label.configure(text=f"ETA: {p.eta_str}")
        self._set_status(f"📥 Downloading... {p.percent:.0f}%")
    
    def _download_complete(self) -> None:
        self.is_downloading = False
        self.download_btn.configure(state="normal", text="⬇️ Download")
        self.progress_bar.set(1)
        self.percent_label.configure(text="100%")
        self._set_status("✅ Download complete!")
        messagebox.showinfo("Success", "Download completed!")
    
    def _download_error(self, msg: str) -> None:
        self.is_downloading = False
        self.download_btn.configure(state="normal", text="⬇️ Download")
        self.progress_bar.set(0)
        self._set_status("❌ Download failed")
        messagebox.showerror("Error", msg)
    
    def _open_settings(self) -> None:
        dialog = SettingsDialog(self, self.config)
        self.wait_window(dialog)
        if dialog.saved:
            self._set_status("✅ Settings saved")
    
    def _set_status(self, msg: str) -> None:
        self.status_label.configure(text=msg)


def main() -> None:
    app = YouTubeDownloaderApp()
    app.mainloop()


if __name__ == "__main__":
    main()
