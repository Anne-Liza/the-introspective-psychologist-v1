from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


FileVisibility = Literal[
    "public",
    "internal",
    "private",
]


FilePurpose = Literal[
    "general",
    "therapist_profile_image",
    "blog_cover_image",
    "blog_inline_image",
    "resource",
    "service_image",
    "product_image",
    "landing_section_image",
    "internal_document",
    "private_document",
]


class FileAssetRead(BaseModel):
    id: str
    original_filename: str
    content_type: str | None = None
    size_bytes: int
    storage_provider: str
    visibility: FileVisibility
    purpose: FilePurpose
    public_url: str | None = None
    content_url: str
    usage_count: int = 0
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }


class FileAssetAdminRead(FileAssetRead):
    uploaded_by_user_id: str | None = None
    owner_user_id: str | None = None


class FileAssetUsageRead(BaseModel):
    id: str
    file_id: str
    entity_type: str
    entity_id: str
    field_name: str
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }


# Kept temporarily so the existing legacy metadata route
# continues to import cleanly until we retire that route
# in the next checkpoint.
class FileAssetCreate(BaseModel):
    original_filename: str = Field(
        min_length=1,
        max_length=255,
    )
    stored_filename: str = Field(
        min_length=1,
        max_length=255,
    )
    content_type: str | None = Field(
        default=None,
        max_length=120,
    )
    size_bytes: int = Field(
        default=0,
        ge=0,
    )
    storage_provider: str = Field(
        default="local",
        min_length=1,
        max_length=80,
    )
    storage_path: str = Field(
        min_length=1,
        max_length=500,
    )
