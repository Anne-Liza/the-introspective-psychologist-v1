from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit_events import (
    AuditAction,
    record_audit_event,
)
from app.core.config import settings
from app.core.database import get_db
from app.core.file_safety import (
    FileSafetyError,
    resolve_existing_storage_path,
    validate_upload_metadata,
    validate_upload_size,
)
from app.core.rate_limit import (
    enforce_upload_rate_limit,
)
from app.core.storage.factory import (
    get_storage_provider,
)
from app.modules.auth.dependencies import (
    get_current_user,
    require_permission,
)
from app.modules.files.models import (
    FILE_PURPOSE_BLOG_COVER_IMAGE,
    FILE_PURPOSE_BLOG_INLINE_IMAGE,
    FILE_PURPOSE_GENERAL,
    FILE_PURPOSE_THERAPIST_PROFILE_IMAGE,
    FILE_VISIBILITY_INTERNAL,
    FILE_VISIBILITY_PUBLIC,
    FileAsset,
)
from app.modules.files.schemas import (
    FileAssetAdminRead,
    FileAssetCreate,
    FileAssetRead,
    FileAssetUsageRead,
)
from app.modules.files.service import (
    file_is_in_use,
    file_usage_count,
    list_file_usage,
    validate_file_purpose,
    validate_file_visibility,
)
from app.modules.users.models import User


router = APIRouter()


OWN_UPLOAD_PURPOSES = {
    FILE_PURPOSE_GENERAL,
    FILE_PURPOSE_THERAPIST_PROFILE_IMAGE,
    FILE_PURPOSE_BLOG_COVER_IMAGE,
    FILE_PURPOSE_BLOG_INLINE_IMAGE,
}


IMAGE_PURPOSES = {
    FILE_PURPOSE_THERAPIST_PROFILE_IMAGE,
    FILE_PURPOSE_BLOG_COVER_IMAGE,
    FILE_PURPOSE_BLOG_INLINE_IMAGE,
}


def _permission_codes(
    user: User,
) -> set[str]:
    return {
        permission.code
        for role in user.roles
        for permission in role.permissions
    }


def _has_permission(
    user: User,
    permission_code: str,
) -> bool:
    permissions = _permission_codes(
        user
    )

    return (
        "system.all" in permissions
        or permission_code in permissions
    )


def _load_file_asset(
    db: Session,
    *,
    file_id: str,
) -> FileAsset:
    file_asset = db.scalar(
        select(
            FileAsset
        ).where(
            FileAsset.id == file_id
        )
    )

    if file_asset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found.",
        )

    return file_asset


def _can_read_file(
    user: User,
    file_asset: FileAsset,
) -> bool:
    if (
        file_asset.visibility
        == FILE_VISIBILITY_PUBLIC
    ):
        return True

    if _has_permission(
        user,
        "files.read",
    ):
        return True

    return (
        file_asset.owner_user_id
        == user.id
        and _has_permission(
            user,
            "files.own.read",
        )
    )


def file_public_url(
    file_asset: FileAsset,
) -> str | None:
    if (
        file_asset.visibility
        != FILE_VISIBILITY_PUBLIC
    ):
        return None

    return (
        f"/files/public/"
        f"{file_asset.id}"
    )


def file_content_url(
    file_asset: FileAsset,
) -> str:
    public_url = file_public_url(
        file_asset
    )

    if public_url:
        return public_url

    return (
        f"/files/content/"
        f"{file_asset.id}"
    )


def serialize_file_asset(
    db: Session,
    file_asset: FileAsset,
    *,
    admin: bool = False,
) -> dict:
    payload = {
        "id": file_asset.id,
        "original_filename": (
            file_asset.original_filename
        ),
        "content_type": (
            file_asset.content_type
        ),
        "size_bytes": (
            file_asset.size_bytes
        ),
        "storage_provider": (
            file_asset.storage_provider
        ),
        "visibility": (
            file_asset.visibility
        ),
        "purpose": file_asset.purpose,
        "public_url": (
            file_public_url(
                file_asset
            )
        ),
        "content_url": (
            file_content_url(
                file_asset
            )
        ),
        "usage_count": (
            file_usage_count(
                db,
                file_id=file_asset.id,
            )
        ),
        "created_at": (
            file_asset.created_at
        ),
    }

    if admin:
        payload.update(
            {
                "uploaded_by_user_id": (
                    file_asset
                    .uploaded_by_user_id
                ),
                "owner_user_id": (
                    file_asset
                    .owner_user_id
                ),
            }
        )

    return payload


def _serve_local_file(
    file_asset: FileAsset,
):
    if (
        file_asset.storage_provider
        != "local"
    ):
        raise HTTPException(
            status_code=(
                status
                .HTTP_501_NOT_IMPLEMENTED
            ),
            detail=(
                "File serving for this "
                "storage provider is not "
                "implemented yet."
            ),
        )

    try:
        path = (
            resolve_existing_storage_path(
                settings.LOCAL_UPLOAD_DIR,
                file_asset.storage_path,
            )
        )
    except FileSafetyError:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Stored file not found.",
        )

    if (
        not path.exists()
        or not path.is_file()
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Stored file not found.",
        )

    return FileResponse(
        path,
        media_type=(
            file_asset.content_type
        ),
        filename=(
            file_asset.original_filename
        ),
    )


async def _store_uploaded_file(
    *,
    upload: UploadFile,
    db: Session,
    current_user: User,
    visibility: str,
    purpose: str,
) -> FileAsset:
    try:
        normalized_visibility = (
            validate_file_visibility(
                visibility
            )
        )

        normalized_purpose = (
            validate_file_purpose(
                purpose
            )
        )

        metadata = (
            validate_upload_metadata(
                original_filename=(
                    upload.filename
                    or "upload"
                ),
                content_type=(
                    upload.content_type
                ),
                allowed_content_types=(
                    settings
                    .allowed_upload_types
                ),
            )
        )

        if (
            normalized_purpose
            in IMAGE_PURPOSES
            and not metadata
            .content_type
            .startswith("image/")
        ):
            raise FileSafetyError(
                "This asset purpose "
                "requires an image file."
            )

        content = await upload.read(
            settings
            .max_upload_size_bytes
            + 1
        )

        validate_upload_size(
            content,
            max_size_bytes=(
                settings
                .max_upload_size_bytes
            ),
        )

    except (
        FileSafetyError,
        ValueError,
    ) as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=str(exc),
        ) from exc

    storage = get_storage_provider()

    stored_file = storage.save(
        original_filename=(
            upload.filename or "upload"
        ),
        content=content,
        content_type=(
            metadata.content_type
        ),
    )

    file_asset = FileAsset(
        original_filename=(
            stored_file
            .original_filename
        ),
        stored_filename=(
            stored_file.stored_filename
        ),
        content_type=(
            stored_file.content_type
        ),
        size_bytes=(
            stored_file.size_bytes
        ),
        storage_provider=(
            stored_file.storage_provider
        ),
        storage_path=(
            stored_file.storage_path
        ),
        uploaded_by_user_id=(
            current_user.id
        ),
        owner_user_id=(
            current_user.id
        ),
        visibility=(
            normalized_visibility
        ),
        purpose=normalized_purpose,
    )

    db.add(file_asset)
    db.commit()
    db.refresh(file_asset)

    record_audit_event(
        db,
        action=(
            AuditAction.FILE_UPLOADED
        ),
        actor=current_user,
        resource_type="file",
        resource_id=file_asset.id,
        metadata={
            "filename": (
                file_asset
                .original_filename
            ),
            "size_bytes": (
                file_asset.size_bytes
            ),
            "visibility": (
                file_asset.visibility
            ),
            "purpose": (
                file_asset.purpose
            ),
        },
    )

    return file_asset


def _delete_asset(
    *,
    db: Session,
    current_user: User,
    file_asset: FileAsset,
) -> None:
    if file_is_in_use(
        db,
        file_id=file_asset.id,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "This file is currently "
                "in use and cannot be "
                "deleted until its "
                "references are removed."
            ),
        )

    storage = get_storage_provider()

    storage.delete(
        file_asset.storage_path
    )

    record_audit_event(
        db,
        action=AuditAction.FILE_DELETED,
        actor=current_user,
        resource_type="file",
        resource_id=file_asset.id,
        metadata={
            "filename": (
                file_asset
                .original_filename
            ),
            "size_bytes": (
                file_asset.size_bytes
            ),
        },
    )

    db.delete(file_asset)
    db.commit()


# ---------------------------------------------------------
# Public file serving
# ---------------------------------------------------------


@router.get(
    "/public/{file_id}"
)
def get_public_file(
    file_id: str,
    db: Session = Depends(get_db),
):
    file_asset = _load_file_asset(
        db,
        file_id=file_id,
    )

    if (
        file_asset.visibility
        != FILE_VISIBILITY_PUBLIC
    ):
        # Hide the existence of
        # non-public assets.
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="File not found.",
        )

    return _serve_local_file(
        file_asset
    )


@router.get(
    "/content/{file_id}"
)
def get_authenticated_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    file_asset = _load_file_asset(
        db,
        file_id=file_id,
    )

    if not _can_read_file(
        current_user,
        file_asset,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="File not found.",
        )

    return _serve_local_file(
        file_asset
    )


# ---------------------------------------------------------
# Current-user asset library
# ---------------------------------------------------------


@router.get(
    "/mine",
    response_model=list[
        FileAssetRead
    ],
)
def list_owned_files(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "files.own.read"
        )
    ),
):
    files = db.scalars(
        select(
            FileAsset
        )
        .where(
            FileAsset.owner_user_id
            == current_user.id
        )
        .order_by(
            FileAsset.created_at.desc()
        )
    ).all()

    return [
        serialize_file_asset(
            db,
            file_asset,
        )
        for file_asset in files
    ]


@router.post(
    "/mine/upload",
    response_model=FileAssetRead,
    status_code=(
        status.HTTP_201_CREATED
    ),
)
async def upload_owned_file(
    request: Request,
    upload: UploadFile = File(...),
    purpose: str = Form(
        FILE_PURPOSE_GENERAL
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "files.own.upload"
        )
    ),
):
    try:
        normalized_purpose = (
            validate_file_purpose(
                purpose
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=str(exc),
        ) from exc

    if (
        normalized_purpose
        not in OWN_UPLOAD_PURPOSES
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "This file purpose is "
                "not available for "
                "self-service uploads."
            ),
        )

    enforce_upload_rate_limit(
        request,
        current_user.id,
    )

    file_asset = (
        await _store_uploaded_file(
            upload=upload,
            db=db,
            current_user=(
                current_user
            ),
            # Therapist/self-service
            # uploads remain internal
            # until a workflow publishes
            # the consuming content.
            visibility=(
                FILE_VISIBILITY_INTERNAL
            ),
            purpose=(
                normalized_purpose
            ),
        )
    )

    return serialize_file_asset(
        db,
        file_asset,
    )


@router.get(
    "/mine/{file_id}/usage",
    response_model=list[
        FileAssetUsageRead
    ],
)
def get_owned_file_usage(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "files.own.read"
        )
    ),
):
    file_asset = _load_file_asset(
        db,
        file_id=file_id,
    )

    if (
        file_asset.owner_user_id
        != current_user.id
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="File not found.",
        )

    return list_file_usage(
        db,
        file_id=file_asset.id,
    )


@router.delete(
    "/mine/{file_id}",
    status_code=(
        status.HTTP_204_NO_CONTENT
    ),
)
def delete_owned_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "files.own.delete"
        )
    ),
):
    file_asset = _load_file_asset(
        db,
        file_id=file_id,
    )

    if (
        file_asset.owner_user_id
        != current_user.id
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="File not found.",
        )

    _delete_asset(
        db=db,
        current_user=current_user,
        file_asset=file_asset,
    )

    return None


# ---------------------------------------------------------
# Admin media library
# ---------------------------------------------------------


@router.get(
    "",
    response_model=list[
        FileAssetAdminRead
    ],
)
def list_files(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "files.read"
        )
    ),
):
    files = db.scalars(
        select(
            FileAsset
        ).order_by(
            FileAsset.created_at.desc()
        )
    ).all()

    return [
        serialize_file_asset(
            db,
            file_asset,
            admin=True,
        )
        for file_asset in files
    ]


@router.post(
    "",
    response_model=FileAssetAdminRead,
    status_code=status.HTTP_410_GONE,
)
def create_file_metadata(
    payload: FileAssetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "files.upload"
        )
    ),
):
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=(
            "Direct file metadata "
            "creation has been retired. "
            "Upload the actual file "
            "instead."
        ),
    )


@router.post(
    "/upload",
    response_model=FileAssetAdminRead,
    status_code=(
        status.HTTP_201_CREATED
    ),
)
async def upload_file(
    request: Request,
    upload: UploadFile = File(...),
    visibility: str = Form(
        FILE_VISIBILITY_INTERNAL
    ),
    purpose: str = Form(
        FILE_PURPOSE_GENERAL
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "files.upload"
        )
    ),
):
    enforce_upload_rate_limit(
        request,
        current_user.id,
    )

    file_asset = (
        await _store_uploaded_file(
            upload=upload,
            db=db,
            current_user=(
                current_user
            ),
            visibility=visibility,
            purpose=purpose,
        )
    )

    return serialize_file_asset(
        db,
        file_asset,
        admin=True,
    )


@router.get(
    "/{file_id}/usage",
    response_model=list[
        FileAssetUsageRead
    ],
)
def get_file_usage(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "files.read"
        )
    ),
):
    file_asset = _load_file_asset(
        db,
        file_id=file_id,
    )

    return list_file_usage(
        db,
        file_id=file_asset.id,
    )


@router.delete(
    "/{file_id}",
    status_code=(
        status.HTTP_204_NO_CONTENT
    ),
)
def delete_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "files.delete"
        )
    ),
):
    file_asset = _load_file_asset(
        db,
        file_id=file_id,
    )

    _delete_asset(
        db=db,
        current_user=current_user,
        file_asset=file_asset,
    )

    return None
