from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from python.capture.session_writer import session_writer
from python.db.database import SessionsDB
from python.db.models import Frame, Session
from python.gamification import xp_engine, challenge_engine

router = APIRouter(prefix="/session", tags=["session"])


class StartSessionRequest(BaseModel):
    user_id: str
    game: str = "unknown"
    enable_webcam: bool = False
    username: str = "Player"


class StopSessionRequest(BaseModel):
    session_id: str


class LogEventRequest(BaseModel):
    session_id: str
    event: str          # "kill" | "death"
    health: Optional[int] = None
    ammo: Optional[int] = None


@router.post("/start")
async def start_session(body: StartSessionRequest):
    xp_engine.ensure_user(body.user_id, body.username)
    session_id = await session_writer.start_session(
        user_id=body.user_id,
        game=body.game,
        enable_webcam=body.enable_webcam,
    )
    return {"session_id": session_id, "started_at": int(time.time() * 1000)}


@router.post("/stop")
async def stop_session(body: StopSessionRequest):
    if session_writer.current_session_id != body.session_id:
        raise HTTPException(status_code=404, detail="Session not found or not the active session")
    result = await session_writer.stop_session()

    # Award session-duration XP
    db = SessionsDB()
    try:
        sess = db.query(Session).filter_by(id=body.session_id).first()
        if sess and sess.duration_ms:
            duration_ms = sess.duration_ms
            if duration_ms >= 5 * 60 * 1000:
                xp_engine.award_xp(sess.user_id, "session_5min", session_id=body.session_id)
                challenge_engine.update_challenge_progress(sess.user_id, "session_duration_ms", duration_ms)
            if duration_ms >= 30 * 60 * 1000:
                xp_engine.award_xp(sess.user_id, "session_30min", session_id=body.session_id)
            challenge_engine.update_challenge_progress(sess.user_id, "session_count", 1)
    finally:
        db.close()

    return result


@router.get("/{session_id}/stats")
async def get_session_stats(session_id: str):
    db = SessionsDB()
    try:
        sess = db.query(Session).filter_by(id=session_id).first()
        if not sess:
            raise HTTPException(status_code=404, detail="Session not found")

        frames = db.query(Frame).filter_by(session_id=session_id).all()
        emotion_counts: dict[str, int] = {}
        for f in frames:
            if f.emotion_label:
                emotion_counts[f.emotion_label] = emotion_counts.get(f.emotion_label, 0) + 1

        return {
            "session_id": session_id,
            "game": sess.game,
            "status": sess.status,
            "frames": sess.frame_count or 0,
            "duration_ms": sess.duration_ms,
            "emotions": emotion_counts,
        }
    finally:
        db.close()


@router.post("/event")
async def log_game_event(body: LogEventRequest):
    """Manually log a game event (kill/death) from the UI."""
    if not session_writer.is_running or session_writer.current_session_id != body.session_id:
        raise HTTPException(status_code=400, detail="Session is not active")

    await session_writer.log_game_event(body.session_id, body.event, body.health, body.ammo)

    db = SessionsDB()
    try:
        sess = db.query(Session).filter_by(id=body.session_id).first()
        user_id = sess.user_id if sess else None
    finally:
        db.close()

    if user_id:
        if body.event == "kill":
            xp_engine.award_xp(user_id, "kill_event", session_id=body.session_id)
            challenge_engine.update_challenge_progress(user_id, "kill_count", 1)
        elif body.event == "death":
            xp_engine.award_xp(user_id, "death_event", session_id=body.session_id)

    return {"ok": True}
