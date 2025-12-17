# file: yt_downloader/tests/test_downloader.py
"""
Unit tests for the downloader module.

Tests URL validation and utility functions.
Note: Actual download tests require network access and are skipped by default.
"""

import pytest
from app.downloader import (
    format_duration,
    format_size,
    validate_youtube_url,
)


class TestFormatDuration:
    """Tests for format_duration function."""
    
    def test_zero_seconds(self):
        assert format_duration(0) == "0:00"
    
    def test_seconds_only(self):
        assert format_duration(45) == "0:45"
    
    def test_minutes_and_seconds(self):
        assert format_duration(125) == "2:05"
    
    def test_hours_minutes_seconds(self):
        assert format_duration(3661) == "1:01:01"
    
    def test_large_duration(self):
        assert format_duration(86400) == "24:00:00"
    
    def test_none_value(self):
        assert format_duration(None) == "Unknown"
    
    def test_negative_value(self):
        assert format_duration(-1) == "Unknown"


class TestFormatSize:
    """Tests for format_size function."""
    
    def test_bytes(self):
        assert format_size(512) == "512.0 B"
    
    def test_kilobytes(self):
        result = format_size(1536)
        assert "KB" in result
    
    def test_megabytes(self):
        result = format_size(5 * 1024 * 1024)
        assert "MB" in result
    
    def test_gigabytes(self):
        result = format_size(2 * 1024 * 1024 * 1024)
        assert "GB" in result
    
    def test_zero_bytes(self):
        assert format_size(0) == "0.0 B"
    
    def test_none_value(self):
        assert format_size(None) == "Unknown"
    
    def test_negative_value(self):
        assert format_size(-1) == "Unknown"


class TestValidateYoutubeUrl:
    """Tests for validate_youtube_url function."""
    
    def test_standard_watch_url(self):
        assert validate_youtube_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    
    def test_watch_url_without_www(self):
        assert validate_youtube_url("https://youtube.com/watch?v=dQw4w9WgXcQ")
    
    def test_short_url(self):
        assert validate_youtube_url("https://youtu.be/dQw4w9WgXcQ")
    
    def test_shorts_url(self):
        assert validate_youtube_url("https://www.youtube.com/shorts/abc123xyz")
    
    def test_embed_url(self):
        assert validate_youtube_url("https://www.youtube.com/embed/dQw4w9WgXcQ")
    
    def test_http_url(self):
        assert validate_youtube_url("http://www.youtube.com/watch?v=dQw4w9WgXcQ")
    
    def test_url_with_extra_params(self):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest"
        assert validate_youtube_url(url)
    
    def test_invalid_empty_string(self):
        assert not validate_youtube_url("")
    
    def test_invalid_random_url(self):
        assert not validate_youtube_url("https://example.com/video")
    
    def test_invalid_partial_youtube(self):
        assert not validate_youtube_url("https://www.youtube.com/")
    
    def test_invalid_malformed(self):
        assert not validate_youtube_url("not a url at all")
    
    def test_url_with_whitespace(self):
        assert validate_youtube_url("  https://youtu.be/dQw4w9WgXcQ  ")


# Network-dependent tests (skipped by default)
@pytest.mark.skip(reason="Requires network access")
class TestFetchVideoInfo:
    """Integration tests for fetch_video_info (requires network)."""
    
    def test_fetch_valid_video(self):
        from app.downloader import fetch_video_info
        # Use a known public domain video
        info = fetch_video_info("https://www.youtube.com/watch?v=jNQXAC9IVRw")
        assert info.title is not None
        assert info.duration > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
