"""
Session writer — the core orchestrator of the data pipeline.

Fixes vs. v1:
- Persistent DB session (one connection for entire session, not per-frame)
- Batch commit every COMMIT_EVERY frames instead of per-frame
- Frame queue drained properly before task exits (no frame loss on stop)
- stop_session() returns correct duration_ms
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from pathlib import Path
from typing import Optional

from python.capture.input_logger import InputLogger
from python.capture.screen_capture import ScreenCapture
from python.capture.webcam_capture import WebcamCapture
from python.db.database import DATA_DIR, SessionsDB
from python.db.models import FaceLandmark, Frame, Session
from python.inference.emotion_detector import EmotionDetector
from python.ws.broadcaster import broadcaster

logger = logging.getLogger(__name__)

FRAMES_DIR = DATA_DIR / "frames"
COMMIT_EVERY = 30  # commit to SQLite once per second (30 frames)
DISK_WARN_GB = 10  # warn user when data dir exceeds this


class SessionWriter:
    def __init__(self):
        self._frame_queue: asyncio.Queue = asyncio.Queue(maxsize=512)
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
            db.add(Session(
                id=self._session_id,
                user_id=user_id,
                game=game,
                started_at=int(time.time() * 1000),
                enable_webcam=enable_webcam,
                status="recording",
            ))
            db.commit()
        finally:
            db.close()

        # Fresh queue — discard any leftover frames from a previous session
        self._frame_queue = asyncio.Queue(maxsize=512)
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

        logger.info("Session started: %s (game=%s webcam=%s)", self._session_id, game, enable_webcam)
        return self._session_id

    async def stop_session(self) -> dict:
        if not self._running:
            raise RuntimeError("No session is running")

        # 1. Signal capture to stop producing frames
        self._running = False
        self._screen_capture.stop()
        self._input_logger.stop()
        if self._webcam_capture:
            self._webcam_capture.stop()
        if self._emotion_detector:
            self._emotion_detector.close()

        # 2. Wait for the write loop to drain the queue naturally (not cancelled)
        if self._writer_task:
            try:
                await asyncio.wait_for(self._writer_task, timeout=10.0)
            except asyncio.TimeoutError:
                logger.warning("Write loop drain timed out, cancelling")
                self._writer_task.cancel()
                try:
                    await self._writer_task
                except asyncio.CancelledError:
                    pass

        # 3. Finalise session record
        ended_at = int(time.time() * 1000)
        frames_captured = 0
        duration_ms = 0

        db = SessionsDB()
        try:
            session = db.query(Session).filter_by(id=self._session_id).first()
            if session:
                session.ended_at = ended_at
                session.duration_ms = ended_at - session.started_at
                session.status = "complete"
                frames_captured = session.frame_count or 0
                duration_ms = session.duration_ms
                db.commit()
        finally:
            db.close()

        result = {
            "session_id": self._session_id,
            "frames_captured": frames_captured,
            "duration_ms": duration_ms,
        }

        self._session_id = None
        self._user_id = None
        self._writer_task = None
        self._webcam_capture = None

        logger.info("Session stopped. frames=%d duration=%.1fs", frames_captured, duration_ms / 1000)
        return result

    async def log_game_event(
        self,
        session_id: str,
        event: str,
        health: Optional[int] = None,
        ammo: Optional[int] = None,
    ) -> None:
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
        session_id = self._session_id       # capture locals — stop_session resets attrs
        user_id = self._user_id
        session_dir = FRAMES_DIR / user_id / session_id

        # Single persistent DB session for the entire recording
        db = SessionsDB()
        frames_since_commit = 0

        try:
            while self._running or not self._frame_queue.empty():
                try:
                    frame_id, timestamp_ms, size, jpeg_bytes = await asyncio.wait_for(
                        self._frame_queue.get(), timeout=0.05
                    )
                except asyncio.TimeoutError:
                    # Flush pending writes periodically even if queue is empty
                    if frames_since_commit > 0:
                        db.commit()
                        frames_since_commit = 0
                    continue

                # Write JPEG to disk (offloaded to thread pool)
                frame_path = session_dir / f"{frame_id:08d}.jpg"
                await asyncio.to_thread(frame_path.write_bytes, jpeg_bytes)

                input_snap = self._input_logger.snapshot() if self._input_logger else None
                webcam_frame = self._webcam_capture.get_latest_frame() if self._webcam_capture else None
                emotion = self._emotion_detector.infer(webcam_frame) if self._emotion_detector else None

                frame_record = Frame(
                    frame_id=frame_id,
                    session_id=session_id,
                    timestamp_ms=timestamp_ms,
                    frame_path=str(frame_path),
                    keyboard_pressed=json.dumps(input_snap.pressed if input_snap else []),
                    keyboard_just_pressed=json.dumps(input_snap.just_pressed if input_snap else []),
                    keyboard_just_released=json.dumps(input_snap.just_released if input_snap else []),
                    mouse_x=input_snap.mouse_x if input_snap else None,
                    mouse_y=input_snap.mouse_y if input_snap else None,
                    mouse_dx=input_snap.mouse_dx if input_snap else None,
                    mouse_dy=input_snap.mouse_dy if input_snap else None,
                    left_click=input_snap.left_click if input_snap else False,
                    right_click=input_snap.right_click if input_snap else False,
                    emotion_label=emotion.label if emotion else None,
                    emotion_confidence=emotion.confidence if emotion else None,
                    has_landmarks=bool(emotion and emotion.face_landmarks),
                )
                db.add(frame_record)

                # Update frame_count on the session row
                session_row = db.query(Session).filter_by(id=session_id).first()
                if session_row:
                    session_row.frame_count = frame_id

                frames_since_commit += 1
                if frames_since_commit >= COMMIT_EVERY:
                    db.commit()
                    # Insert landmarks in same batch
                    if emotion and emotion.face_landmarks and frame_record.id:
                        db.add(FaceLandmark(
                            frame_id_fk=frame_record.id,
                            landmarks=json.dumps(emotion.face_landmarks),
                        ))
                        db.commit()
                    frames_since_commit = 0

                # Push lightweight WebSocket event (no JPEG bytes)
                await broadcaster.apublish({
                    "type": "frame",
                    "frame_id": frame_id,
                    "timestamp_ms": timestamp_ms,
                    "keyboard_state": {
                        "pressed": input_snap.pressed if input_snap else [],
                        "just_pressed": input_snap.just_pressed if input_snap else [],
                        "just_released": input_snap.just_released if input_snap else [],
                    },
                    "mouse_state": {
                        "x": input_snap.mouse_x if input_snap else 0,
                        "y": input_snap.mouse_y if input_snap else 0,
                        "dx": input_snap.mouse_dx if input_snap else 0,
                        "dy": input_snap.mouse_dy if input_snap else 0,
                        "left_click": input_snap.left_click if input_snap else False,
                    },
                    "emotion": {
                        "label": emotion.label,
                        "confidence": emotion.confidence,
                    } if emotion else None,
                })

        except Exception:
            logger.exception("Write loop crashed for session %s", session_id)
        finally:
            # Final commit for any unflushed rows
            try:
                if frames_since_commit > 0:
                    db.commit()
            except Exception:
                pass
            db.close()
            logger.info("Write loop exited for session %s", session_id)


# Module-level singleton
session_writer = SessionWriter()
