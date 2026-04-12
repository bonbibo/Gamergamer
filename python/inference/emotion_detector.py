"""
Emotion detection from webcam frames.

Runs every N frames (default 10) to stay within CPU budget.
Falls back gracefully if DeepFace or MediaPipe is not available.
Last detected emotion is carried forward for skipped frames.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np

try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
except ImportError:
    DEEPFACE_AVAILABLE = False

try:
    import mediapipe as mp
    MP_AVAILABLE = True
except ImportError:
    MP_AVAILABLE = False


EMOTION_LABELS = ["angry", "disgust", "fear", "happy", "sad", "surprise", "neutral"]

EMOTION_REMAP = {
    "happy": "hype",
    "surprise": "hype",
    "angry": "frustrated",
    "fear": "anxious",
    "sad": "tilted",
    "disgust": "frustrated",
    "neutral": "focused",
}


@dataclass
class EmotionResult:
    label: str
    confidence: float
    face_landmarks: Optional[list] = None


class EmotionDetector:
    def __init__(self, run_every_n_frames: int = 10):
        self._every_n = run_every_n_frames
        self._frame_counter = 0
        self._last_result: Optional[EmotionResult] = None
        self._mp_face_mesh = None

        if MP_AVAILABLE:
            self._mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
                static_image_mode=False,
                max_num_faces=1,
                refine_landmarks=False,
                min_detection_confidence=0.5,
            )

    def infer(self, frame: Optional[np.ndarray]) -> Optional[EmotionResult]:
        """
        Accept an OpenCV BGR frame. Returns the last known result if it's not
        this frame's turn to run inference.
        """
        self._frame_counter += 1
        if frame is None:
            return self._last_result

        if self._frame_counter % self._every_n != 0:
            return self._last_result

        landmarks = self._get_landmarks(frame)
        emotion, confidence = self._get_emotion(frame)

        if emotion is None:
            return self._last_result

        result = EmotionResult(
            label=EMOTION_REMAP.get(emotion, emotion),
            confidence=confidence,
            face_landmarks=landmarks,
        )
        self._last_result = result
        return result

    def _get_emotion(self, frame: np.ndarray) -> tuple[Optional[str], float]:
        if not DEEPFACE_AVAILABLE:
            return None, 0.0
        try:
            results = DeepFace.analyze(
                img_path=frame,
                actions=["emotion"],
                enforce_detection=False,
                silent=True,
            )
            if results:
                r = results[0] if isinstance(results, list) else results
                dominant = r.get("dominant_emotion", "neutral")
                emotions = r.get("emotion", {})
                confidence = emotions.get(dominant, 0.0) / 100.0
                return dominant, round(confidence, 3)
        except Exception:
            pass
        return None, 0.0

    def _get_landmarks(self, frame: np.ndarray) -> Optional[list]:
        if not MP_AVAILABLE or self._mp_face_mesh is None:
            return None
        try:
            import cv2
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = self._mp_face_mesh.process(rgb)
            if result.multi_face_landmarks:
                lms = result.multi_face_landmarks[0].landmark
                return [[round(lm.x, 4), round(lm.y, 4)] for lm in lms]
        except Exception:
            pass
        return None

    def close(self) -> None:
        if self._mp_face_mesh:
            self._mp_face_mesh.close()
