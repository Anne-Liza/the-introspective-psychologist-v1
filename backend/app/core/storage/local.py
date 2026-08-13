from pathlib import Path

from app.core.config import settings
from app.core.file_safety import (
    generate_safe_stored_filename,
    resolve_existing_storage_path,
    resolve_safe_storage_path,
    validate_upload_metadata,
)
from app.core.storage.base import StorageProvider, StoredFile


class LocalStorageProvider(StorageProvider):
    provider_name = "local"

    def __init__(self, upload_dir: str | None = None):
        self.upload_dir = Path(upload_dir or settings.LOCAL_UPLOAD_DIR)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def save(
        self,
        *,
        original_filename: str,
        content: bytes,
        content_type: str | None,
    ) -> StoredFile:
        metadata = validate_upload_metadata(
            original_filename=original_filename,
            content_type=content_type,
            allowed_content_types=settings.allowed_upload_types,
        )
        stored_filename = generate_safe_stored_filename(metadata)
        path = resolve_safe_storage_path(self.upload_dir, stored_filename)

        path.write_bytes(content)
        storage_path = str(path)

        return StoredFile(
            original_filename=metadata.safe_original_filename,
            stored_filename=stored_filename,
            content_type=metadata.content_type,
            size_bytes=len(content),
            storage_provider=self.provider_name,
            storage_path=storage_path,
            public_url=self.get_url(storage_path),
        )

    def delete(self, storage_path: str) -> None:
        path = resolve_existing_storage_path(self.upload_dir, storage_path)
        if path.exists():
            path.unlink()

    def get_url(self, storage_path: str) -> str:
        return storage_path
