"""
Challenge engine — definitions, seeding, and progress tracking.
"""
from __future__ import annotations

import time
import logging
from typing import Optional

from python.db.database import GamificationDB
from python.db.models import Challenge, UserChallenge
from python.ws.broadcaster import broadcaster

logger = logging.getLogger(__name__)

# Built-in challenge definitions
CHALLENGE_DEFINITIONS = [
    {
        "id": "first_blood",
        "name": "First Blood",
        "description": "Get your first kill",
        "xp_reward": 100,
        "condition_type": "kill_count",
        "condition_threshold": 1,
        "is_repeatable": False,
    },
    {
        "id": "killing_spree",
        "name": "Killing Spree",
        "description": "Get 10 kills in total",
        "xp_reward": 250,
        "condition_type": "kill_count",
        "condition_threshold": 10,
        "is_repeatable": False,
    },
    {
        "id": "marathon_5m",
        "name": "Marathon Starter",
        "description": "Play for 5 minutes",
        "xp_reward": 150,
        "condition_type": "session_duration_ms",
        "condition_threshold": 5 * 60 * 1000,
        "is_repeatable": False,
    },
    {
        "id": "marathon_30m",
        "name": "Marathon Runner",
        "description": "Play for 30 minutes",
        "xp_reward": 500,
        "condition_type": "session_duration_ms",
        "condition_threshold": 30 * 60 * 1000,
        "is_repeatable": True,
    },
    {
        "id": "hype_machine",
        "name": "Hype Machine",
        "description": "Reach hype emotion 5 times in a session",
        "xp_reward": 200,
        "condition_type": "emotion_streak",
        "condition_threshold": 5,
        "is_repeatable": True,
    },
    {
        "id": "data_donor",
        "name": "Data Donor",
        "description": "Complete 5 recorded sessions",
        "xp_reward": 300,
        "condition_type": "session_count",
        "condition_threshold": 5,
        "is_repeatable": False,
    },
]


def seed_challenges() -> None:
    """Ensure all built-in challenges exist in the DB."""
    db = GamificationDB()
    try:
        for defn in CHALLENGE_DEFINITIONS:
            existing = db.query(Challenge).filter_by(id=defn["id"]).first()
            if not existing:
                db.add(Challenge(**defn))
        db.commit()
    finally:
        db.close()


def get_user_challenges(user_id: str) -> list[dict]:
    db = GamificationDB()
    try:
        challenges = db.query(Challenge).all()
        result = []
        for ch in challenges:
            uc = (
                db.query(UserChallenge)
                .filter_by(user_id=user_id, challenge_id=ch.id)
                .first()
            )
            result.append({
                "id": ch.id,
                "name": ch.name,
                "description": ch.description,
                "xp_reward": ch.xp_reward,
                "condition_type": ch.condition_type,
                "condition_threshold": ch.condition_threshold,
                "is_repeatable": ch.is_repeatable,
                "progress": uc.progress if uc else 0.0,
                "complete": bool(uc and uc.completed_at),
                "times_completed": uc.times_completed if uc else 0,
            })
        return result
    finally:
        db.close()


def update_challenge_progress(
    user_id: str,
    condition_type: str,
    increment: float,
) -> list[dict]:
    """
    Increment progress on all matching challenges.
    Returns list of newly completed challenge dicts.
    """
    from python.gamification.xp_engine import award_xp

    db = GamificationDB()
    completed = []
    try:
        matching = db.query(Challenge).filter_by(condition_type=condition_type).all()
        for ch in matching:
            uc = db.query(UserChallenge).filter_by(user_id=user_id, challenge_id=ch.id).first()
            if not uc:
                uc = UserChallenge(
                    user_id=user_id,
                    challenge_id=ch.id,
                    progress=0.0,
                    times_completed=0,
                )
                db.add(uc)
                db.flush()

            # Don't update already-completed non-repeatable challenges
            if uc.completed_at and not ch.is_repeatable:
                continue

            # If repeatable and already completed, reset progress first
            if uc.completed_at and ch.is_repeatable:
                uc.progress = 0.0
                uc.completed_at = None

            raw_progress = (uc.progress * ch.condition_threshold + increment) / ch.condition_threshold
            uc.progress = min(1.0, raw_progress)

            if uc.progress >= 1.0 and not uc.completed_at:
                uc.completed_at = int(time.time() * 1000)
                uc.times_completed = (uc.times_completed or 0) + 1
                completed.append({
                    "challenge_id": ch.id,
                    "name": ch.name,
                    "xp_bonus": ch.xp_reward,
                })

        db.commit()
    finally:
        db.close()

    for comp in completed:
        award_xp(user_id, "challenge_complete", override_amount=comp["xp_bonus"])
        broadcaster.publish({
            "type": "challenge_complete",
            "challenge_id": comp["challenge_id"],
            "name": comp["name"],
            "xp_bonus": comp["xp_bonus"],
        })

    return completed
