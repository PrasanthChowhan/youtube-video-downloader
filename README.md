# YouTube Downloader

A cross-platform YouTube downloader with a modern dark-theme GUI, built with Python 3.12, yt-dlp, and CustomTkinter.

![Python](https://img.shields.io/badge/Python-3.12+-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

## ⚠️ Disclaimer

**This application is for PERSONAL and FAIR USE ONLY.**

By using this software, you agree to:
- Only download videos for which you have permission
- Respect YouTube's Terms of Service
- Use downloaded content for personal, educational, or fair use purposes only
- Not redistribute copyrighted content
- Comply with all applicable laws in your jurisdiction

The developers are not responsible for any misuse of this software.

## ✨ Features

- **Modern Dark-Theme GUI** - Clean, intuitive interface using CustomTkinter
- **Highest Quality Downloads** - Automatically selects best video (up to 4K) + best audio
- **Video Information Preview** - View title, duration, thumbnail, and estimated size before downloading
- **Progress Tracking** - Real-time progress bar, percentage, ETA, and download speed
- **Custom Output Path** - Choose where your videos are saved
- **Rate Limiting** - Built-in delays between downloads to avoid issues
- **Cross-Platform** - Works on Windows, macOS, and Linux

## 📋 Requirements

- Python 3.12 or higher
- FFmpeg (optional, for merging video+audio streams)

### Installing FFmpeg

**Windows:**
```bash
winget install FFmpeg
# Or download from https://ffmpeg.org/download.html
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg  # Debian/Ubuntu
sudo dnf install ffmpeg  # Fedora
```

## 🚀 Quick Start

### 1. Clone or Download the Repository

```bash
cd "e:\00_HeadQuaters\50_Projects\Youtube video downlaoder\yt_downloader"
```

### 2. Create Virtual Environment

**Windows:**
```powershell
python -m venv venv
.\venv\Scripts\activate
```

**macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the Application

```bash
python main.py
```

Or run as a module:
```bash
python -m app.gui
```

## 📖 Usage

1. **Launch the app** - Run `python main.py`
2. **Accept the disclaimer** - Read and accept the fair-use notice
3. **Paste a YouTube URL** - Use the Paste button or manually enter a URL
4. **Click "Fetch Info"** - Preview video details before downloading
5. **Select output folder** - Choose where to save your video
6. **Click "Download"** - Watch the progress bar as your video downloads

## 🔧 Configuration

Edit `app/config.py` to customize settings:

```python
# Video format (default: best up to 4K)
video_format = "bestvideo[height<=2160]+bestaudio/best"

# Rate limiting (seconds between downloads)
delay_between_downloads_min = 2.0
delay_between_downloads_max = 5.0

# Default download location
default_download_path = Path.home() / "Downloads" / "YouTube"
```

## 📦 Building Standalone Executable

### Using the Build Script

**Windows:**
```powershell
.\build\build.bat
```

**macOS/Linux:**
```bash
chmod +x build/build.sh
./build/build.sh
```

### Manual Build

```bash
pip install pyinstaller
python build/build.py
```

The executable will be created in the `dist/` folder.

## 📁 Project Structure

```
yt_downloader/
├── app/
│   ├── __init__.py      # Package metadata
│   ├── config.py        # Configuration settings
│   ├── downloader.py    # yt-dlp download logic
│   └── gui.py           # CustomTkinter interface
├── assets/              # App icons and resources
├── build/               # Build scripts
├── tests/               # Unit tests
├── main.py              # Entry point
├── requirements.txt     # Dependencies
└── README.md            # This file
```

## 🧪 Running Tests

```bash
python -m pytest tests/ -v
```

## 🐛 Troubleshooting

### "Video unavailable" error
- The video may be private, age-restricted, or region-locked
- Try a different video URL

### Download stuck or slow
- Check your internet connection
- YouTube may be rate-limiting requests

### "FFmpeg not found" error
- Install FFmpeg (see Requirements section above)
- Or set the path in `app/config.py`:
  ```python
  ffmpeg_path = "C:/path/to/ffmpeg.exe"
  ```

### GUI doesn't appear (Linux)
- Install Tkinter: `sudo apt install python3-tk`

## 📄 License

This project is for educational purposes. Use responsibly and respect content creators' rights.

## 🙏 Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - The powerful download engine
- [CustomTkinter](https://github.com/TomSchimansky/CustomTkinter) - Modern GUI framework
- [Pillow](https://python-pillow.org/) - Image processing
