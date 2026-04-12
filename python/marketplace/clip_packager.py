"""
Clip packager — slices a session into 30-second clips (900 frames @ 30 FPS)
and assembles tier-specific metadata.

Tier contents:
  basic   — screen JPEG sequence + emotion labels CSV
  premium — basic + full input log JSON
  elite   — premium + face landmarks JSONL + all metadata
"""
from __future__ import annotations

import csv
import json
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from python.db.database import SessionsDB
from python.db.models import FaceLandmark, Frame

CLIP_FRAMES = 900        # 30s × 30 FPS
TIER_PRICES = {"basic": 0.10, "premium": 0.50, "elite": 2.00}


@dataclass
class ClipMeta:
    clip_id: str
    session_id: str
    user_id: str
    game: Optional[str]
    start_frame: int
    end_frame: int
    frame_count: int
    duration_s: float
    tier: str
    price_usd: float
    frames: list[dict] = field(default_factory=list)


def list_clips(user_id: str, tier: str) -> list[dict]:
    """
    List all available clips for a user, grouped by session.
    Does NOT assemble file contents — just returns metadata stubs.
    """
    db = SessionsDB()
    try:
        from python.db.models import Session
        sessions = db.query(Session).filter_by(user_id=user_id, status="complete").all()
        clips = []
        for sess in sessions:
            frame_count = sess.frame_count or 0
            if frame_count < CLIP_FRAMES:
                continue
            num_clips = frame_count // CLIP_FRAMES
            for i in range(num_clips):
                clip_id = f"{sess.id[:8]}-{i:04d}"
                clips.append({
                    "clip_id": clip_id,
                    "session_id": sess.id,
                    "game": sess.game,
                    "start_frame": i * CLIP_FRAMES + 1,
                    "end_frame": (i + 1) * CLIP_FRAMES,
                    "duration_s": 30.0,
                    "tier": tier,
                    "price_usd": TIER_PRICES.get(tier, 0.10),
                })
        return clips
    finally:
        db.close()


def assemble_clip(clip_id: str, session_id: str, start_frame: int, end_frame: int, tier: str) -> ClipMeta:
    """Load frame data from DB and assemble a ClipMeta for packaging."""
    db = SessionsDB()
    try:
        from python.db.models import Session
        sess = db.query(Session).filter_by(id=session_id).first()

        frames_q = (
            db.query(Frame)
            .filter(Frame.session_id == session_id)
            .filter(Frame.frame_id >= start_frame)
            .filter(Frame.frame_id <= end_frame)
            .order_by(Frame.frame_id)
            .all()
        )

        frames_data = []
        for f in frames_q:
            entry = {
                "frame_id": f.frame_id,
                "timestamp_ms": f.timestamp_ms,
                "frame_path": f.frame_path,
                "emotion_label": f.emotion_label,
                "emotion_confidence": f.emotion_confidence,
            }
            if tier in ("premium", "elite"):
                entry["keyboard_pressed"] = json.loads(f.keyboard_pressed or "[]")
                entry["keyboard_just_pressed"] = json.loads(f.keyboard_just_pressed or "[]")
                entry["mouse_x"] = f.mouse_x
                entry["mouse_y"] = f.mouse_y
                entry["mouse_dx"] = f.mouse_dx
                entry["mouse_dy"] = f.mouse_dy
                entry["left_click"] = f.left_click
                entry["right_click"] = f.right_click
                entry["game_health"] = f.game_health
                entry["game_ammo"] = f.game_ammo
                entry["game_event"] = f.game_event
            if tier == "elite" and f.has_landmarks:
                lm = db.query(FaceLandmark).filter_by(frame_id_fk=f.id).first()
                entry["face_landmarks"] = json.loads(lm.landmarks) if lm else None
            frames_data.append(entry)

        return ClipMeta(
            clip_id=clip_id,
            session_id=session_id,
            user_id=sess.user_id if sess else "",
            game=sess.game if sess else None,
            start_frame=start_frame,
            end_frame=end_frame,
            frame_count=len(frames_data),
            duration_s=len(frames_data) / 30.0,
            tier=tier,
            price_usd=TIER_PRICES.get(tier, 0.10),
            frames=frames_data,
        )
    finally:
        db.close()
