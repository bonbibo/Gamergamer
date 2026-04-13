"""
Screen capture module using mss at ~30 FPS.

Runs in a dedicated thread (mss is not async-safe).
Each captured frame is put onto a thread-safe queue as (frame_id, timestamp_ms, PIL.Image).
"""
from __future__ import annotations

import asyncio
import threading
import time
from io import BytesIO
from typing import Optional

from PIL import Image

try:
    import mss
    import mss.tools
    MSS_AVAILABLE = True
except ImportError:
    MSS_AVAILABLE = False


def _safe_enqueue(queue: asyncio.Queue, item: object) -> None:
    """Called inside the event loop via call_soon_threadsafe; drops frame on overflow."""
    try:
        queue.put_nowait(item)
    except Exception:
        pass  # Drop frame silently — consumer too slow


class ScreenCapture:
    TARGET_FPS = 30
    JPEG_QUALITY = 75

    def __init__(self, loop: asyncio.AbstractEventLoop, queue: asyncio.Queue):
        self._loop = loop
        self._queue: asyncio.Queue = queue
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._frame_id = 0

    def start(self) -> None:
        if not MSS_AVAILABLE:
            raise RuntimeError("mss is not installed. Run: pip install mss")
        self._stop_event.clear()
        self._frame_id = 0
        self._thread = threading.Thread(target=self._capture_loop, daemon=True, name="screen-capture")
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=2.0)
            self._thread = None

    def _capture_loop(self) -> None:
        interval = 1.0 / self.TARGET_FPS
        # Each thread must own its own mss context
        with mss.mss() as sct:
            monitor = sct.monitors[1]  # primary monitor
            while not self._stop_event.is_set():
                t0 = time.perf_counter()
                timestamp_ms = int(time.time() * 1000)

                raw = sct.grab(monitor)
                img = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")

                self._frame_id += 1
                fid = self._frame_id

                # Compress to JPEG bytes in-thread to avoid blocking asyncio
                buf = BytesIO()
                img.save(buf, format="JPEG", quality=self.JPEG_QUALITY, optimize=False)
                jpeg_bytes = buf.getvalue()

                self._loop.call_soon_threadsafe(
                    _safe_enqueue, self._queue,
                    (fid, timestamp_ms, img.size, jpeg_bytes),
                )

                elapsed = time.perf_counter() - t0
                sleep_for = interval - elapsed
                if sleep_for > 0:
                    time.sleep(sleep_for)
