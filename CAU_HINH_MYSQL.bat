@echo off
setlocal EnableExtensions DisableDelayedExpansion
echo Cau hinh duong dan MySQL Server cho bai tap...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\configure-mysql.ps1"
set "COURTLY_EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%COURTLY_NO_PAUSE%"=="1" pause
endlocal & exit /b %COURTLY_EXIT_CODE%
