@echo off
setlocal EnableExtensions DisableDelayedExpansion
echo Dang bien dich ung dung Java. Lan dau can JDK 17+ va Internet...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build.ps1"
set "COURTLY_EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%COURTLY_EXIT_CODE%"=="0" (
  echo Bien dich that bai. Xem thong bao phia tren va .local\logs\build.log.
) else (
  echo Bien dich thanh cong. Mo CHAY_UNG_DUNG.bat de chay ung dung.
)
if not "%COURTLY_NO_PAUSE%"=="1" pause
endlocal & exit /b %COURTLY_EXIT_CODE%
