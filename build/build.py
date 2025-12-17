# file: yt_downloader/build/build.py
"""
PyInstaller build script for YouTube Downloader.

Creates a single-file executable with all dependencies bundled.
Handles CustomTkinter data files and application icon.
"""

import subprocess
import sys
import shutil
from pathlib import Path


def get_customtkinter_path() -> str:
    """Get the CustomTkinter installation path for data files."""
    try:
        import customtkinter
        return str(Path(customtkinter.__file__).parent)
    except ImportError:
        print("Error: CustomTkinter not installed. Run: pip install customtkinter")
        sys.exit(1)


def build_executable():
    """Build the standalone executable using PyInstaller."""
    
    # Get paths
    project_root = Path(__file__).parent.parent
    main_script = project_root / "main.py"
    icon_path = project_root / "assets" / "icon.ico"
    ctk_path = get_customtkinter_path()
    
    # Verify main script exists
    if not main_script.exists():
        print(f"Error: Main script not found: {main_script}")
        sys.exit(1)
    
    # Build command
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--noconsole",
        "--name", "yt-downloader",
        f"--add-data={ctk_path};customtkinter",
    ]
    
    # Add icon if exists
    if icon_path.exists():
        cmd.append(f"--icon={icon_path}")
    
    # Add main script
    cmd.append(str(main_script))
    
    print("Building executable...")
    print(f"Command: {' '.join(cmd)}")
    print()
    
    # Run PyInstaller
    result = subprocess.run(cmd, cwd=project_root)
    
    if result.returncode == 0:
        print()
        print("=" * 50)
        print("Build successful!")
        print(f"Executable: {project_root / 'dist' / 'yt-downloader.exe'}")
        print("=" * 50)
    else:
        print()
        print("Build failed!")
        sys.exit(1)


def clean_build():
    """Clean build artifacts."""
    project_root = Path(__file__).parent.parent
    
    dirs_to_clean = ["dist"]
    files_to_clean = ["*.spec"]
    
    for dir_name in dirs_to_clean:
        dir_path = project_root / dir_name
        if dir_path.exists():
            print(f"Removing {dir_path}")
            shutil.rmtree(dir_path)
    
    for pattern in files_to_clean:
        for file_path in project_root.glob(pattern):
            print(f"Removing {file_path}")
            file_path.unlink()
    
    print("Clean complete!")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "clean":
        clean_build()
    else:
        build_executable()
