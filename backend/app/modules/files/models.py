from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utc_now


FILE_VISIBILITY_PUBLIC = "public"
FILE_VISIBILITY_INTERNAL = "internal"
FILE_VISIBILITY_PRIVATE = "private"

FILE_VISIBILITIES = {
    FILE_VISIBILITY_PUBLIC,
    FILE_VISIBILITY_INTERNAL,
    FILE_VISIBILITY_PRIVATE,
}


FILE_PURPOSE_GENERAL = "general"
FILE_PURPOSE_THERAPIST_PROFILE_IMAGE = (
    "therapist_profile_image"
)
FILE_PURPOSE_BLOG_COVER_IMAGE = "blog_cover_image"
FILE_PURPOSE_BLOG_INLINE_IMAGE = "blog_inline_image"
FILE_PURPOSE_RESOURCE = "resource"
FILE_PURPOSE_SERVICE_IMAGE = "service_image"
FILE_PURPOSE_PRODUCT_IMAGE = "product_image"
FILE_PURPOSE_INTERNAL_DOCUMENT = "internal_document"
FILE_PURPOSE_PRIVATE_DOCUMENT = "private_document"

FILE_PURPOSES = {
    FILE_PURPOSE_GENERAL,
    FILE_PURPOSE_THERAPIST_PROFILE_IMAGE,
    FILE_PURPOSE_BLOG_COVER_IMAGE,
    FILE_PURPOSE_BLOG_INLINE_IMAGE,
    FILE_PURPOSE_RESOURCE,
    FILE_PURPOSE_SERVICE_IMAGE,
    FILE_PURPOSE_PRODUCT_IMAGE,
    FILE_PURPOSE_INTERNAL_DOCUMENT,
    FILE_PURPOSE_PRIVATE_DOCUMENT,
}


class FileAsset(Base):
    __tablename__ = "files"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid4()),
    )

    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    stored_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    content_type: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )

    size_bytes: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    storage_provider: Mapped[str] = mapped_column(
        String(80),
        default="local",
    )

    storage_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    uploaded_by_user_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    owner_user_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    visibility: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=FILE_VISIBILITY_INTERNAL,
        index=True,
    )

    purpose: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
        default=FILE_PURPOSE_GENERAL,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
    )


class FileAssetUsage(Base):
    __tablename__ = "file_asset_usages"

    __table_args__ = (
        UniqueConstraint(
            "file_id",
            "entity_type",
            "entity_id",
            "field_name",
            name="uq_file_asset_usage_reference",
        ),
    )

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid4()),
    )

    file_id: Mapped[str] = mapped_column(
        String,
        ForeignKey(
            "files.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    entity_type: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
    )

    entity_id: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    field_name: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
    )
