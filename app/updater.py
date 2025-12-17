# file: app/updater.py
"""
Update mechanism for YouTube Downloader.

Checks GitHub Releases for new versions and handles downloads.
"""

import os
import re
import tempfile
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

import requests
from packaging import version

# GitHub repository details
REPO_OWNER = "PrasanthChowhan"
REPO_NAME = "youtube-video-downloader"
GITHUB_API_URL = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/releases/latest"


@dataclass
class ReleaseInfo:
    """Information about a GitHub release."""
    version: str
    tag_name: str
    name: str
    body: str  # Release notes (markdown)
    html_url: str  # Link to release page
    download_url: Optional[str]  # Direct download URL for the asset
    asset_name: Optional[str]  # Name of the downloadable asset
    published_at: str


class UpdateChecker:
    """Handles checking for and downloading updates from GitHub."""
    
    def __init__(self, current_version: str):
        """
        Initialize the update checker.
        
        Args:
            current_version: The currently installed version string (e.g., "1.0.0").
        """
        self.current_version = current_version
        self._session = requests.Session()
        self._session.headers.update({
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": f"YTDownloader/{current_version}"
        })
    
    def check_for_updates(self) -> Optional[ReleaseInfo]:
        """
        Check GitHub for the latest release.
        
        Returns:
            ReleaseInfo if a newer version is available, None otherwise.
            
        Raises:
            requests.RequestException: If the API request fails.
        """
        try:
            response = self._session.get(GITHUB_API_URL, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            # Extract version from tag (remove 'v' prefix if present)
            tag_name = data.get("tag_name", "")
            latest_version = tag_name.lstrip("v")
            
            # Compare versions
            try:
                if version.parse(latest_version) <= version.parse(self.current_version):
                    return None  # No update available
            except version.InvalidVersion:
                # If version parsing fails, do string comparison
                if latest_version == self.current_version:
                    return None
            
            # Find the appropriate asset (prefer .exe for Windows)
            download_url = None
            asset_name = None
            assets = data.get("assets", [])
            
            for asset in assets:
                name = asset.get("name", "")
                # Prefer Windows executable
                if name.endswith(".exe"):
                    download_url = asset.get("browser_download_url")
                    asset_name = name
                    break
                # Fallback to zip
                elif name.endswith(".zip") and download_url is None:
                    download_url = asset.get("browser_download_url")
                    asset_name = name
            
            return ReleaseInfo(
                version=latest_version,
                tag_name=tag_name,
                name=data.get("name", f"Version {latest_version}"),
                body=data.get("body", "No release notes available."),
                html_url=data.get("html_url", ""),
                download_url=download_url,
                asset_name=asset_name,
                published_at=data.get("published_at", "")
            )
            
        except requests.RequestException as e:
            raise UpdateError(f"Failed to check for updates: {e}") from e
    
    def download_update(
        self,
        release: ReleaseInfo,
        destination: Optional[Path] = None,
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> Path:
        """
        Download the update asset.
        
        Args:
            release: The ReleaseInfo object containing download URL.
            destination: Optional destination path. Defaults to Downloads folder.
            progress_callback: Optional callback(downloaded_bytes, total_bytes).
            
        Returns:
            Path to the downloaded file.
            
        Raises:
            UpdateError: If download fails or no download URL is available.
        """
        if not release.download_url:
            raise UpdateError("No download URL available for this release.")
        
        if destination is None:
            downloads_folder = Path.home() / "Downloads"
            downloads_folder.mkdir(parents=True, exist_ok=True)
            destination = downloads_folder / (release.asset_name or f"YTDownloader-{release.version}.exe")
        
        try:
            response = self._session.get(release.download_url, stream=True, timeout=30)
            response.raise_for_status()
            
            total_size = int(response.headers.get("content-length", 0))
            downloaded = 0
            
            with open(destination, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if progress_callback:
                            progress_callback(downloaded, total_size)
            
            return destination
            
        except requests.RequestException as e:
            raise UpdateError(f"Failed to download update: {e}") from e
    
    def download_update_async(
        self,
        release: ReleaseInfo,
        destination: Optional[Path] = None,
        progress_callback: Optional[Callable[[int, int], None]] = None,
        complete_callback: Optional[Callable[[Path], None]] = None,
        error_callback: Optional[Callable[[str], None]] = None
    ) -> threading.Thread:
        """
        Download update in a background thread.
        
        Args:
            release: The ReleaseInfo object.
            destination: Optional destination path.
            progress_callback: Optional callback(downloaded_bytes, total_bytes).
            complete_callback: Optional callback(downloaded_path) on success.
            error_callback: Optional callback(error_message) on failure.
            
        Returns:
            The started Thread object.
        """
        def _download():
            try:
                path = self.download_update(release, destination, progress_callback)
                if complete_callback:
                    complete_callback(path)
            except UpdateError as e:
                if error_callback:
                    error_callback(str(e))
        
        thread = threading.Thread(target=_download, daemon=True)
        thread.start()
        return thread


class UpdateError(Exception):
    """Exception raised when update operations fail."""
    pass


def format_release_notes(body: str, max_length: int = 500) -> str:
    """
    Format release notes for display.
    
    Args:
        body: Raw markdown body from GitHub.
        max_length: Maximum length before truncation.
        
    Returns:
        Cleaned up release notes string.
    """
    # Remove HTML comments
    body = re.sub(r"<!--.*?-->", "", body, flags=re.DOTALL)
    # Remove excessive newlines
    body = re.sub(r"\n{3,}", "\n\n", body)
    # Truncate if too long
    if len(body) > max_length:
        body = body[:max_length].rsplit(" ", 1)[0] + "..."
    return body.strip()
