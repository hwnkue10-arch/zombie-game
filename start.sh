#!/usr/bin/env bash
# ===================================================================
# BOXHEAD: THE CORE v3.1 — Server Launcher for Linux / macOS
# ===================================================================

echo "==================================================================="
echo "  🎮 BOXHEAD: THE CORE v3.1 — Server Launcher"
echo "==================================================================="

if ! command -v node &> /dev/null; then
    echo "[오류] 시스템에 Node.js 가 설치되어 있지 않습니다!"
    echo "       https://nodejs.org 에서 Node.js 를 설치해주세요."
    exit 1
fi

echo "[안내] 서버를 시작합니다. 접속 주소: http://localhost:3000"
echo "[안내] 종료하려면 Ctrl + C 를 누르세요."
echo "==================================================================="

# Attempt to open browser across platforms (Linux / macOS)
if command -v xdg-open &> /dev/null; then
    (sleep 1.5 && xdg-open http://localhost:3000) &
elif command -v open &> /dev/null; then
    (sleep 1.5 && open http://localhost:3000) &
fi

node backend/server.js
