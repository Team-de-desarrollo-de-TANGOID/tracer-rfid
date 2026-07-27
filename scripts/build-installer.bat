@echo off
chcp 65001 >nul
setlocal

REM electron-builder falla si la ruta del proyecto tiene espacios.
set "PROJECT_DIR=%~dp0.."
for %%I in ("%PROJECT_DIR%") do set "PROJECT_DIR=%%~fI"

set "LINK=C:\racketclub-build"
set "OUT=C:\racketclub-release"

echo.
echo  RFID TRACER — Build instalador NSIS (TANGOID SRL)
echo  Proyecto: %PROJECT_DIR%
echo.

call npm run ports:free --prefix "%PROJECT_DIR%" 2>nul
taskkill /F /IM "RFID TRACER.exe" >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1

if exist "%LINK%" rmdir "%LINK%" 2>nul
mklink /J "%LINK%" "%PROJECT_DIR%"
if errorlevel 1 (
  echo [ERROR] Ejecute este .bat como Administrador.
  exit /b 1
)

cd /d "%LINK%"
echo Compilando desde %CD% ...

if not exist "hardware\r3-bridge\dist\r3-bridge.jar" (
  call hardware\r3-bridge\build.bat
  if errorlevel 1 goto :failed
)

call npm install
if errorlevel 1 goto :failed

call npx @electron/rebuild -f -w better-sqlite3
if errorlevel 1 goto :failed

call npm run build
if errorlevel 1 goto :failed

if exist "%OUT%" rmdir /S /Q "%OUT%" 2>nul
call npx electron-builder --win nsis -c.directories.output=%OUT%
if errorlevel 1 goto :failed

if not exist "%PROJECT_DIR%\release" mkdir "%PROJECT_DIR%\release"
copy /Y "%OUT%\RFID-TRACER-Setup-*.exe" "%PROJECT_DIR%\release\" >nul

cd /d "%PROJECT_DIR%"
rmdir "%LINK%" 2>nul

echo.
echo  Listo. Carpeta: release\
echo  - RFID-TRACER-Setup-0.2.0.exe
echo.
exit /b 0

:failed
cd /d "%PROJECT_DIR%"
rmdir "%LINK%" 2>nul
echo.
echo  Build fallido.
exit /b 1
