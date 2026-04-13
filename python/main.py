"""
Gamergamer Python FastAPI service.

HTTP  → port 8765
WebSocket → ws://localhost:8765/ws  (same port, different path)
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from python.db.database import init_databases
from python.gamification.challenge_engine import seed_challenges
from python.routers import gamification, marketplace, session, training, user
from python.ws.broadcaster import broadcaster

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Gamergamer service...")
    init_databases()
    seed_challenges()
    await broadcaster.start()
    logger.info("Gamergamer service ready.")
    yield
    logger.info("Shutting down...")
    await broadcaster.stop()


app = FastAPI(title="Gamergamer", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user.router)
app.include_router(session.router)
app.include_router(gamification.router)
app.include_router(training.router)
app.include_router(marketplace.router)


@app.get("/health")
async def health():
    import shutil
    from python.db.database import DATA_DIR
    try:
        usage = shutil.disk_usage(DATA_DIR)
        data_bytes = sum(
            f.stat().st_size
            for f in DATA_DIR.rglob("*")
            if f.is_file()
        )
        disk_info = {
            "data_gb": round(data_bytes / 1e9, 3),
            "free_gb": round(usage.free / 1e9, 1),
            "warn": data_bytes / 1e9 > 10,
        }
    except Exception:
        disk_info = {"data_gb": 0, "free_gb": 0, "warn": False}
    return {"status": "ok", "version": "0.1.0", "disk": disk_info}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await broadcaster.connect(ws)
    try:
        while True:
            # Keep connection alive; client messages are ignored in MVP
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await broadcaster.disconnect(ws)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("python.main:app", host="0.0.0.0", port=8765, reload=False)
