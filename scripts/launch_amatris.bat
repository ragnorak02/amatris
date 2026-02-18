@echo off
REM ============================================
REM  Amatris — Studio OS Launcher
REM  Starts Node server + opens browser
REM ============================================

cd /d "Z:\Development\amatris"

REM Check if server is already running on port 3000
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo  Amatris is already running. Opening browser...
    start "" "http://localhost:3000"
    exit /b 0
)

echo.
echo  ========================================
echo   Amatris - Studio OS
echo  ========================================
echo.
echo  Starting server at http://localhost:3000
echo.

start "" "http://localhost:3000"
node server.js
