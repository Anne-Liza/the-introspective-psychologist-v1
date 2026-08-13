from app.core.storage.base import StorageProvider, StoredFile


class S3StorageProvider(StorageProvider):
    provider_name = "s3"

    def save(
        self,
        *,
        original_filename: str,
        content: bytes,
        content_type: str | None,
    ) -> StoredFile:
        raise NotImplementedError(
            "S3 storage adapter is scaffolded for production setup. "
            "Install boto3 and implement this provider for your selected S3-compatible service."
        )

    def delete(self, storage_path: str) -> None:
        raise NotImplementedError("S3 delete is not implemented yet.")

    def get_url(self, storage_path: str) -> str:
        return storage_path
