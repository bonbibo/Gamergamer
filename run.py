"""
PyInstaller entry point for the Gamergamer Python service.
This file sits at project root so PyInstaller can bundle it as a single
executable while preserving the `python.*` package import structure.

Usage (development):
    python run.py

Usage (production bundle):
    ./gamergamer-service  (built via scripts/build-python.sh)
"""
import uvicorn
from python.main import app  # noqa: F401 — side-effect: registers all routers

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8765, reload=False, log_level="info")
