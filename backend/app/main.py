import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import get_settings

from .api.routes import router as api_router
from .database import init_db

app = FastAPI(title="Recipefy API", version="0.1.0")
settings = get_settings()
logger = logging.getLogger(__name__)

default_cors_origins = {"http://localhost:3000"}
if settings.frontend_origins:
    extra_origins = [
        origin.strip().rstrip("/")
        for origin in settings.frontend_origins.split(",")
        if origin.strip()
    ]
    default_cors_origins.update(extra_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(default_cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    logger.info(
        "Storage config: supabase_url=%s bucket_images=%s bucket_videos=%s prefix=%s",
        settings.supabase_url,
        settings.supabase_storage_bucket_images,
        settings.supabase_storage_bucket_videos,
        settings.supabase_storage_prefix,
    )


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_router)
app.mount("/media", StaticFiles(directory=settings.storage_dir), name="media")
