@echo off
chcp 65001 >nul
set "PROJECT_DIR=%~dp0.."
for %%I in ("%PROJECT_DIR%") do set "PROJECT_DIR=%%~fI"
set "LINK=C:\racketclub-build"

call "%~dp0build-portable.bat"
if errorlevel 1 exit /b 1

echo.
echo Para ZIP portable: comprima manualmente la carpeta:
echo   release\win-unpacked\
echo Ejecute: npm run pack:zip  desde el enlace si solo quiere la carpeta sin .exe unico.

exit /b 0
