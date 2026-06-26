@echo off

chcp 65001 >nul

setlocal



REM electron-builder / node-gyp fallan si la ruta del proyecto tiene espacios.

set "PROJECT_DIR=%~dp0.."

for %%I in ("%PROJECT_DIR%") do set "PROJECT_DIR=%%~fI"



set "LINK=C:\racketclub-build"

set "OUT=release-demo"



echo.

echo  Racket Club — Build demo portable (TANGOID SRL)

echo  Proyecto: %PROJECT_DIR%

echo.



call npm run ports:free --prefix "%PROJECT_DIR%" 2>nul

taskkill /F /IM "Racket Club - Trazabilidad de activos.exe" >nul 2>&1

taskkill /F /IM electron.exe >nul 2>&1



if exist "%LINK%" rmdir "%LINK%" 2>nul

mklink /J "%LINK%" "%PROJECT_DIR%"

if errorlevel 1 (

  echo [ERROR] Ejecute este .bat como Administrador.

  exit /b 1

)



if exist "%PROJECT_DIR%\%OUT%" (

  rmdir /s /q "%PROJECT_DIR%\%OUT%" 2>nul

)

if exist "%PROJECT_DIR%\%OUT%" (

  set "OUT=release-demo-%RANDOM%"

)



cd /d "%LINK%"

echo Compilando desde %CD% ...

call npm run build

if errorlevel 1 goto :failed



call npx electron-builder --win portable -c.directories.output=%OUT%

if errorlevel 1 goto :failed



cd /d "%PROJECT_DIR%"

rmdir "%LINK%" 2>nul



copy /Y "%PROJECT_DIR%\demo-portable\LEEME.txt" "%PROJECT_DIR%\%OUT%\LEEME.txt" >nul

echo.

echo  Listo. Carpeta: %OUT%\

echo  - RacketClub-Trazabilidad-demo-portable.exe

echo  - LEEME.txt

echo  - win-unpacked\  (version en carpeta, alternativa al .exe unico)

echo.

exit /b 0



:failed

cd /d "%PROJECT_DIR%"

rmdir "%LINK%" 2>nul

echo.

echo  Build fallido.

exit /b 1

