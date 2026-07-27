@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "CP=lib\ReaderAPI20250926.jar;lib\jna-5.4.0.jar;lib\jna-platform-5.4.0.jar"
set "OUT=dist\classes"
if not exist "%OUT%" mkdir "%OUT%"
if not exist "dist" mkdir "dist"

echo Compilando R3Bridge...
javac -encoding UTF-8 -cp "%CP%" -d "%OUT%" src\com\tangoid\r3bridge\R3Bridge.java
if errorlevel 1 exit /b 1

echo Manifest-Version: 1.0> dist\manifest.mf
echo Main-Class: com.tangoid.r3bridge.R3Bridge>> dist\manifest.mf
echo Class-Path: lib/ReaderAPI20250926.jar lib/jna-5.4.0.jar lib/jna-platform-5.4.0.jar>> dist\manifest.mf

jar cfm dist\r3-bridge-v2.jar dist\manifest.mf -C dist\classes .
jar cfm dist\r3-bridge.jar dist\manifest.mf -C dist\classes . 2>nul
if errorlevel 1 (
  echo AVISO: dist\r3-bridge.jar en uso — se usa dist\classes / r3-bridge-v2.jar
) else (
  echo OK: dist\r3-bridge.jar
)

echo OK: dist\classes listo
exit /b 0
