from fastapi import HTTPException, status

from app.core.config import settings
from app.core.storage.base import StorageProvider
from app.core.storage.local import LocalStorageProvider
from app.core.storage.s3 import S3StorageProvider


def get_storage_provider() -> StorageProvider:
    if settings.STORAGE_PROVIDER == "local":
        return LocalStorageProvider()

    if settings.STORAGE_PROVIDER in {"s3", "cloudflare_r2", "supabase", "minio"}:
        return S3StorageProvider()

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Unsupported storage provider: {settings.STORAGE_PROVIDER}",
    )
