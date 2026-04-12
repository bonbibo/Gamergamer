"""
XP engine — awards, level computation, and ledger management.

Level threshold formula: xp_for_level(n) = 100 * n^1.8
"""
from __future__ import annotations

import math
import time
import logging
from typing import Optional

from python.db.database import GamificationDB
from python.db.models import Level, User, XPLedger
from python.ws.broadcaster import broadcaster

logger = logging.getLogger(__name__)

# XP award table
XP_RULES: dict[str, int] = {
    "kill_event": 50,
    "death_event": -10,
    "session_5min": 100,
    "session_30min": 500,
    "emotion_hype": 5,
    "first_session": 200,
    "challenge_complete": 0,  # multiplier applied in challenge_engine
}

EMOTION_HYPE_CAP_PER_SESSION = 50


def xp_for_level(level: int) -> int:
    """Total XP required to reach this level."""
    return int(100 * (level ** 1.8))


def level_from_xp(total_xp: int) -> int:
    """Binary search: find the highest level whose threshold <= total_xp."""
    lo, hi = 1, 1000
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if xp_for_level(mid) <= total_xp:
            lo = mid
        else:
            hi = mid - 1
    return lo


def xp_to_next_level(total_xp: int) -> int:
    current = level_from_xp(total_xp)
    return xp_for_level(current + 1) - total_xp


def award_xp(
    user_id: str,
    reason: str,
    session_id: Optional[str] = None,
    override_amount: Optional[int] = None,
) -> dict:
    """
    Award XP to a user.
    Returns a dict with new totals and any level-up info.
    Broadcasts xp_awarded (and level_up if applicable) to WebSocket.
    """
    amount = override_amount if override_amount is not None else XP_RULES.get(reason, 0)
    if amount == 0:
        return {}

    db = GamificationDB()
    try:
        level_row = db.query(Level).filter_by(user_id=user_id).first()
        if not level_row:
            level_row = Level(user_id=user_id, current_level=1, total_xp=0)
            db.add(level_row)
            db.flush()

        old_total = level_row.total_xp
        old_level = level_row.current_level
        new_total = max(0, old_total + amount)
        new_level = level_from_xp(new_total)

        level_row.total_xp = new_total
        level_row.current_level = new_level
        level_row.last_updated = int(time.time() * 1000)

        ledger = XPLedger(
            user_id=user_id,
            session_id=session_id,
            timestamp_ms=int(time.time() * 1000),
            reason=reason,
            amount=amount,
            running_total=new_total,
        )
        db.add(ledger)
        db.commit()
    finally:
        db.close()

    broadcaster.publish({
        "type": "xp_awarded",
        "reason": reason,
        "amount": amount,
        "new_total": new_total,
        "level": new_level,
    })

    if new_level > old_level:
        broadcaster.publish({
            "type": "level_up",
            "old_level": old_level,
            "new_level": new_level,
            "xp_total": new_total,
        })

    return {
        "reason": reason,
        "amount": amount,
        "new_total": new_total,
        "level": new_level,
        "leveled_up": new_level > old_level,
    }


def ensure_user(user_id: str, username: str = "Player") -> None:
    """Create user + level row if they don't exist."""
    db = GamificationDB()
    try:
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            user = User(id=user_id, username=username, created_at=int(time.time() * 1000))
            db.add(user)
            level = Level(user_id=user_id, current_level=1, total_xp=0, last_updated=int(time.time() * 1000))
            db.add(level)
            db.commit()
            award_xp(user_id, "first_session")
    finally:
        db.close()


def get_profile(user_id: str) -> dict:
    db = GamificationDB()
    try:
        level_row = db.query(Level).filter_by(user_id=user_id).first()
        if not level_row:
            return {"level": 1, "xp": 0, "xp_to_next": xp_for_level(2)}
        return {
            "level": level_row.current_level,
            "xp": level_row.total_xp,
            "xp_to_next": xp_to_next_level(level_row.total_xp),
        }
    finally:
        db.close()
