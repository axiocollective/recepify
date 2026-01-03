from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = "sqlite:///./recipefy.db"
    supabase_db_url: Optional[str] = None
    supabase_url: Optional[str] = None
    supabase_service_role_key: Optional[str] = None
    supabase_storage_bucket_videos: str = "recipe-videos"
    supabase_storage_bucket_images: str = "recipe-images"
    supabase_storage_prefix: str = "imports"
    storage_dir: Path = Path("storage")
    frontend_origins: Optional[str] = None
    openai_api_key: Optional[str] = None
    scan_vision_model: str = "gpt-4o"
    scan_fallback_model: Optional[str] = "gpt-4o-mini"
    scan_max_output_tokens: Optional[int] = 800
    scan_max_image_edge: int = 1600
    scan_jpeg_quality: int = 80
    scan_retry_attempts: int = 2
    scan_retry_delay_seconds: float = 1.5
    google_vision_api_key: Optional[str] = None
    assistant_model_priority: str = "gpt-4o,gpt-4o-mini,o4-mini"
    assistant_disable_finder_ai: bool = False


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.supabase_db_url:
        settings.supabase_db_url = _normalize_database_url(settings.supabase_db_url)
    if settings.supabase_db_url and settings.database_url == "sqlite:///./recipefy.db":
        settings.database_url = settings.supabase_db_url
    settings.database_url = _normalize_database_url(settings.database_url)
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    return settings


def _normalize_database_url(database_url: str) -> str:
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url
