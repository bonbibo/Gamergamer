"""
Game context extraction (Phase 5+).

In MVP, game events (kill/death) are manually logged by the user via the UI.
This module is a placeholder for future HUD OCR / template matching.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np


@dataclass
class GameContext:
    game: Optional[str] = None
    health: Optional[int] = None
    ammo: Optional[int] = None
    event: Optional[str] = None  # "kill", "death", None


class GameContextDetector:
    """Stub — returns None for all fields in MVP."""

    def detect(self, frame: np.ndarray, game: Optional[str] = None) -> GameContext:
        return GameContext(game=game)
