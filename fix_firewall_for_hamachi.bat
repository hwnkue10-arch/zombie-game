@echo off
net session >nul 2>&1
if %ERRORLEVEL% equ 0 goto :ADMIN_TASK
powershell -Command "Start-Process '%~f0' -Verb RunAs"
exit /b

:ADMIN_TASK
title BOXHEAD THE CORE - Firewall Setup
echo ===================================================================
echo   BOXHEAD: THE CORE v3.6 - Hamachi Firewall Setup
echo ===================================================================
echo.
echo [1/2] Adding Firewall Inbound Rule for Port 3000...
netsh advfirewall firewall delete rule name="Boxhead_Port_3000" >nul 2>&1
netsh advfirewall firewall add rule name="Boxhead_Port_3000" dir=in action=allow protocol=TCP localport=3000 profile=any
echo.
echo [2/2] Configuring Hamachi Network Adapter...
powershell -NoProfile -Command "Get-NetConnectionProfile -InterfaceAlias 'Hamachi' -ErrorAction SilentlyContinue | Set-NetConnectionProfile -NetworkCategory Private -ErrorAction SilentlyContinue"
echo.
echo ===================================================================
echo   SUCCESS! Firewall rule for Port 3000 has been added.
echo   Send this address to your friend:
echo   http://25.19.219.114:3000
echo ===================================================================
echo.
pause
