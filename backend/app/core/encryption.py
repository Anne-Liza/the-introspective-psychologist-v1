from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


class EncryptionConfigurationError(RuntimeError):
    pass


class DecryptionError(ValueError):
    pass


def generate_data_encryption_key() -> str:
    return Fernet.generate_key().decode("utf-8")


def validate_data_encryption_key(key: str) -> None:
    if not key:
        raise EncryptionConfigurationError("DATA_ENCRYPTION_KEY is required.")

    try:
        Fernet(key.encode("utf-8"))
    except Exception as exc:
        raise EncryptionConfigurationError("DATA_ENCRYPTION_KEY must be a valid Fernet key.") from exc


def get_data_fernet(key: str | None = None) -> Fernet:
    resolved_key = key if key is not None else settings.DATA_ENCRYPTION_KEY
    validate_data_encryption_key(resolved_key)
    return Fernet(resolved_key.encode("utf-8"))


def encrypt_text(value: str | None, *, key: str | None = None) -> str | None:
    if value is None:
        return None

    fernet = get_data_fernet(key)
    return fernet.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_text(value: str | None, *, key: str | None = None) -> str | None:
    if value is None:
        return None

    fernet = get_data_fernet(key)

    try:
        return fernet.decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise DecryptionError("Encrypted value could not be decrypted with the configured key.") from exc
