"""
Training loop for the behavioral clone model.

Runs in a background thread and publishes progress events via WebSocket.
"""
from __future__ import annotations

import asyncio
import logging
import threading
import time
import uuid
from pathlib import Path
from typing import Optional

from python.db.database import DATA_DIR
from python.ws.broadcaster import broadcaster

logger = logging.getLogger(__name__)

MODELS_DIR = DATA_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Job registry (in-memory, process lifetime)
_jobs: dict[str, dict] = {}


def get_job(job_id: str) -> Optional[dict]:
    return _jobs.get(job_id)


def start_training(
    user_id: str,
    session_ids: list[str],
    epochs: int,
    loop: asyncio.AbstractEventLoop,
) -> str:
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "job_id": job_id,
        "user_id": user_id,
        "status": "running",
        "epoch": 0,
        "total_epochs": epochs,
        "loss": None,
        "val_loss": None,
    }

    thread = threading.Thread(
        target=_train_worker,
        args=(job_id, user_id, session_ids, epochs, loop),
        daemon=True,
        name=f"trainer-{job_id[:8]}",
    )
    thread.start()
    return job_id


def _train_worker(
    job_id: str,
    user_id: str,
    session_ids: list[str],
    epochs: int,
    loop: asyncio.AbstractEventLoop,
) -> None:
    try:
        import torch
        import torch.nn as nn
        from torch.utils.data import DataLoader, random_split

        from python.training.behavioral_clone import create_model
        from python.training.dataset_builder import GameplayDataset

        dataset = GameplayDataset(session_ids)
        if len(dataset) < 2:
            _jobs[job_id]["status"] = "failed"
            _jobs[job_id]["error"] = "Not enough frames to train (need at least 2)"
            return

        val_size = max(1, int(len(dataset) * 0.1))
        train_size = len(dataset) - val_size
        train_ds, val_ds = random_split(dataset, [train_size, val_size])

        train_loader = DataLoader(train_ds, batch_size=16, shuffle=True, num_workers=0)
        val_loader = DataLoader(val_ds, batch_size=16, shuffle=False, num_workers=0)

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = create_model().to(device)

        optimizer = torch.optim.Adam(
            list(model.key_head.parameters()) + list(model.mouse_head.parameters()),
            lr=1e-3,
        )
        key_loss_fn = nn.BCEWithLogitsLoss()
        mouse_loss_fn = nn.MSELoss()

        for epoch in range(1, epochs + 1):
            model.train()
            total_loss = 0.0
            for frames, actions in train_loader:
                frames = frames.to(device)
                key_targets = actions[:, :-2].to(device)
                mouse_targets = actions[:, -2:].to(device)

                optimizer.zero_grad()
                key_logits, mouse_delta = model(frames)
                loss = key_loss_fn(key_logits, key_targets) + mouse_loss_fn(mouse_delta, mouse_targets)
                loss.backward()
                optimizer.step()
                total_loss += loss.item()

            avg_loss = total_loss / max(1, len(train_loader))

            model.eval()
            val_total = 0.0
            with torch.no_grad():
                for frames, actions in val_loader:
                    frames = frames.to(device)
                    key_targets = actions[:, :-2].to(device)
                    mouse_targets = actions[:, -2:].to(device)
                    kl, md = model(frames)
                    v_loss = key_loss_fn(kl, key_targets) + mouse_loss_fn(md, mouse_targets)
                    val_total += v_loss.item()
            avg_val = val_total / max(1, len(val_loader))

            _jobs[job_id].update({"epoch": epoch, "loss": round(avg_loss, 4), "val_loss": round(avg_val, 4)})
            loop.call_soon_threadsafe(
                broadcaster.publish,
                {
                    "type": "training_progress",
                    "job_id": job_id,
                    "epoch": epoch,
                    "total_epochs": epochs,
                    "loss": round(avg_loss, 4),
                    "val_loss": round(avg_val, 4),
                },
            )
            logger.info("Epoch %d/%d — loss: %.4f val_loss: %.4f", epoch, epochs, avg_loss, avg_val)

        checkpoint_path = MODELS_DIR / f"bc_model_{user_id[:8]}_{int(time.time())}.pt"
        torch.save(model.state_dict(), checkpoint_path)
        _jobs[job_id]["status"] = "done"
        _jobs[job_id]["checkpoint"] = str(checkpoint_path)

    except Exception as exc:
        logger.exception("Training job %s failed", job_id)
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = str(exc)
