@echo off
setlocal EnableExtensions DisableDelayedExpansion
echo Dang mo phia KHACH HANG, vui long cho...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\desktop.ps1" -Action start -Page customer
set "COURTLY_EXIT_CODE=%ERRORLEVEL%"
if not "%COURTLY_EXIT_CODE%"=="0" (
  echo.
  echo Khong khoi dong duoc. Xem thong bao phia tren va thu muc .local\logs.
  if not "%COURTLY_NO_PAUSE%"=="1" pause
)
endlocal & exit /b %COURTLY_EXIT_CODE%
