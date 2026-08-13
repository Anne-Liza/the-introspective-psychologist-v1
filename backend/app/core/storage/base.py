from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class StoredFile:
    original_filename: str
    stored_filename: str
    content_type: str | None
    size_bytes: int
    storage_provider: str
    storage_path: str
    public_url: str | None = None


class StorageProvider(ABC):
    @abstractmethod
    def save(
        self,
        *,
        original_filename: str,
        content: bytes,
        content_type: str | None,
    ) -> StoredFile:
        raise NotImplementedError

    @abstractmethod
    def delete(self, storage_path: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_url(self, storage_path: str) -> str:
        raise NotImplementedError
