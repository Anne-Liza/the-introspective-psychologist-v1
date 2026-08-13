from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rate_limit import enforce_auth_rate_limit, enforce_invitation_manage_rate_limit
from app.modules.auth.dependencies import require_permission
from app.modules.invitations import service
from app.modules.invitations.schemas import (
    InvitationAccept,
    InvitationActionResponse,
    InvitationCreate,
    InvitationOptionsRead,
    InvitationRead,
)
from app.modules.users.models import User

router = APIRouter()

PUBLIC_INVITATION_ERROR = (
    "This invitation is invalid or has expired. "
    "Please contact your practice administrator."
)


@router.get("/options", response_model=InvitationOptionsRead)
def get_invitation_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invitations.manage")),
):
    return InvitationOptionsRead(roles=service.invitation_options(db, current_user))


@router.get("", response_model=list[InvitationRead])
def list_invitations(
    invitation_status: Literal["pending", "accepted", "revoked", "expired"] | None = Query(
        default=None,
        alias="status",
    ),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invitations.read")),
):
    return service.list_invitations(
        db,
        status_filter=invitation_status,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=InvitationRead, status_code=status.HTTP_201_CREATED)
def create_invitation(
    payload: InvitationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invitations.manage")),
):
    enforce_invitation_manage_rate_limit(current_user.id)
    return service.create_invitation(
        db,
        email=str(payload.email),
        role_name=payload.role_name,
        actor=current_user,
    )


@router.post("/{invitation_id}/revoke", response_model=InvitationRead)
def revoke_invitation(
    invitation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invitations.manage")),
):
    enforce_invitation_manage_rate_limit(current_user.id)
    return service.revoke_invitation(db, invitation_id, current_user)


@router.post("/{invitation_id}/resend", response_model=InvitationRead)
def resend_invitation(
    invitation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invitations.manage")),
):
    enforce_invitation_manage_rate_limit(current_user.id)
    return service.resend_invitation(db, invitation_id, current_user)


@router.post("/accept", response_model=InvitationActionResponse)
def accept_invitation(
    payload: InvitationAccept,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_auth_rate_limit(request, payload.token)
    try:
        service.accept_invitation(
            db,
            token=payload.token,
            full_name=payload.full_name,
            password=payload.password,
        )
    except HTTPException as exc:
        if exc.status_code in {
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_404_NOT_FOUND,
            status.HTTP_409_CONFLICT,
        }:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=PUBLIC_INVITATION_ERROR,
            ) from exc
        raise
    return InvitationActionResponse(message="Invitation accepted. You can now log in.")
