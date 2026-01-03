from __future__ import annotations

import argparse
from pathlib import Path

from sqlmodel import select

from app.config import get_settings
from app.database import get_session
from app.models import Recipe
from app.services.import_utils import upload_local_media_to_supabase


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Upload local recipe media files to Supabase Storage and update DB URLs."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be uploaded without modifying data.",
    )
    return parser.parse_args()


def _maybe_upload(
    file_value: str,
    bucket: str,
    prefix: str,
    dry_run: bool,
) -> str | None:
    file_path = Path(file_value)
    if not file_path.exists():
        return None
    if dry_run:
        print(f"[dry-run] upload {file_path} -> {bucket}/{prefix}")
        return None
    return upload_local_media_to_supabase(file_path, bucket, prefix)


def main() -> None:
    args = _parse_args()
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise SystemExit("Supabase storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")

    image_bucket = settings.supabase_storage_bucket_images
    video_bucket = settings.supabase_storage_bucket_videos
    prefix = settings.supabase_storage_prefix.strip("/") if settings.supabase_storage_prefix else "imports"

    with get_session() as session:
        recipes = session.exec(select(Recipe)).all()
        for recipe in recipes:
            updated = False

            if recipe.media_image_url and not recipe.media_image_url.startswith("http"):
                uploaded = _maybe_upload(
                    recipe.media_image_url,
                    image_bucket,
                    f"{prefix}/images/migration",
                    args.dry_run,
                )
                if uploaded:
                    recipe.media_image_url = uploaded
                    updated = True

            if recipe.media_video_url and not recipe.media_video_url.startswith("http"):
                uploaded = _maybe_upload(
                    recipe.media_video_url,
                    video_bucket,
                    f"{prefix}/videos/migration",
                    args.dry_run,
                )
                if uploaded:
                    recipe.media_video_url = uploaded
                    updated = True

            if updated and not args.dry_run:
                session.add(recipe)

        if not args.dry_run:
            session.commit()

    print("Migration complete.")


if __name__ == "__main__":
    main()
