@echo off
setlocal
cd /d "%~dp0"
title BOXHEAD: THE CORE v3.6 - SERVER

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

start "" http://localhost:3000

node backend\server.js
pause
