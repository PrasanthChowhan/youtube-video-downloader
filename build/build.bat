@echo off
REM Windows build script for YouTube Downloader
REM Creates a standalone executable using PyInstaller

echo ========================================
echo YouTube Downloader - Windows Build
echo ========================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python not found in PATH
    exit /b 1
)

REM Change to project directory
cd /d "%~dp0.."

REM Run the Python build script
python build\build.py

echo.
pause
