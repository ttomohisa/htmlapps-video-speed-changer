@echo off
setlocal
cd /d "%~dp0"
if "%~1"=="" (
  echo Usage: build-with-local-ffmpeg.bat "C:\path\to\htmlapps-ffmpeg-wasm-builder"
  exit /b 2
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\import-local-ffmpeg.ps1" -BuilderRoot "%~1"
if errorlevel 1 exit /b %errorlevel%
call "%~dp0build-standalone.bat" -UseLocalFfmpeg
exit /b %errorlevel%
