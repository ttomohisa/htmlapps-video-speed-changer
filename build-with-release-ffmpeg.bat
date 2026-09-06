@echo off
setlocal
cd /d "%~dp0"
echo Building with the pinned FFmpeg WASM Builder GitHub Release...
call "%~dp0build-standalone.bat" %*
exit /b %errorlevel%
