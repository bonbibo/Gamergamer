#!/usr/bin/env bash
# Build the Python FastAPI service into a self-contained executable using PyInstaller.
# Output: python-dist/gamergamer-service/  (consumed by electron-builder extraResources)
#
# Usage:
#   bash scripts/build-python.sh
#
# Requires: pip install pyinstaller  (in the same venv as the project)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "==> Installing Python dependencies..."
pip install -r python/requirements.txt --quiet

echo "==> Running PyInstaller..."
pyinstaller \
  --onedir \
  --name gamergamer-service \
  --distpath python-dist \
  --workpath python-build \
  --specpath python-build \
  --hidden-import uvicorn.logging \
  --hidden-import uvicorn.loops \
  --hidden-import uvicorn.loops.asyncio \
  --hidden-import uvicorn.protocols \
  --hidden-import uvicorn.protocols.http \
  --hidden-import uvicorn.protocols.http.auto \
  --hidden-import uvicorn.protocols.websockets \
  --hidden-import uvicorn.protocols.websockets.auto \
  --hidden-import uvicorn.lifespan \
  --hidden-import uvicorn.lifespan.on \
  --hidden-import sqlalchemy.dialects.sqlite \
  --hidden-import pynput.keyboard._xorg \
  --hidden-import pynput.mouse._xorg \
  --hidden-import pynput.keyboard._win32 \
  --hidden-import pynput.mouse._win32 \
  --hidden-import pynput.keyboard._darwin \
  --hidden-import pynput.mouse._darwin \
  --hidden-import deepface \
  --hidden-import mediapipe \
  --collect-all deepface \
  --collect-all mediapipe \
  --collect-all timm \
  --noconfirm \
  run.py

echo ""
echo "==> Build complete: python-dist/gamergamer-service/"
echo "    Size: $(du -sh python-dist/gamergamer-service | cut -f1)"
