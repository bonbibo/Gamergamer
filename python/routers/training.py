from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from python.training import trainer

router = APIRouter(prefix="/training", tags=["training"])


class StartTrainingRequest(BaseModel):
    user_id: str
    session_ids: list[str]
    epochs: int = 10


@router.post("/start")
async def start_training(body: StartTrainingRequest):
    loop = asyncio.get_running_loop()
    job_id = trainer.start_training(
        user_id=body.user_id,
        session_ids=body.session_ids,
        epochs=body.epochs,
        loop=loop,
    )
    return {"job_id": job_id}


@router.get("/status/{job_id}")
async def get_training_status(job_id: str):
    job = trainer.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")
    return job
