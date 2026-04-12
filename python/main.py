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
    return {"status": "ok", "version": "0.1.0"}


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
