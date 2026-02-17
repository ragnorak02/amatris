@echo off
REM ============================================
REM  Hybrid Knights — Portfolio Dashboard Server
REM  Serves from /Games root on port 8000
REM ============================================

cd /d "%~dp0.."

echo.
echo  ========================================
echo   Hybrid Knights - Portfolio Dashboard
echo  ========================================
echo.

where python >nul 2>&1
if %errorlevel% neq 0 (
    where python3 >nul 2>&1
    if %errorlevel% neq 0 (
        echo  [ERROR] Python is not installed or not in PATH.
        echo.
        echo  To install Python:
        echo    1. Download from https://www.python.org/downloads/
        echo    2. During install, check "Add Python to PATH"
        echo    3. Restart this script
        echo.
        pause
        exit /b 1
    )
    set PYTHON=python3
) else (
    set PYTHON=python
)

echo  Starting server at http://localhost:8000
echo  Portal:    http://localhost:8000/hybrid_knights_portal.html
echo  Overview:  http://localhost:8000/games_overview.html
echo  Heatmap:   http://localhost:8000/games_heatmap.html
echo.
echo  Press Ctrl+C to stop the server.
echo.

start "" http://localhost:8000/hybrid_knights_portal.html
%PYTHON% -m http.server 8000
