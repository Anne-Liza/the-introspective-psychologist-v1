from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.modules.auth.models import EmailVerificationToken, PasswordResetToken, RefreshToken
from app.modules.email.service import send_email
try:
    from app.modules.email_templates.models import EmailTemplate
except ModuleNotFoundError as exc:
    missing_module = exc.name or ""
    if missing_module != "app.modules.email_templates" and not missing_module.startswith("app.modules.email_templates."):
        raise

    EmailTemplate = None
from app.modules.roles.models import Role
from app.modules.users.models import User



def utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)




def render_email_verification_template(db: Session, verification_link: str) -> tuple[str, str]:
    template = None
    if EmailTemplate is not None:
        template = db.scalar(select(EmailTemplate).where(EmailTemplate.key == "email_verification"))

    if template is None:
        subject = f"Verify your {settings.APP_NAME} email"
        body = (
            f"Welcome to {settings.APP_NAME}.\n\n"
            f"Use this link to verify your email address: {verification_link}\n\n"
            "If you did not create this account, you can ignore this email."
        )
        return subject, body

    values = {
        "{{ app_name }}": settings.APP_NAME,
        "{{ verification_link }}": verification_link,
    }

    subject = template.subject
    body = template.body

    for placeholder, value in values.items():
        subject = subject.replace(placeholder, value)
        body = body.replace(placeholder, value)

    return subject, body


def create_email_verification_token(db: Session, user: User) -> str:
    raw_token = token_urlsafe(32)

    token_record = EmailVerificationToken(
        user_id=user.id,
        token_hash=hash_token(raw_token),
        expires_at=utc_now() + timedelta(hours=24),
    )

    db.add(token_record)
    db.commit()

    return raw_token


def send_email_verification(db: Session, user: User, raw_token: str) -> None:
    verification_link = f"{settings.FRONTEND_BASE_URL}/verify-email?token={raw_token}"
    subject, body = render_email_verification_template(db, verification_link)

    send_email(
        db,
        to_email=user.email,
        subject=subject,
        body=body,
    )


def verify_email_token(db: Session, raw_token: str) -> User:
    token_record = db.scalar(
        select(EmailVerificationToken).where(EmailVerificationToken.token_hash == hash_token(raw_token))
    )

    if token_record is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token.")

    if token_record.used_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification token has already been used.")

    if token_record.expires_at < utc_now():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token.")

    user = db.scalar(select(User).where(User.id == token_record.user_id))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token.")

    user.is_verified = True
    token_record.used_at = utc_now()

    db.add(user)
    db.add(token_record)
    db.commit()
    db.refresh(user)

    return user


def render_password_reset_template(db: Session, reset_link: str) -> tuple[str, str]:
    template = None
    if EmailTemplate is not None:
        template = db.scalar(select(EmailTemplate).where(EmailTemplate.key == "password_reset"))

    if template is None:
        subject = f"Reset your {settings.APP_NAME} password"
        body = f"Use this link to reset your password: {reset_link}"
        return subject, body

    values = {
        "{{ app_name }}": settings.APP_NAME,
        "{{ reset_link }}": reset_link,
    }

    subject = template.subject
    body = template.body

    for placeholder, value in values.items():
        subject = subject.replace(placeholder, value)
        body = body.replace(placeholder, value)

    return subject, body


def create_password_reset_token(db: Session, user: User) -> str:
    raw_token = token_urlsafe(32)

    token_record = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_token(raw_token),
        expires_at=utc_now() + timedelta(hours=1),
    )

    db.add(token_record)
    db.commit()

    return raw_token


def send_password_reset_email(db: Session, user: User, raw_token: str) -> None:
    reset_link = f"{settings.FRONTEND_BASE_URL}/reset-password?token={raw_token}"
    subject, body = render_password_reset_template(db, reset_link)

    send_email(
        db,
        to_email=user.email,
        subject=subject,
        body=body,
    )


def request_password_reset(db: Session, email: str) -> None:
    user = db.scalar(select(User).where(User.email == email.lower()))

    if user is None or not user.is_active:
        return

    raw_token = create_password_reset_token(db, user)
    send_password_reset_email(db, user, raw_token)


def reset_password_with_token(db: Session, raw_token: str, new_password: str) -> User:
    token_record = db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(raw_token))
    )

    if token_record is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired password reset token.")

    if token_record.used_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password reset token has already been used.")

    if token_record.expires_at < utc_now():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired password reset token.")

    user = db.scalar(select(User).where(User.id == token_record.user_id))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired password reset token.")

    user.password_hash = hash_password(new_password)
    user.is_verified = True
    token_record.used_at = utc_now()

    refresh_tokens = db.scalars(
        select(RefreshToken).where(
            RefreshToken.user_id == user.id,
            RefreshToken.revoked_at.is_(None),
        )
    ).all()

    for refresh_token in refresh_tokens:
        refresh_token.revoked_at = utc_now()
        db.add(refresh_token)

    db.add(user)
    db.add(token_record)
    db.commit()
    db.refresh(user)

    return user


def create_token_pair(db: Session, user: User) -> tuple[str, str]:
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)
    token_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh_token),
        expires_at=utc_now() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(token_record)
    db.commit()
    return access_token, refresh_token


def register_user(db: Session, email: str, password: str, full_name: str | None = None) -> User:
    existing_user = db.scalar(select(User).where(User.email == email.lower()))
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists.")

    user = User(
        email=email.lower(),
        full_name=full_name,
        password_hash=hash_password(password),
        is_active=True,
        is_verified=False,
    )

    default_role = db.scalar(select(Role).where(Role.name == "Viewer"))
    if default_role:
        user.roles.append(default_role)

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    user = db.scalar(
        select(User)
        .where(User.email == email.lower())
        .options(selectinload(User.roles).selectinload("*"))
    )
    if not user or not user.password_hash or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This user account is inactive.")

    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Please verify your email before logging in.")

    return user


def refresh_access_token(db: Session, refresh_token: str) -> tuple[str, str, User]:
    try:
        payload = decode_refresh_token(refresh_token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token.") from exc

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type.")

    token_record = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token)))

    if (
        token_record is None
        or token_record.revoked_at is not None
        or token_record.expires_at < utc_now()
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has been revoked or expired.")

    user = db.scalar(
        select(User)
        .where(User.id == payload.get("sub"))
        .options(selectinload(User.roles).selectinload("*"))
    )

    if user is None or not user.is_active or not user.is_verified:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found, inactive, or unverified.")

    token_record.revoked_at = utc_now()
    db.add(token_record)
    db.commit()

    access_token, new_refresh_token = create_token_pair(db, user)
    return access_token, new_refresh_token, user


def revoke_refresh_token(db: Session, refresh_token: str) -> None:
    token_record = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token)))
    if token_record and token_record.revoked_at is None:
        token_record.revoked_at = utc_now()
        db.add(token_record)
        db.commit()
