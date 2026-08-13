from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.password_policy import validate_password_strength
from app.modules.roles.schemas import RoleRead


class UserRead(BaseModel):
    id: str
    email: EmailStr
    full_name: str | None = None
    is_active: bool
    is_verified: bool
    created_at: datetime
    roles: list[RoleRead] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str | None = None
    password: str

    @field_validator("password")
    @classmethod
    def password_must_be_strong(cls, value: str) -> str:
        return validate_password_strength(value)
    role_names: list[str] = Field(default_factory=lambda: ["Viewer"])


class UserUpdate(BaseModel):
    full_name: str | None = None
    is_active: bool | None = None
    is_verified: bool | None = None


class UserRoleAssign(BaseModel):
    role_names: list[str]


class UserTeamRoleAssign(BaseModel):
    role_name: str = Field(min_length=1, max_length=100)

    @field_validator("role_name")
    @classmethod
    def normalize_role_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Role name is required.")
        return normalized
