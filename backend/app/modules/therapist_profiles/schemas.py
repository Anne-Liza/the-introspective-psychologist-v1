from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.core.url_safety import validate_public_url_or_path

TherapistProfileReviewStatus = Literal[
    "draft",
    "pending_review",
    "changes_requested",
    "approved",
]

TherapistProfileReviewDecision = Literal[
    "changes_requested",
    "approved",
]


class TherapistProfileBase(BaseModel):
    full_name: str
    slug: str
    title: str | None = None
    short_bio: str | None = None
    bio: str | None = None
    specialties: str | None = None
    approaches: str | None = None
    languages: str | None = None
    location: str | None = None
    session_formats: str | None = None
    profile_image_url: str | None = None
    booking_cta_label: str | None = None
    booking_cta_url: str | None = None
    sort_order: int = 0
    is_published: bool = False

    @field_validator("profile_image_url")
    @classmethod
    def validate_profile_image_url(cls, value: str | None) -> str | None:
        return validate_public_url_or_path(value, field_name="profile_image_url")

    @field_validator("booking_cta_url")
    @classmethod
    def validate_booking_cta_url(cls, value: str | None) -> str | None:
        return validate_public_url_or_path(value, field_name="booking_cta_url")


class TherapistProfileCreate(BaseModel):
    full_name: str
    slug: str
    title: str | None = None
    short_bio: str | None = None
    bio: str | None = None
    specialties: str | None = None
    approaches: str | None = None
    languages: str | None = None
    location: str | None = None
    session_formats: str | None = None
    profile_image_url: str | None = None
    booking_cta_label: str | None = None
    booking_cta_url: str | None = None
    sort_order: int = 0

    @field_validator("profile_image_url")
    @classmethod
    def validate_create_profile_image_url(
        cls,
        value: str | None,
    ) -> str | None:
        return validate_public_url_or_path(
            value,
            field_name="profile_image_url",
        )

    @field_validator("booking_cta_url")
    @classmethod
    def validate_create_booking_cta_url(
        cls,
        value: str | None,
    ) -> str | None:
        return validate_public_url_or_path(
            value,
            field_name="booking_cta_url",
        )


class TherapistProfileUpdate(BaseModel):
    slug: str | None = None
    booking_cta_label: str | None = None
    booking_cta_url: str | None = None
    sort_order: int | None = None

    @field_validator("booking_cta_url")
    @classmethod
    def validate_update_booking_cta_url(
        cls,
        value: str | None,
    ) -> str | None:
        return validate_public_url_or_path(
            value,
            field_name="booking_cta_url",
        )


class TherapistProfilePublicRead(TherapistProfileBase):
    id: str
    bookable_service_ids: list[str] = Field(
        default_factory=list,
    )

    model_config = {"from_attributes": True}


class TherapistProfileRead(TherapistProfilePublicRead):
    user_id: str | None = None
    review_status: TherapistProfileReviewStatus = "draft"
    reviewed_by_user_id: str | None = None
    reviewed_at: datetime | None = None
    review_notes: str | None = None


class TherapistProfileRevisionContent(BaseModel):
    full_name: str
    title: str | None = None
    short_bio: str | None = None
    bio: str | None = None
    specialties: str | None = None
    approaches: str | None = None
    languages: str | None = None
    location: str | None = None
    session_formats: str | None = None
    profile_image_url: str | None = None

    @field_validator("profile_image_url")
    @classmethod
    def validate_revision_profile_image_url(
        cls,
        value: str | None,
    ) -> str | None:
        return validate_public_url_or_path(
            value,
            field_name="profile_image_url",
        )


class TherapistProfileSelfCreate(TherapistProfileRevisionContent):
    pass


class TherapistProfileSelfUpdate(BaseModel):
    full_name: str | None = None
    title: str | None = None
    short_bio: str | None = None
    bio: str | None = None
    specialties: str | None = None
    approaches: str | None = None
    languages: str | None = None
    location: str | None = None
    session_formats: str | None = None
    profile_image_url: str | None = None

    @field_validator("profile_image_url")
    @classmethod
    def validate_self_update_profile_image_url(
        cls,
        value: str | None,
    ) -> str | None:
        return validate_public_url_or_path(
            value,
            field_name="profile_image_url",
        )


class TherapistProfileRevisionRead(TherapistProfileRevisionContent):
    id: str
    therapist_profile_id: str
    version_number: int
    review_status: TherapistProfileReviewStatus
    submitted_at: datetime | None = None
    reviewed_by_user_id: str | None = None
    reviewed_at: datetime | None = None
    review_notes: str | None = None
    is_current_publication: bool = False
    published_by_user_id: str | None = None
    published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TherapistProfileSelfRead(BaseModel):
    id: str
    slug: str
    is_published: bool
    published_profile: TherapistProfilePublicRead | None = None
    working_revision: TherapistProfileRevisionRead | None = None


class TherapistProfileRevisionAdminUpdate(TherapistProfileSelfUpdate):
    pass


class TherapistProfileReviewRequest(BaseModel):
    decision: TherapistProfileReviewDecision
    notes: str | None = None


class TherapistProfileAdminReviewRead(BaseModel):
    profile_id: str
    slug: str
    is_published: bool
    published_profile: TherapistProfilePublicRead | None = None
    revision: TherapistProfileRevisionRead


class TherapistProfileAccountLink(BaseModel):
    user_id: str | None


class TherapistProfileAccountOptionRead(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    linked_profile_id: str | None = None
