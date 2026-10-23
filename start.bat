@echo off
chcp 65001 > nul
title BOXHEAD: THE CORE v3.1 - Game Server Launcher
cls

echo ===================================================================
echo   🎮 BOXHEAD: THE CORE v3.1 — Tactical Co-op Survival
echo ===================================================================
echo.

:: 1. Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [오류] 시스템에 Node.js 가 설치되어 있지 않습니다!
  echo        게임 구동을 위해 Node.js (v16 이상) 설치가 필요합니다.
  echo.
  echo • 다운로드 공식 웹사이트: https://nodejs.org
  echo.
  pause
  exit /b 1
)

:: 2. Launch browser automatically after 1.5 seconds in background
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: 3. Inform user and start server
echo [안내] 잠시 후 기본 브라우저에서 게임 화면(http://localhost:3000)이 열립니다.
echo [안내] 친구와 멀티플레이를 하려면 화면에 표시되는 하마치 또는 LAN IP를 공유하세요.
echo [안내] 서버를 종료하려면 이 창에서 Ctrl + C 를 누르세요.
echo.
echo ===================================================================
echo [시작] 게임 서버 기동 중...
echo ===================================================================
echo.

node backend/server.js

echo.
echo [안내] 서버가 종료되었습니다.
pause
