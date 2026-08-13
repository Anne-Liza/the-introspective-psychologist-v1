from pydantic import BaseModel, field_validator, EmailStr

from app.modules.users.schemas import UserRead
from app.core.password_policy import validate_password_strength


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str | None = None
    password: str

    @field_validator("password")
    @classmethod
    def password_must_be_strong(cls, value: str) -> str:
        return validate_password_strength(value)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegistrationResponse(BaseModel):
    message: str
    email: EmailStr


class VerifyEmailRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_must_be_strong(cls, value: str) -> str:
        return validate_password_strength(value)


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class AuthTokens(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    tokens: AuthTokens
    user: UserRead

