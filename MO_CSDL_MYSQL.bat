@echo off
setlocal EnableExtensions DisableDelayedExpansion
echo Dang mo CSDL bai tap trong MySQL Workbench...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\open-database.ps1"
set "COURTLY_EXIT_CODE=%ERRORLEVEL%"
if not "%COURTLY_EXIT_CODE%"=="0" (
  echo.
  echo Khong mo duoc MySQL Workbench. Xem thong bao phia tren.
  if not "%COURTLY_NO_PAUSE%"=="1" pause
)
endlocal & exit /b %COURTLY_EXIT_CODE%
