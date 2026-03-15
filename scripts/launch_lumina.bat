@echo off
REM ============================================
REM  Lumina — Studio OS Launcher
REM  Starts Node server + opens browser once ready
REM ============================================

cd /d "Z:\Development\lumina"

REM Check if server is already running on port 3001
netstat -ano | findstr ":3001 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo  Lumina is already running. Opening browser...
    start "" "http://localhost:3001"
    exit /b 0
)

echo.
echo  ========================================
echo   Lumina - Studio OS
echo  ========================================
echo.
echo  Starting server...

REM Start server in a minimized window so it stays alive
start /min "Lumina Server" cmd /c "cd /d Z:\Development\lumina && node server.js"

REM Wait for server to be ready (poll up to 10 seconds)
set /a TRIES=0
:waitloop
if %TRIES% geq 20 (
    echo  [ERROR] Server did not start within 10 seconds.
    pause
    exit /b 1
)
timeout /t 1 /nobreak >nul 2>&1
netstat -ano | findstr ":3001 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 goto :ready
set /a TRIES+=1
goto :waitloop

:ready
echo  Server is ready at http://localhost:3001
start "" "http://localhost:3001"
echo  Opening browser...
