# file: yt_downloader/app/settings_manager.py
"""
Settings manager for persistent configuration storage.

Saves and loads settings from a JSON file in the user's config directory.
"""

import json
from pathlib import Path
from typing import Optional
from dataclasses import asdict

from .config import get_config, AppConfig, DownloadConfig


def get_settings_path() -> Path:
    """Get the path to the settings file."""
    # Use user's home directory for settings
    config_dir = Path.home() / ".yt_downloader"
    config_dir.mkdir(parents=True, exist_ok=True)
    return config_dir / "settings.json"


def save_settings(config: Optional[AppConfig] = None) -> bool:
    """
    Save current settings to JSON file.
    
    Args:
        config: Optional config to save. Uses global config if None.
        
    Returns:
        True if saved successfully, False otherwise.
    """
    if config is None:
        config = get_config()
    
    settings = {
        "download": {
            "default_download_path": str(config.download.default_download_path),
            "output_template_preset": config.download.output_template_preset,
            "custom_output_template": config.download.custom_output_template,
            "use_uploader_subfolder": config.download.use_uploader_subfolder,
            "use_date_subfolder": config.download.use_date_subfolder,
            "max_concurrent_downloads": config.download.max_concurrent_downloads,
            "delay_between_downloads_min": config.download.delay_between_downloads_min,
            "delay_between_downloads_max": config.download.delay_between_downloads_max,
        },
        "app": {
            "appearance_mode": config.appearance_mode,
            "color_theme": config.color_theme,
            "show_disclaimer": config.show_disclaimer,
            "window_width": config.window_width,
            "window_height": config.window_height,
        }
    }
    
    try:
        settings_path = get_settings_path()
        with open(settings_path, 'w', encoding='utf-8') as f:
            json.dump(settings, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving settings: {e}")
        return False


def load_settings() -> bool:
    """
    Load settings from JSON file into global config.
    
    Returns:
        True if loaded successfully, False otherwise.
    """
    settings_path = get_settings_path()
    
    if not settings_path.exists():
        return False
    
    try:
        with open(settings_path, 'r', encoding='utf-8') as f:
            settings = json.load(f)
        
        config = get_config()
        
        # Load download settings
        if "download" in settings:
            dl = settings["download"]
            if "default_download_path" in dl:
                config.download.default_download_path = Path(dl["default_download_path"])
            if "output_template_preset" in dl:
                config.download.output_template_preset = dl["output_template_preset"]
            if "custom_output_template" in dl:
                config.download.custom_output_template = dl["custom_output_template"]
            if "use_uploader_subfolder" in dl:
                config.download.use_uploader_subfolder = dl["use_uploader_subfolder"]
            if "use_date_subfolder" in dl:
                config.download.use_date_subfolder = dl["use_date_subfolder"]
            if "max_concurrent_downloads" in dl:
                config.download.max_concurrent_downloads = dl["max_concurrent_downloads"]
            if "delay_between_downloads_min" in dl:
                config.download.delay_between_downloads_min = dl["delay_between_downloads_min"]
            if "delay_between_downloads_max" in dl:
                config.download.delay_between_downloads_max = dl["delay_between_downloads_max"]
        
        # Load app settings
        if "app" in settings:
            app = settings["app"]
            if "appearance_mode" in app:
                config.appearance_mode = app["appearance_mode"]
            if "color_theme" in app:
                config.color_theme = app["color_theme"]
            if "show_disclaimer" in app:
                config.show_disclaimer = app["show_disclaimer"]
        
        return True
        
    except Exception as e:
        print(f"Error loading settings: {e}")
        return False


def reset_settings() -> bool:
    """
    Reset settings to defaults by deleting the settings file.
    
    Returns:
        True if reset successfully, False otherwise.
    """
    try:
        settings_path = get_settings_path()
        if settings_path.exists():
            settings_path.unlink()
        return True
    except Exception as e:
        print(f"Error resetting settings: {e}")
        return False
