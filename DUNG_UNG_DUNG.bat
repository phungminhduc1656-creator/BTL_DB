@echo off
setlocal EnableExtensions DisableDelayedExpansion
echo Dang dung ung dung va MySQL cua du an...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\desktop.ps1" -Action stop
set "COURTLY_EXIT_CODE=%ERRORLEVEL%"
if not "%COURTLY_EXIT_CODE%"=="0" (
  echo.
  echo Chua dung duoc. Xem thong bao phia tren.
  if not "%COURTLY_NO_PAUSE%"=="1" pause
)
endlocal & exit /b %COURTLY_EXIT_CODE%
