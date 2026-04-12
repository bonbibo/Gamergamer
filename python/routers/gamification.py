from __future__ import annotations

from fastapi import APIRouter, HTTPException

from python.gamification import challenge_engine, xp_engine

router = APIRouter(prefix="/gamification", tags=["gamification"])


@router.get("/profile")
async def get_profile(user_id: str):
    profile = xp_engine.get_profile(user_id)
    return profile


@router.get("/challenges")
async def get_challenges(user_id: str):
    return challenge_engine.get_user_challenges(user_id)
