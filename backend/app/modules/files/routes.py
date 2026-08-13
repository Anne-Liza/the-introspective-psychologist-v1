from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.file_safety import (
    FileSafetyError,
    resolve_existing_storage_path,
    validate_upload_metadata,
    validate_upload_size,
)
from app.core.audit_events import AuditAction, record_audit_event
from app.core.rate_limit import enforce_upload_rate_limit
from app.core.storage.factory import get_storage_provider

try:
    from app.modules.audit_logs.service import create_audit_log
except ModuleNotFoundError:
    def record_audit_event(*args, **kwargs):
        return None

from app.modules.auth.dependencies import require_permission
from app.modules.files.models import FileAsset
from app.modules.files.schemas import FileAssetCreate, FileAssetRead
from app.modules.users.models import User

router = APIRouter()


def file_public_url(file_asset: FileAsset) -> str:
    return f"/files/public/{file_asset.id}"


def serialize_file_asset(file_asset: FileAsset) -> dict:
    return {
        "id": file_asset.id,
        "original_filename": file_asset.original_filename,
        "stored_filename": file_asset.stored_filename,
        "content_type": file_asset.content_type,
        "size_bytes": file_asset.size_bytes,
        "storage_provider": file_asset.storage_provider,
        "storage_path": file_asset.storage_path,
        "public_url": file_public_url(file_asset),
        "created_at": file_asset.created_at,
    }


@router.get("", response_model=list[FileAssetRead])
def list_files(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("files.read")),
):
    files = db.scalars(select(FileAsset).order_by(FileAsset.created_at.desc())).all()
    return [serialize_file_asset(file_asset) for file_asset in files]


@router.get("/public/{file_id}")
def get_public_file(
    file_id: str,
    db: Session = Depends(get_db),
):
    file_asset = db.scalar(select(FileAsset).where(FileAsset.id == file_id))

    if file_asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")

    if file_asset.storage_provider != "local":
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Public file serving for this storage provider is not implemented yet.",
        )

    try:
        path = resolve_existing_storage_path(settings.LOCAL_UPLOAD_DIR, file_asset.storage_path)
    except FileSafetyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored file not found.")

    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored file not found.")

    return FileResponse(
        path,
        media_type=file_asset.content_type,
        filename=file_asset.original_filename,
    )


@router.post("", response_model=FileAssetRead)
def create_file_metadata(
    payload: FileAssetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("files.upload")),
):
    file_asset = FileAsset(**payload.model_dump(), uploaded_by_user_id=current_user.id)
    db.add(file_asset)
    db.commit()
    db.refresh(file_asset)

    record_audit_event(
        db,
        action=AuditAction.FILE_METADATA_CREATED,
        actor=current_user,
        resource_type="file",
        resource_id=file_asset.id,
    )

    return serialize_file_asset(file_asset)


@router.post("/upload", response_model=FileAssetRead)
async def upload_file(
    request: Request,
    upload: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("files.upload")),
):
    enforce_upload_rate_limit(request, current_user.id)
    try:
        validate_upload_metadata(
            original_filename=upload.filename or "upload",
            content_type=upload.content_type,
            allowed_content_types=settings.allowed_upload_types,
        )

        content = await upload.read(settings.max_upload_size_bytes + 1)
        validate_upload_size(content, max_size_bytes=settings.max_upload_size_bytes)
    except FileSafetyError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    storage = get_storage_provider()
    stored_file = storage.save(
        original_filename=upload.filename or "upload",
        content=content,
        content_type=content_type,
    )

    file_asset = FileAsset(
        original_filename=stored_file.original_filename,
        stored_filename=stored_file.stored_filename,
        content_type=stored_file.content_type,
        size_bytes=stored_file.size_bytes,
        storage_provider=stored_file.storage_provider,
        storage_path=stored_file.storage_path,
        uploaded_by_user_id=current_user.id,
    )
    db.add(file_asset)
    db.commit()
    db.refresh(file_asset)

    record_audit_event(
        db,
        action=AuditAction.FILE_UPLOADED,
        actor=current_user,
        resource_type="file",
        resource_id=file_asset.id,
        metadata={"filename": file_asset.original_filename, "size_bytes": file_asset.size_bytes},
    )

    return serialize_file_asset(file_asset)


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("files.delete")),
):
    file_asset = db.scalar(select(FileAsset).where(FileAsset.id == file_id))

    if file_asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")

    storage = get_storage_provider()
    storage.delete(file_asset.storage_path)

    record_audit_event(
        db,
        action=AuditAction.FILE_DELETED,
        actor=current_user,
        resource_type="file",
        resource_id=file_asset.id,
        metadata={"filename": file_asset.original_filename, "size_bytes": file_asset.size_bytes},
    )

    db.delete(file_asset)
    db.commit()
    return None
