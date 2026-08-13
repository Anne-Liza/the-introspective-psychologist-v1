from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.password_policy import validate_password_strength


class InvitationCreate(BaseModel):
    email: EmailStr
    role_name: str = Field(min_length=1, max_length=100)


class InvitationRead(BaseModel):
    id: str
    email: EmailStr
    role_name: str
    status: Literal["pending", "accepted", "revoked", "expired"]
    delivery_status: Literal["queued", "sent", "failed"]
    invited_by_user_id: str
    accepted_by_user_id: str | None = None
    revoked_by_user_id: str | None = None
    expires_at: datetime
    accepted_at: datetime | None = None
    revoked_at: datetime | None = None
    expired_at: datetime | None = None
    last_sent_at: datetime
    send_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InvitationAccept(BaseModel):
    token: str = Field(min_length=32, max_length=4096)
    full_name: str = Field(min_length=1, max_length=255)
    password: str

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("full_name must not be blank.")
        return normalized

    @field_validator("password")
    @classmethod
    def password_must_be_strong(cls, value: str) -> str:
        return validate_password_strength(value)


class InvitationActionResponse(BaseModel):
    message: str


class InvitationRoleOption(BaseModel):
    role_name: str
    description: str | None = None
    maximum_active: int | None = None
    active_count: int
    pending_count: int
    available_slots: int | None = None


class InvitationOptionsRead(BaseModel):
    roles: list[InvitationRoleOption]
