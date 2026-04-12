from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from python.marketplace import clip_packager, exporter

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


class ExportRequest(BaseModel):
    clip_ids: list[str]
    tier: str = "basic"
    destination: str = "local"  # "local" | "s3"
    session_clips: list[dict] = []  # [{clip_id, session_id, start_frame, end_frame}]


@router.get("/clips")
async def list_clips(user_id: str, tier: str = "basic"):
    if tier not in ("basic", "premium", "elite"):
        raise HTTPException(status_code=400, detail="tier must be basic, premium, or elite")
    return clip_packager.list_clips(user_id, tier)


@router.post("/export")
async def start_export(body: ExportRequest):
    if not body.session_clips:
        raise HTTPException(status_code=400, detail="session_clips must not be empty")
    loop = asyncio.get_running_loop()
    export_id = exporter.start_export(body.session_clips, body.destination, loop)
    return {"export_id": export_id}


@router.get("/export/{export_id}/status")
async def get_export_status(export_id: str):
    job = exporter.get_export_job(export_id)
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")
    return job
