from __future__ import annotations
from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from python.db.database import SessionsBase, GamificationBase


# ─── Sessions DB ────────────────────────────────────────────────────────────

class Session(SessionsBase):
    __tablename__ = "sessions"

    id = Column(Text, primary_key=True)          # UUID4
    user_id = Column(Text, nullable=False)
    game = Column(Text)
    started_at = Column(Integer, nullable=False)  # unix ms
    ended_at = Column(Integer)
    frame_count = Column(Integer, default=0)
    duration_ms = Column(Integer)
    enable_webcam = Column(Boolean, default=False)
    status = Column(Text, default="recording")    # recording | complete | error

    frames = relationship("Frame", back_populates="session", cascade="all, delete-orphan")


class Frame(SessionsBase):
    __tablename__ = "frames"

    id = Column(Integer, primary_key=True, autoincrement=True)
    frame_id = Column(Integer, nullable=False)
    session_id = Column(Text, ForeignKey("sessions.id"), nullable=False)
    timestamp_ms = Column(Integer, nullable=False)
    frame_path = Column(Text, nullable=False)

    keyboard_pressed = Column(Text)        # JSON array e.g. '["W","SHIFT"]'
    keyboard_just_pressed = Column(Text)   # JSON array
    keyboard_just_released = Column(Text)  # JSON array

    mouse_x = Column(Integer)
    mouse_y = Column(Integer)
    mouse_dx = Column(Integer)
    mouse_dy = Column(Integer)
    left_click = Column(Boolean, default=False)
    right_click = Column(Boolean, default=False)

    emotion_label = Column(Text)           # "hype", "focused", "frustrated"
    emotion_confidence = Column(Float)
    game_health = Column(Integer)
    game_ammo = Column(Integer)
    game_event = Column(Text)              # "kill", "death", null

    has_landmarks = Column(Boolean, default=False)

    session = relationship("Session", back_populates="frames")
    landmarks = relationship("FaceLandmark", back_populates="frame", cascade="all, delete-orphan")


class FaceLandmark(SessionsBase):
    __tablename__ = "face_landmarks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    frame_id_fk = Column(Integer, ForeignKey("frames.id"), nullable=False)
    landmarks = Column(Text, nullable=False)  # JSON array of [x,y] pairs

    frame = relationship("Frame", back_populates="landmarks")


# ─── Gamification DB ─────────────────────────────────────────────────────────

class User(GamificationBase):
    __tablename__ = "users"

    id = Column(Text, primary_key=True)
    username = Column(Text, nullable=False)
    created_at = Column(Integer, nullable=False)

    xp_entries = relationship("XPLedger", back_populates="user", cascade="all, delete-orphan")
    level = relationship("Level", back_populates="user", uselist=False, cascade="all, delete-orphan")
    challenges = relationship("UserChallenge", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")


class UserSettings(GamificationBase):
    __tablename__ = "user_settings"

    user_id = Column(Text, ForeignKey("users.id"), primary_key=True)
    default_game = Column(Text, default="valorant")
    enable_webcam = Column(Boolean, default=False)
    preferred_tier = Column(Text, default="basic")      # "basic" | "premium" | "elite"
    twitch_channel = Column(Text)
    twitch_username = Column(Text)
    obs_address = Column(Text, default="ws://localhost:4455")
    updated_at = Column(Integer)

    user = relationship("User", back_populates="settings")


class XPLedger(GamificationBase):
    __tablename__ = "xp_ledger"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Text, ForeignKey("users.id"), nullable=False)
    session_id = Column(Text)
    timestamp_ms = Column(Integer, nullable=False)
    reason = Column(Text, nullable=False)
    amount = Column(Integer, nullable=False)
    running_total = Column(Integer, nullable=False)

    user = relationship("User", back_populates="xp_entries")


class Level(GamificationBase):
    __tablename__ = "levels"

    user_id = Column(Text, ForeignKey("users.id"), primary_key=True)
    current_level = Column(Integer, default=1)
    total_xp = Column(Integer, default=0)
    last_updated = Column(Integer)

    user = relationship("User", back_populates="level")


class Challenge(GamificationBase):
    __tablename__ = "challenges"

    id = Column(Text, primary_key=True)
    name = Column(Text, nullable=False)
    description = Column(Text)
    xp_reward = Column(Integer, nullable=False)
    condition_type = Column(Text, nullable=False)   # "kill_count", "session_duration", "emotion_streak"
    condition_threshold = Column(Float, nullable=False)
    is_repeatable = Column(Boolean, default=False)

    user_progress = relationship("UserChallenge", back_populates="challenge", cascade="all, delete-orphan")


class UserChallenge(GamificationBase):
    __tablename__ = "user_challenges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Text, ForeignKey("users.id"), nullable=False)
    challenge_id = Column(Text, ForeignKey("challenges.id"), nullable=False)
    progress = Column(Float, default=0.0)          # 0.0 to 1.0
    completed_at = Column(Integer)
    times_completed = Column(Integer, default=0)

    user = relationship("User", back_populates="challenges")
    challenge = relationship("Challenge", back_populates="user_progress")
