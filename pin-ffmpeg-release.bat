@echo off
setlocal
cd /d "%~dp0"
echo Pinning the FFmpeg WASM Builder release asset...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\pin-ffmpeg-release.ps1" %*
if errorlevel 1 (
  echo.
  echo Pin failed. Make sure Builder v1.8.1 has been released on GitHub.
  pause
  exit /b 1
)
echo.
echo Pin completed. Commit ffmpeg.release.lock.json before release.
endlocal
