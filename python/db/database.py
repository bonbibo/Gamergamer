import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATA_DIR = Path(os.environ.get("GAMERGAMER_DATA_DIR", Path(__file__).parent.parent.parent / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
(DATA_DIR / "frames").mkdir(exist_ok=True)
(DATA_DIR / "models").mkdir(exist_ok=True)

SESSIONS_DB_URL = f"sqlite:///{DATA_DIR / 'sessions.db'}"
GAMIFICATION_DB_URL = f"sqlite:///{DATA_DIR / 'gamification.db'}"

sessions_engine = create_engine(SESSIONS_DB_URL, connect_args={"check_same_thread": False})
gamification_engine = create_engine(GAMIFICATION_DB_URL, connect_args={"check_same_thread": False})

SessionsDB = sessionmaker(autocommit=False, autoflush=False, bind=sessions_engine)
GamificationDB = sessionmaker(autocommit=False, autoflush=False, bind=gamification_engine)


class SessionsBase(DeclarativeBase):
    pass


class GamificationBase(DeclarativeBase):
    pass


def get_sessions_db():
    db = SessionsDB()
    try:
        yield db
    finally:
        db.close()


def get_gamification_db():
    db = GamificationDB()
    try:
        yield db
    finally:
        db.close()


def init_databases():
    # Models must be imported so their table definitions register on the
    # Base.metadata objects before create_all() is called.
    # Using a direct import avoids the fragile importlib approach.
    from python.db import models as _models  # noqa: F401  (side-effect import)
    SessionsBase.metadata.create_all(bind=sessions_engine)
    GamificationBase.metadata.create_all(bind=gamification_engine)
