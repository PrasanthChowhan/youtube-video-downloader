#!/bin/bash
# Unix build script for YouTube Downloader
# Creates a standalone executable using PyInstaller

echo "========================================"
echo "YouTube Downloader - Unix Build"
echo "========================================"
echo

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "Error: Python3 not found in PATH"
    exit 1
fi

# Change to project directory
cd "$(dirname "$0")/.."

# Run the Python build script
python3 build/build.py

echo
echo "Build complete!"
