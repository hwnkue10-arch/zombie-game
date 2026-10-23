@echo off
setlocal
cd /d "%~dp0"
title BOXHEAD: THE CORE v3.1

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

start "" http://localhost:3000

echo ===================================================================
echo   BOXHEAD: THE CORE v3.1 - Game Server Launcher
echo   Browser opening at http://localhost:3000 ...
echo   Press Ctrl + C to stop the server
echo ===================================================================

node backend\server.js
pause
