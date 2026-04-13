"""
User profile router.

GET  /user/profile?user_id=       — full profile + stats + settings
PUT  /user/profile                — update username
GET  /user/settings?user_id=      — get settings
PUT  /user/settings               — update settings
GET  /user/stats?user_id=         — aggregate stats (sessions, frames, estimated value)
"""
from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from python.db.database import GamificationDB, SessionsDB
from python.db.models import Frame, Level, Session, User, UserChallenge, UserSettings
from python.gamification.xp_engine import ensure_user, xp_for_level

router = APIRouter(prefix="/user", tags=["user"])

# Membership tier thresholds (based on total completed sessions)
MEMBERSHIP_TIERS = [
    (200, "Diamond", "#60a5fa"),
    (50,  "Gold",    "#f59e0b"),
    (10,  "Silver",  "#9ca3af"),
    (0,   "Bronze",  "#b45309"),
]

TIER_PRICES = {"basic": 0.10, "premium": 0.50, "elite": 2.00}
CLIP_FRAMES = 900


def _membership_tier(session_count: int) -> dict:
    for threshold, name, color in MEMBERSHIP_TIERS:
        if session_count >= threshold:
            return {"name": name, "color": color, "threshold": threshold}
    return {"name": "Bronze", "color": "#b45309", "threshold": 0}


def _get_or_create_settings(db, user_id: str) -> UserSettings:
    s = db.query(UserSettings).filter_by(user_id=user_id).first()
    if not s:
        s = UserSettings(user_id=user_id, updated_at=int(time.time() * 1000))
        db.add(s)
        db.flush()
    return s


# ─── Schemas ─────────────────────────────────────────────────────────────────

class UpdateProfileBody(BaseModel):
    user_id: str
    username: str


class UpdateSettingsBody(BaseModel):
    user_id: str
    default_game: Optional[str] = None
    enable_webcam: Optional[bool] = None
    preferred_tier: Optional[str] = None
    twitch_channel: Optional[str] = None
    twitch_username: Optional[str] = None
    obs_address: Optional[str] = None


class RegisterBody(BaseModel):
    user_id: str
    username: str


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/register")
async def register(body: RegisterBody):
    """Idempotent — creates user if not exists, updates username otherwise."""
    gdb = GamificationDB()
    try:
        user = gdb.query(User).filter_by(id=body.user_id).first()
        if not user:
            ensure_user(body.user_id, body.username)
            gdb.close()
            gdb = GamificationDB()
        else:
            user.username = body.username
            gdb.commit()
        _get_or_create_settings(gdb, body.user_id)
        gdb.commit()
    finally:
        gdb.close()
    return {"ok": True}


@router.get("/profile")
async def get_profile(user_id: str):
    gdb = GamificationDB()
    sdb = SessionsDB()
    try:
        user = gdb.query(User).filter_by(id=user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        level_row = gdb.query(Level).filter_by(user_id=user_id).first()
        settings = _get_or_create_settings(gdb, user_id)
        gdb.commit()

        challenges_done = gdb.query(UserChallenge).filter(
            UserChallenge.user_id == user_id,
            UserChallenge.completed_at.isnot(None),
        ).count()

        # Session stats from sessions DB
        sessions = sdb.query(Session).filter_by(user_id=user_id, status="complete").all()
        session_count = len(sessions)
        total_frames = sum(s.frame_count or 0 for s in sessions)
        total_duration_ms = sum(s.duration_ms or 0 for s in sessions)

        # Emotion distribution
        from collections import Counter
        emotions_raw = sdb.query(Frame.emotion_label).filter(
            Frame.session_id.in_([s.id for s in sessions]),
            Frame.emotion_label.isnot(None),
        ).all()
        emotion_counts = dict(Counter(e[0] for e in emotions_raw))
        dominant_emotion = max(emotion_counts, key=emotion_counts.get) if emotion_counts else None

        # Estimated data value (clips × preferred tier price)
        preferred_price = TIER_PRICES.get(settings.preferred_tier or "basic", 0.10)
        total_clips = total_frames // CLIP_FRAMES
        estimated_value = round(total_clips * preferred_price, 2)

        membership = _membership_tier(session_count)

        return {
            "user_id": user_id,
            "username": user.username,
            "created_at": user.created_at,
            "level": level_row.current_level if level_row else 1,
            "xp": level_row.total_xp if level_row else 0,
            "xp_to_next": xp_for_level((level_row.current_level if level_row else 1) + 1) - (level_row.total_xp if level_row else 0),
            "xp_floor": xp_for_level(level_row.current_level if level_row else 1),
            "membership": membership,
            "stats": {
                "session_count": session_count,
                "total_frames": total_frames,
                "total_duration_ms": total_duration_ms,
                "total_clips": total_clips,
                "estimated_value_usd": estimated_value,
                "challenges_completed": challenges_done,
                "dominant_emotion": dominant_emotion,
                "emotion_distribution": emotion_counts,
            },
            "settings": {
                "default_game": settings.default_game,
                "enable_webcam": settings.enable_webcam,
                "preferred_tier": settings.preferred_tier,
                "twitch_channel": settings.twitch_channel,
                "twitch_username": settings.twitch_username,
                "obs_address": settings.obs_address,
            },
        }
    finally:
        gdb.close()
        sdb.close()


@router.put("/profile")
async def update_profile(body: UpdateProfileBody):
    gdb = GamificationDB()
    try:
        user = gdb.query(User).filter_by(id=body.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.username = body.username.strip() or user.username
        gdb.commit()
    finally:
        gdb.close()
    return {"ok": True}


@router.put("/settings")
async def update_settings(body: UpdateSettingsBody):
    gdb = GamificationDB()
    try:
        s = _get_or_create_settings(gdb, body.user_id)
        if body.default_game is not None:
            s.default_game = body.default_game
        if body.enable_webcam is not None:
            s.enable_webcam = body.enable_webcam
        if body.preferred_tier is not None:
            if body.preferred_tier not in ("basic", "premium", "elite"):
                raise HTTPException(status_code=400, detail="Invalid tier")
            s.preferred_tier = body.preferred_tier
        if body.twitch_channel is not None:
            s.twitch_channel = body.twitch_channel
        if body.twitch_username is not None:
            s.twitch_username = body.twitch_username
        if body.obs_address is not None:
            s.obs_address = body.obs_address
        s.updated_at = int(time.time() * 1000)
        gdb.commit()
    finally:
        gdb.close()
    return {"ok": True}
