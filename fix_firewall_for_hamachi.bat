@echo off
setlocal
cd /d "%~dp0"
title BOXHEAD: THE CORE - Windows Firewall & Hamachi Setup

:: Check for Administrator permissions
net session >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [안내] 관리자 권한이 필요합니다. 관리자 권한 승인 창이 뜨면 '예'를 눌러주세요.
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ===================================================================
echo   BOXHEAD: THE CORE v3.3 - 하마치 멀티플레이 방화벽 자동 설정
echo ===================================================================
echo.

echo [1/3] 3000번 포트(TCP) 윈도우 인바운드 방화벽 규칙 추가 중...
netsh advfirewall firewall delete rule name="Boxhead Game Server (Port 3000)" >nul 2>&1
netsh advfirewall firewall add rule name="Boxhead Game Server (Port 3000)" dir=in action=allow protocol=TCP localport=3000 profile=any >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo  -> [성공] 3000번 포트 방화벽 허용 완료!
) else (
    echo  -> [경고] 방화벽 규칙 추가 중 문제가 발생했습니다.
)

echo.
echo [2/3] 하마치 가상 네트워크를 '개인(Private)' 네트워크로 최적화 중...
powershell -Command "Get-NetConnectionProfile -InterfaceAlias 'Hamachi' -ErrorAction SilentlyContinue | Set-NetConnectionProfile -NetworkCategory Private -ErrorAction SilentlyContinue" >nul 2>&1
echo  -> [완료] 하마치 네트워크 어댑터 설정 완료!

echo.
echo [3/3] 호스트 하마치 IP 주소 확인 중...
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -InterfaceAlias 'Hamachi' -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress"') do set HAMACHI_IP=%%i

echo.
echo ===================================================================
if not "%HAMACHI_IP%"=="" (
    echo  ★ 설정 완료! 친구에게 아래 주소를 그대로 복사해서 보내주세요:
    echo.
    echo     http://%HAMACHI_IP%:3000
    echo.
    echo  ※ 주의: 주소창에 반드시 앞에 'http://'를 꼭 붙여서 접속해야 합니다!
) else (
    echo  ★ 방화벽 허용 완료!
    echo  하마치 프로그램 상단에 적힌 본인의 25.xxx.xxx.xxx IP 뒤에
    echo  :3000 을 붙여서 친구에게 보내주세요!
    echo  (예: http://25.xx.xx.xx:3000)
)
echo ===================================================================
echo.
pause
