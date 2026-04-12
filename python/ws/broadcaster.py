"""
WebSocket broadcaster.

Manages connected clients and pushes JSON messages to all of them.
Runs on port 8766 via a FastAPI WebSocket endpoint.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class BroadcastManager:
    def __init__(self):
        self._clients: list[WebSocket] = []
        self._lock = asyncio.Lock()
        self._queue: asyncio.Queue[dict] = asyncio.Queue(maxsize=512)
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        self._task = asyncio.create_task(self._dispatch_loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._clients.append(ws)
        logger.info("WebSocket client connected. Total: %d", len(self._clients))

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients = [c for c in self._clients if c is not ws]
        logger.info("WebSocket client disconnected. Total: %d", len(self._clients))

    def publish(self, message: dict[str, Any]) -> None:
        """Thread-safe publish (can be called from sync code)."""
        try:
            self._queue.put_nowait(message)
        except asyncio.QueueFull:
            pass  # drop oldest not needed; just skip this event

    async def apublish(self, message: dict[str, Any]) -> None:
        """Async publish."""
        try:
            self._queue.put_nowait(message)
        except asyncio.QueueFull:
            pass

    async def _dispatch_loop(self) -> None:
        while True:
            msg = await self._queue.get()
            payload = json.dumps(msg)
            async with self._lock:
                clients = list(self._clients)
            dead = []
            for ws in clients:
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead.append(ws)
            if dead:
                async with self._lock:
                    self._clients = [c for c in self._clients if c not in dead]


# Module-level singleton
broadcaster = BroadcastManager()
