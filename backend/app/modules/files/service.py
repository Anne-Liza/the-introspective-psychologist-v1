from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.files.models import (
    FILE_PURPOSES,
    FILE_VISIBILITIES,
    FileAsset,
    FileAssetUsage,
)


def validate_file_visibility(
    visibility: str,
) -> str:
    normalized = visibility.strip().lower()

    if normalized not in FILE_VISIBILITIES:
        raise ValueError(
            "Unsupported file visibility."
        )

    return normalized


def validate_file_purpose(
    purpose: str,
) -> str:
    normalized = purpose.strip().lower()

    if normalized not in FILE_PURPOSES:
        raise ValueError(
            "Unsupported file purpose."
        )

    return normalized


def file_usage_count(
    db: Session,
    *,
    file_id: str,
) -> int:
    return int(
        db.scalar(
            select(
                func.count(
                    FileAssetUsage.id
                )
            ).where(
                FileAssetUsage.file_id
                == file_id
            )
        )
        or 0
    )


def file_is_in_use(
    db: Session,
    *,
    file_id: str,
) -> bool:
    return (
        db.scalar(
            select(
                FileAssetUsage.id
            )
            .where(
                FileAssetUsage.file_id
                == file_id
            )
            .limit(1)
        )
        is not None
    )


def list_file_usage(
    db: Session,
    *,
    file_id: str,
) -> list[FileAssetUsage]:
    return list(
        db.scalars(
            select(
                FileAssetUsage
            )
            .where(
                FileAssetUsage.file_id
                == file_id
            )
            .order_by(
                FileAssetUsage.created_at.asc()
            )
        ).all()
    )


def register_file_usage(
    db: Session,
    *,
    file_id: str,
    entity_type: str,
    entity_id: str,
    field_name: str,
) -> FileAssetUsage:
    existing = db.scalar(
        select(
            FileAssetUsage
        ).where(
            FileAssetUsage.file_id
            == file_id,
            FileAssetUsage.entity_type
            == entity_type,
            FileAssetUsage.entity_id
            == entity_id,
            FileAssetUsage.field_name
            == field_name,
        )
    )

    if existing is not None:
        return existing

    usage = FileAssetUsage(
        file_id=file_id,
        entity_type=entity_type,
        entity_id=entity_id,
        field_name=field_name,
    )

    db.add(usage)
    db.flush()

    return usage


def unregister_file_usage(
    db: Session,
    *,
    file_id: str,
    entity_type: str,
    entity_id: str,
    field_name: str,
) -> None:
    usage = db.scalar(
        select(
            FileAssetUsage
        ).where(
            FileAssetUsage.file_id
            == file_id,
            FileAssetUsage.entity_type
            == entity_type,
            FileAssetUsage.entity_id
            == entity_id,
            FileAssetUsage.field_name
            == field_name,
        )
    )

    if usage is not None:
        db.delete(usage)


def set_file_visibility(
    file_asset: FileAsset,
    *,
    visibility: str,
) -> FileAsset:
    file_asset.visibility = (
        validate_file_visibility(
            visibility
        )
    )

    return file_asset
