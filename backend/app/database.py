from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Dict

from sqlmodel import SQLModel, Session, create_engine

from .config import get_settings

settings = get_settings()

def _build_connect_args(database_url: str) -> Dict[str, Any]:
    if database_url.startswith("sqlite"):
        return {"check_same_thread": False}
    if database_url.startswith("postgresql"):
        # Supabase (and most managed Postgres providers) require SSL.
        return {"sslmode": "require"}
    return {}


_connect_args = _build_connect_args(settings.database_url)
engine = create_engine(
    settings.database_url,
    connect_args=_connect_args,
    pool_pre_ping=True,
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


@contextmanager
def get_session() -> Session:
    with Session(engine) as session:
        yield session
