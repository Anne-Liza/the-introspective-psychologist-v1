from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.audit_events import AuditAction, record_audit_event
from app.core.database import get_db
from app.core.rate_limit import enforce_auth_rate_limit
from app.core.profile_policy import public_registration_enabled
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.schemas import (
    AuthResponse,
    ResetPasswordRequest,
    ForgotPasswordRequest,
    AuthTokens,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    RegistrationResponse,
    VerifyEmailRequest,
)
from app.modules.auth.service import authenticate_user, create_email_verification_token, create_token_pair, refresh_access_token, register_user, request_password_reset, reset_password_with_token, revoke_refresh_token, send_email_verification, verify_email_token
from app.modules.users.models import User
from app.modules.users.schemas import UserRead

router = APIRouter()


@router.post("/register", response_model=RegistrationResponse)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    if not public_registration_enabled():
        raise HTTPException(status_code=404, detail="Not found.")

    enforce_auth_rate_limit(request, payload.email)
    user = register_user(db, payload.email, payload.password, payload.full_name)
    raw_token = create_email_verification_token(db, user)
    send_email_verification(db, user, raw_token)
    record_audit_event(
        db,
        action=AuditAction.AUTH_REGISTERED,
        actor=user,
        resource_type="user",
        resource_id=user.id,
        metadata={"email": user.email},
    )
    return RegistrationResponse(
        message="Registration successful. Please check your email to verify your account.",
        email=user.email,
    )


@router.post("/verify-email")
def verify_email(payload: VerifyEmailRequest, request: Request, db: Session = Depends(get_db)):
    enforce_auth_rate_limit(request, "verify-email")
    user = verify_email_token(db, payload.token)
    record_audit_event(
        db,
        action=AuditAction.AUTH_EMAIL_VERIFIED,
        actor=user,
        resource_type="user",
        resource_id=user.id,
        metadata={"email": user.email},
    )
    return {"message": "Email verified successfully. You can now log in.", "email": user.email}


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    enforce_auth_rate_limit(request, payload.email)
    request_password_reset(db, payload.email)
    record_audit_event(
        db,
        action=AuditAction.AUTH_PASSWORD_RESET_REQUESTED,
        resource_type="auth",
        metadata={"email": payload.email},
    )
    return {"message": "If this email exists, password reset instructions have been sent."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    enforce_auth_rate_limit(request, "reset-password")
    user = reset_password_with_token(db, payload.token, payload.new_password)
    record_audit_event(
        db,
        action=AuditAction.AUTH_PASSWORD_RESET_COMPLETED,
        actor=user,
        resource_type="user",
        resource_id=user.id,
        metadata={"email": user.email},
    )
    return {"message": "Password reset successfully. You can now log in."}


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    enforce_auth_rate_limit(request, payload.email)
    try:
        user = authenticate_user(db, payload.email, payload.password)
    except HTTPException:
        record_audit_event(
            db,
            action=AuditAction.AUTH_LOGIN_FAILED,
            resource_type="auth",
            metadata={"email": payload.email},
        )
        raise

    access_token, refresh_token = create_token_pair(db, user)
    record_audit_event(
        db,
        action=AuditAction.AUTH_LOGIN_SUCCESS,
        actor=user,
        resource_type="user",
        resource_id=user.id,
        metadata={"email": user.email},
    )
    return AuthResponse(tokens=AuthTokens(access_token=access_token, refresh_token=refresh_token), user=user)


@router.post("/refresh", response_model=AuthResponse)
def refresh(payload: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    access_token, refresh_token, user = refresh_access_token(db, payload.refresh_token)
    record_audit_event(
        db,
        action=AuditAction.AUTH_REFRESH_ROTATED,
        actor=user,
        resource_type="user",
        resource_id=user.id,
        metadata={"email": user.email},
    )
    return AuthResponse(tokens=AuthTokens(access_token=access_token, refresh_token=refresh_token), user=user)


@router.post("/logout")
def logout(payload: LogoutRequest, request: Request, db: Session = Depends(get_db)):
    revoke_refresh_token(db, payload.refresh_token)
    record_audit_event(
        db,
        action=AuditAction.AUTH_LOGOUT,
        resource_type="auth",
        metadata={"refresh_token_present": bool(payload.refresh_token)},
    )
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=UserRead)
def me(current_user=Depends(get_current_user)):
    return current_user
