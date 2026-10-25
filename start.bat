@echo off
setlocal
cd /d "%~dp0"
title BOXHEAD: THE CORE v3.3

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

start "" http://localhost:3000

echo ===================================================================
echo   BOXHEAD: THE CORE v3.3 - Game Server Launcher
echo   로컬 접속 주소: http://localhost:3000

for /f "tokens=*" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -InterfaceAlias 'Hamachi' -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress"') do set HAMACHI_IP=%%i
if not "%HAMACHI_IP%"=="" (
    echo   하마치 친구 접속 주소: http://%HAMACHI_IP%:3000
)
echo ===================================================================
echo   ※ 친구가 접속이 안 될 때는 fix_firewall_for_hamachi.bat 을
echo      마우스 우클릭 - [관리자 권한으로 실행] 해주세요!
echo ===================================================================
echo.

node backend\server.js
pause
