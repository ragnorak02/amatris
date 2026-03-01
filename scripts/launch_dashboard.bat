@echo off
REM ============================================
REM  Amatris — Dashboard Monitor
REM  Opens the portfolio dashboard via Node server
REM ============================================

cd /d "Z:\Development\amatris"

REM Check if server is already running on port 3000
netstat -ano | findstr ":3001 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo  Server already running. Opening dashboard...
    start "" "http://localhost:3001/amatris%%20dashboard.html"
    exit /b 0
)

echo.
echo  ========================================
echo   Amatris - Portfolio Dashboard
echo  ========================================
echo.
echo  Starting server at http://localhost:3001
echo.

start "" "http://localhost:3001/amatris%%20dashboard.html"
node server.js
