"""
Webcam capture using OpenCV.

Runs in a dedicated thread and exposes the latest frame via `get_latest_frame()`.
"""
from __future__ import annotations

import threading
from typing import Optional

import numpy as np

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False


class WebcamCapture:
    def __init__(self, device_index: int = 0):
        self._device_index = device_index
        self._cap = None
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._lock = threading.Lock()
        self._latest_frame: Optional[np.ndarray] = None

    def start(self) -> None:
        if not CV2_AVAILABLE:
            raise RuntimeError("opencv-python is not installed. Run: pip install opencv-python-headless")
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._capture_loop, daemon=True, name="webcam-capture")
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=2.0)
            self._thread = None

    def get_latest_frame(self) -> Optional[np.ndarray]:
        with self._lock:
            return self._latest_frame.copy() if self._latest_frame is not None else None

    def _capture_loop(self) -> None:
        cap = cv2.VideoCapture(self._device_index)
        if not cap.isOpened():
            return
        try:
            while not self._stop_event.is_set():
                ret, frame = cap.read()
                if ret:
                    with self._lock:
                        self._latest_frame = frame
        finally:
            cap.release()
