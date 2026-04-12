"""
PyTorch Dataset over the sessions SQLite database.

Each item is (frame_image_tensor, action_vector) where:
  - frame_image_tensor: [3, 224, 224] float32 normalized
  - action_vector: [N_KEYS + 2] float32
      first N_KEYS: binary key pressed (0/1)
      last 2: mouse_dx, mouse_dy (normalized by MAX_MOUSE_DELTA)
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import numpy as np

try:
    import torch
    from torch.utils.data import Dataset
    from torchvision import transforms
    from PIL import Image
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    Dataset = object  # type: ignore

from python.db.database import SessionsDB
from python.db.models import Frame

# Keys we track in the action space (common FPS + general keys)
TRACKED_KEYS = [
    "W", "A", "S", "D",
    "SHIFT", "CTRL", "SPACE", "ALT",
    "1", "2", "3", "4", "5",
    "R", "F", "G", "Q", "E",
    "TAB", "ENTER", "ESCAPE",
    "MOUSE_LEFT", "MOUSE_RIGHT",
]
N_KEYS = len(TRACKED_KEYS)
MAX_MOUSE_DELTA = 100.0  # pixels, for normalization


def build_action_vector(keyboard_pressed_json: Optional[str], left_click: bool, right_click: bool, dx: int, dy: int) -> list[float]:
    pressed = set(json.loads(keyboard_pressed_json or "[]"))
    if left_click:
        pressed.add("MOUSE_LEFT")
    if right_click:
        pressed.add("MOUSE_RIGHT")
    keys = [1.0 if k in pressed else 0.0 for k in TRACKED_KEYS]
    mouse = [
        max(-1.0, min(1.0, dx / MAX_MOUSE_DELTA)),
        max(-1.0, min(1.0, dy / MAX_MOUSE_DELTA)),
    ]
    return keys + mouse


class GameplayDataset(Dataset):
    def __init__(self, session_ids: list[str], transform=None):
        if not TORCH_AVAILABLE:
            raise RuntimeError("PyTorch not installed. Run: pip install torch torchvision")
        self._session_ids = session_ids
        self._transform = transform or transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        self._records: list[tuple[str, list[float]]] = []
        self._load_records()

    def _load_records(self) -> None:
        db = SessionsDB()
        try:
            frames = (
                db.query(Frame)
                .filter(Frame.session_id.in_(self._session_ids))
                .filter(Frame.frame_path.isnot(None))
                .order_by(Frame.session_id, Frame.frame_id)
                .all()
            )
            for f in frames:
                if not Path(f.frame_path).exists():
                    continue
                action = build_action_vector(
                    f.keyboard_pressed,
                    bool(f.left_click),
                    bool(f.right_click),
                    f.mouse_dx or 0,
                    f.mouse_dy or 0,
                )
                self._records.append((f.frame_path, action))
        finally:
            db.close()

    def __len__(self) -> int:
        return len(self._records)

    def __getitem__(self, idx: int):
        frame_path, action = self._records[idx]
        img = Image.open(frame_path).convert("RGB")
        tensor = self._transform(img)
        action_tensor = torch.tensor(action, dtype=torch.float32)
        return tensor, action_tensor
