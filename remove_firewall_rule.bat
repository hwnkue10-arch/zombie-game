@echo off
net session >nul 2>&1
if %ERRORLEVEL% equ 0 goto :ADMIN_TASK
powershell -Command "Start-Process '%~f0' -Verb RunAs"
exit /b

:ADMIN_TASK
title BOXHEAD THE CORE - Remove Firewall Rule
echo ===================================================================
echo   BOXHEAD: THE CORE - Remove Firewall Rule (Port 3000)
echo ===================================================================
echo.
echo Removing Firewall Rule for Port 3000...
netsh advfirewall firewall delete rule name="Boxhead_Port_3000" >nul 2>&1
echo.
echo ===================================================================
echo   [SUCCESS] Firewall rule removed! Restored to original state.
echo ===================================================================
echo.
pause
