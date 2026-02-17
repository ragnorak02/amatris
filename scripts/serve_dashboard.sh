#!/usr/bin/env bash
# ============================================
#  Hybrid Knights — Portfolio Dashboard Server
#  Serves from /Games root on port 8000
# ============================================

cd "$(dirname "$0")/.." || exit 1

echo ""
echo "  ========================================"
echo "   Hybrid Knights - Portfolio Dashboard"
echo "  ========================================"
echo ""

PYTHON=""
if command -v python3 &> /dev/null; then
    PYTHON="python3"
elif command -v python &> /dev/null; then
    PYTHON="python"
else
    echo "  [ERROR] Python is not installed or not in PATH."
    echo ""
    echo "  To install Python:"
    echo "    Ubuntu/Debian: sudo apt install python3"
    echo "    macOS:         brew install python3"
    echo "    Arch:          sudo pacman -S python"
    echo ""
    exit 1
fi

echo "  Starting server at http://localhost:8000"
echo "  Portal:    http://localhost:8000/hybrid_knights_portal.html"
echo "  Overview:  http://localhost:8000/games_overview.html"
echo "  Heatmap:   http://localhost:8000/games_heatmap.html"
echo ""
echo "  Press Ctrl+C to stop the server."
echo ""

# Try to open browser
if command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:8000/hybrid_knights_portal.html" &
elif command -v open &> /dev/null; then
    open "http://localhost:8000/hybrid_knights_portal.html" &
fi

$PYTHON -m http.server 8000
