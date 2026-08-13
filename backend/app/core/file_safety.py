from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4


class FileSafetyError(ValueError):
    pass


DANGEROUS_EXTENSIONS = {
    ".bat",
    ".cmd",
    ".com",
    ".dll",
    ".exe",
    ".html",
    ".htm",
    ".js",
    ".mjs",
    ".php",
    ".ps1",
    ".scr",
    ".sh",
    ".svg",
    ".vbs",
}

MIME_EXTENSION_ALLOWLIST: dict[str, set[str]] = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
    "application/pdf": {".pdf"},
    "text/plain": {".txt"},
}

SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


@dataclass(frozen=True)
class SafeUploadMetadata:
    original_filename: str
    safe_original_filename: str
    content_type: str
    extension: str


def normalize_content_type(content_type: str | None) -> str:
    if not content_type:
        raise FileSafetyError("Missing file content type.")

    return content_type.split(";", 1)[0].strip().lower()


def sanitize_original_filename(filename: str | None) -> str:
    raw_name = filename or "upload"
    basename = Path(raw_name.replace("\x00", "")).name

    if not basename or basename in {".", ".."}:
        basename = "upload"

    sanitized = SAFE_FILENAME_RE.sub("_", basename).strip("._")

    if not sanitized:
        sanitized = "upload"

    return sanitized[:180]


def get_file_extension(filename: str) -> str:
    return Path(filename).suffix.lower()


def validate_upload_metadata(
    *,
    original_filename: str | None,
    content_type: str | None,
    allowed_content_types: set[str],
) -> SafeUploadMetadata:
    normalized_content_type = normalize_content_type(content_type)

    if normalized_content_type not in allowed_content_types:
        raise FileSafetyError(f"Unsupported file type: {normalized_content_type}")

    safe_original_filename = sanitize_original_filename(original_filename)
    extension = get_file_extension(safe_original_filename)

    if not extension:
        raise FileSafetyError("Uploaded file must include a safe file extension.")

    if extension in DANGEROUS_EXTENSIONS:
        raise FileSafetyError(f"Unsupported file extension: {extension}")

    allowed_extensions = MIME_EXTENSION_ALLOWLIST.get(normalized_content_type)
    if allowed_extensions is not None and extension not in allowed_extensions:
        allowed = ", ".join(sorted(allowed_extensions))
        raise FileSafetyError(
            f"File extension {extension} does not match content type "
            f"{normalized_content_type}. Allowed extensions: {allowed}"
        )

    return SafeUploadMetadata(
        original_filename=original_filename or "upload",
        safe_original_filename=safe_original_filename,
        content_type=normalized_content_type,
        extension=extension,
    )


def validate_upload_size(content: bytes, *, max_size_bytes: int) -> None:
    if len(content) > max_size_bytes:
        raise FileSafetyError("File is too large.")


def generate_safe_stored_filename(metadata: SafeUploadMetadata) -> str:
    return f"{uuid4()}{metadata.extension}"


def resolve_safe_storage_path(upload_dir: str | Path, stored_filename: str) -> Path:
    upload_root = Path(upload_dir).resolve()
    filename = Path(stored_filename).name

    if filename != stored_filename:
        raise FileSafetyError("Storage filename must not contain path separators.")

    if not filename or filename in {".", ".."}:
        raise FileSafetyError("Storage filename is invalid.")

    candidate = (upload_root / filename).resolve()

    if not candidate.is_relative_to(upload_root):
        raise FileSafetyError("Storage path escapes the upload directory.")

    return candidate


def resolve_existing_storage_path(upload_dir: str | Path, storage_path: str) -> Path:
    upload_root = Path(upload_dir).resolve()
    candidate = Path(storage_path).resolve()

    if not candidate.is_relative_to(upload_root):
        raise FileSafetyError("Stored file path escapes the upload directory.")

    return candidate
