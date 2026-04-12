"""
Session writer — the core orchestrator of the data pipeline.

Consumes frames from the screen capture queue, pairs them with input snapshots
and emotion results, writes JPEG files to disk, inserts rows into SQLite, and
pushes lightweight events to the WebSocket broadcaster.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from pathlib import Path
from typing import Optional

from python.capture.input_logger import InputLogger
from python.capture.screen_capture import ScreenCapture
from python.capture.webcam_capture import WebcamCapture
from python.db.database import DATA_DIR, SessionsDB
from python.db.models import Frame, Session
from python.inference.emotion_detector import EmotionDetector
from python.ws.broadcaster import broadcaster

logger = logging.getLogger(__name__)

FRAMES_DIR = DATA_DIR / "frames"


class SessionWriter:
    def __init__(self):
        self._frame_queue: asyncio.Queue = asyncio.Queue(maxsize=256)
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._screen_capture: Optional[ScreenCapture] = None
        self._webcam_capture: Optional[WebcamCapture] = None
        self._input_logger: Optional[InputLogger] = None
        self._emotion_detector: Optional[EmotionDetector] = None
        self._session_id: Optional[str] = None
        self._user_id: Optional[str] = None
        self._game: Optional[str] = None
        self._enable_webcam: bool = False
        self._writer_task: Optional[asyncio.Task] = None
        self._running: bool = False

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def current_session_id(self) -> Optional[str]:
        return self._session_id

    async def start_session(
        self,
        user_id: str,
        game: str,
        enable_webcam: bool = False,
    ) -> str:
        if self._running:
            raise RuntimeError("A session is already running")

        self._loop = asyncio.get_running_loop()
        self._session_id = str(uuid.uuid4())
        self._user_id = user_id
        self._game = game
        self._enable_webcam = enable_webcam

        session_dir = FRAMES_DIR / user_id / self._session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        db = SessionsDB()
        try:
            session = Session(
                id=self._session_id,
                user_id=user_id,
                game=game,
                started_at=int(time.time() * 1000),
                enable_webcam=enable_webcam,
                status="recording",
            )
            db.add(session)
            db.commit()
        finally:
            db.close()

        self._frame_queue = asyncio.Queue(maxsize=256)
        self._input_logger = InputLogger()
        self._screen_capture = ScreenCapture(loop=self._loop, queue=self._frame_queue)
        self._emotion_detector = EmotionDetector(run_every_n_frames=10)

        if enable_webcam:
            self._webcam_capture = WebcamCapture()
            self._webcam_capture.start()

        self._input_logger.start()
        self._screen_capture.start()
        self._running = True
        self._writer_task = asyncio.create_task(self._write_loop())

        logger.info("Session started: %s", self._session_id)
        return self._session_id

    async def stop_session(self) -> dict:
        if not self._running:
            raise RuntimeError("No session is running")

        self._running = False
        self._screen_capture.stop()
        self._input_logger.stop()
        if self._webcam_capture:
            self._webcam_capture.stop()
        if self._emotion_detector:
            self._emotion_detector.close()

        if self._writer_task:
            self._writer_task.cancel()
            try:
                await self._writer_task
            except asyncio.CancelledError:
                pass

        # Drain remaining frames
        frames_captured = 0
        db = SessionsDB()
        try:
            session = db.query(Session).filter_by(id=self._session_id).first()
            if session:
                session.ended_at = int(time.time() * 1000)
                session.duration_ms = session.ended_at - session.started_at
                session.status = "complete"
                frames_captured = session.frame_count
                db.commit()
        finally:
            db.close()

        result = {
            "session_id": self._session_id,
            "frames_captured": frames_captured,
            "duration_ms": 0,
        }

        self._session_id = None
        self._user_id = None
        self._writer_task = None
        self._webcam_capture = None

        logger.info("Session stopped. Frames: %d", frames_captured)
        return result

    async def log_game_event(self, session_id: str, event: str, health: Optional[int] = None, ammo: Optional[int] = None) -> None:
        """Called from the gamification router to manually tag game events."""
        db = SessionsDB()
        try:
            latest = (
                db.query(Frame)
                .filter_by(session_id=session_id)
                .order_by(Frame.frame_id.desc())
                .first()
            )
            if latest:
                latest.game_event = event
                if health is not None:
                    latest.game_health = health
                if ammo is not None:
                    latest.game_ammo = ammo
                db.commit()
        finally:
            db.close()

    async def _write_loop(self) -> None:
        session_dir = FRAMES_DIR / self._user_id / self._session_id

        while self._running or not self._frame_queue.empty():
            try:
                frame_id, timestamp_ms, size, jpeg_bytes = await asyncio.wait_for(
                    self._frame_queue.get(), timeout=0.1
                )
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break

            frame_path = session_dir / f"{frame_id:08d}.jpg"
            await asyncio.to_thread(frame_path.write_bytes, jpeg_bytes)

            input_snap = self._input_logger.snapshot()
            webcam_frame = self._webcam_capture.get_latest_frame() if self._webcam_capture else None
            emotion = self._emotion_detector.infer(webcam_frame) if self._emotion_detector else None

            db = SessionsDB()
            try:
                frame_record = Frame(
                    frame_id=frame_id,
                    session_id=self._session_id,
                    timestamp_ms=timestamp_ms,
                    frame_path=str(frame_path),
                    keyboard_pressed=json.dumps(input_snap.pressed),
                    keyboard_just_pressed=json.dumps(input_snap.just_pressed),
                    keyboard_just_released=json.dumps(input_snap.just_released),
                    mouse_x=input_snap.mouse_x,
                    mouse_y=input_snap.mouse_y,
                    mouse_dx=input_snap.mouse_dx,
                    mouse_dy=input_snap.mouse_dy,
                    left_click=input_snap.left_click,
                    right_click=input_snap.right_click,
                    emotion_label=emotion.label if emotion else None,
                    emotion_confidence=emotion.confidence if emotion else None,
                    has_landmarks=bool(emotion and emotion.face_landmarks),
                )
                db.add(frame_record)

                session = db.query(Session).filter_by(id=self._session_id).first()
                if session:
                    session.frame_count = frame_id

                db.commit()

                if emotion and emotion.face_landmarks:
                    from python.db.models import FaceLandmark
                    lm = FaceLandmark(
                        frame_id_fk=frame_record.id,
                        landmarks=json.dumps(emotion.face_landmarks),
                    )
                    db.add(lm)
                    db.commit()
            finally:
                db.close()

            # Push lightweight event to WebSocket
            ws_event = {
                "type": "frame",
                "frame_id": frame_id,
                "timestamp_ms": timestamp_ms,
                "keyboard_state": {
                    "pressed": input_snap.pressed,
                    "just_pressed": input_snap.just_pressed,
                    "just_released": input_snap.just_released,
                },
                "mouse_state": {
                    "x": input_snap.mouse_x,
                    "y": input_snap.mouse_y,
                    "dx": input_snap.mouse_dx,
                    "dy": input_snap.mouse_dy,
                    "left_click": input_snap.left_click,
                },
                "emotion": {
                    "label": emotion.label if emotion else None,
                    "confidence": emotion.confidence if emotion else None,
                } if emotion else None,
            }
            await broadcaster.apublish(ws_event)


# Module-level singleton
session_writer = SessionWriter()
