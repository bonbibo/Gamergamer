"""
Exporter — packages clips into .tar.gz archives with a manifest.json.

Supports local export.  S3 upload is a post-MVP stub.
"""
from __future__ import annotations

import asyncio
import csv
import json
import logging
import shutil
import tarfile
import tempfile
import time
import uuid
from pathlib import Path
from typing import Optional

from python.db.database import DATA_DIR
from python.marketplace.clip_packager import assemble_clip, TIER_PRICES

logger = logging.getLogger(__name__)

EXPORT_DIR = DATA_DIR / "exports"
EXPORT_DIR.mkdir(parents=True, exist_ok=True)

_export_jobs: dict[str, dict] = {}


def get_export_job(export_id: str) -> Optional[dict]:
    return _export_jobs.get(export_id)


def start_export(
    clip_specs: list[dict],  # [{clip_id, session_id, start_frame, end_frame, tier}, ...]
    destination: str,        # "local" | "s3"
    loop: asyncio.AbstractEventLoop,
) -> str:
    export_id = str(uuid.uuid4())
    _export_jobs[export_id] = {"export_id": export_id, "status": "packaging", "path": None}

    import threading
    t = threading.Thread(
        target=_export_worker,
        args=(export_id, clip_specs, destination),
        daemon=True,
        name=f"export-{export_id[:8]}",
    )
    t.start()
    return export_id


def _export_worker(export_id: str, clip_specs: list[dict], destination: str) -> None:
    try:
        out_dir = EXPORT_DIR / export_id
        out_dir.mkdir(parents=True, exist_ok=True)

        manifest = {
            "export_id": export_id,
            "created_at": int(time.time() * 1000),
            "clips": [],
        }

        for spec in clip_specs:
            clip = assemble_clip(
                clip_id=spec["clip_id"],
                session_id=spec["session_id"],
                start_frame=spec["start_frame"],
                end_frame=spec["end_frame"],
                tier=spec["tier"],
            )
            clip_dir = out_dir / clip.clip_id
            clip_dir.mkdir(exist_ok=True)

            # Write frames
            for f in clip.frames:
                src = Path(f["frame_path"])
                if src.exists():
                    shutil.copy2(src, clip_dir / src.name)

            # Write tier-specific data files
            if clip.tier == "basic":
                _write_emotion_csv(clip_dir, clip.frames)
            elif clip.tier in ("premium", "elite"):
                _write_emotion_csv(clip_dir, clip.frames)
                _write_input_json(clip_dir, clip.frames)
            if clip.tier == "elite":
                _write_landmarks_jsonl(clip_dir, clip.frames)

            # Per-clip manifest entry
            clip_manifest_path = clip_dir / "manifest.json"
            clip_manifest = {
                "clip_id": clip.clip_id,
                "session_id": clip.session_id,
                "game": clip.game,
                "tier": clip.tier,
                "frame_count": clip.frame_count,
                "duration_s": clip.duration_s,
                "price_usd": clip.price_usd,
            }
            clip_manifest_path.write_text(json.dumps(clip_manifest, indent=2))
            manifest["clips"].append(clip_manifest)

        (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))

        # Create .tar.gz
        archive_path = EXPORT_DIR / f"{export_id}.tar.gz"
        with tarfile.open(archive_path, "w:gz") as tar:
            tar.add(out_dir, arcname=export_id)

        shutil.rmtree(out_dir)

        _export_jobs[export_id]["status"] = "ready"
        _export_jobs[export_id]["path"] = str(archive_path)
        logger.info("Export %s ready at %s", export_id, archive_path)

    except Exception as exc:
        logger.exception("Export %s failed", export_id)
        _export_jobs[export_id]["status"] = "failed"
        _export_jobs[export_id]["error"] = str(exc)


def _write_emotion_csv(clip_dir: Path, frames: list[dict]) -> None:
    path = clip_dir / "emotions.csv"
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["frame_id", "timestamp_ms", "emotion_label", "emotion_confidence"])
        writer.writeheader()
        for fr in frames:
            writer.writerow({
                "frame_id": fr["frame_id"],
                "timestamp_ms": fr["timestamp_ms"],
                "emotion_label": fr.get("emotion_label", ""),
                "emotion_confidence": fr.get("emotion_confidence", ""),
            })


def _write_input_json(clip_dir: Path, frames: list[dict]) -> None:
    path = clip_dir / "inputs.json"
    inputs = []
    for fr in frames:
        inputs.append({
            "frame_id": fr["frame_id"],
            "timestamp_ms": fr["timestamp_ms"],
            "keyboard_pressed": fr.get("keyboard_pressed", []),
            "keyboard_just_pressed": fr.get("keyboard_just_pressed", []),
            "mouse_x": fr.get("mouse_x"),
            "mouse_y": fr.get("mouse_y"),
            "mouse_dx": fr.get("mouse_dx"),
            "mouse_dy": fr.get("mouse_dy"),
            "left_click": fr.get("left_click", False),
            "right_click": fr.get("right_click", False),
            "game_health": fr.get("game_health"),
            "game_ammo": fr.get("game_ammo"),
            "game_event": fr.get("game_event"),
        })
    path.write_text(json.dumps(inputs, indent=2))


def _write_landmarks_jsonl(clip_dir: Path, frames: list[dict]) -> None:
    path = clip_dir / "landmarks.jsonl"
    with path.open("w") as f:
        for fr in frames:
            lm = fr.get("face_landmarks")
            if lm:
                f.write(json.dumps({"frame_id": fr["frame_id"], "landmarks": lm}) + "\n")

