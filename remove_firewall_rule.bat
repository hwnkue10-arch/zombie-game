@echo off
setlocal
cd /d "%~dp0"
title BOXHEAD: THE CORE - 방화벽 규칙 원상복구 (삭제)

:: Check for Administrator permissions
net session >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [안내] 관리자 권한이 필요합니다. 관리자 권한 승인 창이 뜨면 '예'를 눌러주세요.
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ===================================================================
echo   BOXHEAD: THE CORE - 방화벽 규칙 원상복구 (제거)
echo ===================================================================
echo.
echo [1/1] 3000번 포트 방화벽 허용 규칙 삭제 중...
netsh advfirewall firewall delete rule name="Boxhead Game Server (Port 3000)" >nul 2>&1

echo.
echo  -> [완료] 방화벽 규칙이 깨끗하게 삭제되어 원래 상태로 복원되었습니다!
echo ===================================================================
echo.
pause
