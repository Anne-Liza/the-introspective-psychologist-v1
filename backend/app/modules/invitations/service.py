from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.audit_events import AuditAction, record_audit_event
from app.core.config import settings
from app.core.profile_policy import (
    actor_can_invite_role,
    invitation_expiry_hours,
    invitation_onboarding_enabled,
    invitation_role_policies,
    invitation_role_policy,
)
from app.core.security import hash_password, hash_token
from app.core.time import utc_now
from app.modules.email.service import send_email
from app.modules.invitations.models import Invitation
from app.modules.invitations.tokens import create_invitation_token, decode_invitation_token
from app.modules.roles.capacity import active_role_holder_count, assert_role_activation_capacity
from app.modules.roles.models import Role
from app.modules.users.models import User

try:
    from app.modules.email_templates.models import EmailTemplate
except ModuleNotFoundError:
    EmailTemplate = None


INVITATION_RESEND_COOLDOWN_SECONDS = 60


def normalize_email(value: str) -> str:
    return value.strip().lower()


def assert_invitation_workflow_enabled() -> None:
    if not invitation_onboarding_enabled():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This profile does not use invitation-only staff onboarding.",
        )


def assert_actor_can_manage_role(actor: User, role_name: str) -> dict:
    policy = invitation_role_policy(role_name)
    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This role cannot be assigned through invitations.",
        )
    if not actor_can_invite_role(actor, role_name):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot manage invitations for this role.",
        )
    return policy


def mark_expired(invitation: Invitation, now) -> None:
    invitation.status = "expired"
    invitation.expired_at = now
    invitation.token_hash = None
    invitation.pending_email_key = None


def expire_pending_invitations(
    db: Session,
    *,
    role_name: str | None = None,
    email: str | None = None,
) -> list[str]:
    now = utc_now()
    statement = select(Invitation).where(
        Invitation.status == "pending",
        Invitation.expires_at <= now,
    )
    if role_name is not None and email is not None:
        statement = statement.where(
            or_(Invitation.role_name == role_name, Invitation.email == email)
        )
    elif role_name is not None:
        statement = statement.where(Invitation.role_name == role_name)
    elif email is not None:
        statement = statement.where(Invitation.email == email)

    expired = list(db.scalars(statement.with_for_update()).all())
    for invitation in expired:
        mark_expired(invitation, now)
        db.add(invitation)
    if expired:
        db.flush()
    return [invitation.id for invitation in expired]


def record_expired_events(db: Session, invitation_ids: list[str]) -> None:
    for invitation_id in invitation_ids:
        record_audit_event(
            db,
            action=AuditAction.INVITATION_EXPIRED,
            resource_type="invitation",
            resource_id=invitation_id,
            metadata={"status": "expired"},
        )


def lock_role(db: Session, role_name: str) -> Role:
    role = db.scalar(select(Role).where(Role.name == role_name).with_for_update())
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation role does not exist.",
        )
    return role


def pending_role_invitation_count(db: Session, role_name: str) -> int:
    value = db.scalar(
        select(func.count(Invitation.id)).where(
            Invitation.role_name == role_name,
            Invitation.status == "pending",
            Invitation.expires_at > utc_now(),
        )
    )
    return int(value or 0)


def assert_capacity_available(
    db: Session,
    role: Role,
    policy: dict,
    *,
    include_pending: bool,
) -> None:
    maximum_active = policy.get("maximum_active")
    if maximum_active is None:
        return

    pending_reservations = (
        pending_role_invitation_count(db, role.name) if include_pending else 0
    )
    assert_role_activation_capacity(
        db,
        role,
        int(maximum_active),
        additional_reservations=pending_reservations,
    )


def invitation_template(db: Session, invitation: Invitation, accept_link: str) -> tuple[str, str]:
    subject = f"You have been invited to {settings.APP_NAME}"
    body = (
        f"You have been invited to join {settings.APP_NAME}.\n\n"
        f"Role: {invitation.role_name}\n"
        f"Accept invitation: {accept_link}\n\n"
        f"This invitation expires in {invitation_expiry_hours()} hours."
    )

    if EmailTemplate is not None:
        template = db.scalar(
            select(EmailTemplate).where(
                EmailTemplate.key == "invitation",
                EmailTemplate.is_active.is_(True),
            )
        )
        if template is not None:
            subject = template.subject
            body = template.body

    replacements = {
        "{{ app_name }}": settings.APP_NAME,
        "{{ role_name }}": invitation.role_name,
        "{{ invitation_link }}": accept_link,
        "{{ token }}": accept_link,
        "{{ expiry_hours }}": str(invitation_expiry_hours()),
    }
    for placeholder, value in replacements.items():
        subject = subject.replace(placeholder, value)
        body = body.replace(placeholder, value)
    return subject, body


def deliver_invitation(db: Session, invitation: Invitation, raw_token: str) -> None:
    accept_link = f"{settings.FRONTEND_BASE_URL}/accept-invitation#token={raw_token}"
    subject, body = invitation_template(db, invitation, accept_link)
    delivery = send_email(
        db,
        to_email=invitation.email,
        subject=subject,
        body=body,
    )
    invitation.delivery_status = delivery.status
    db.add(invitation)
    db.commit()
    db.refresh(invitation)


def invitation_options(db: Session, actor: User) -> list[dict]:
    assert_invitation_workflow_enabled()
    expired_ids = expire_pending_invitations(db)
    if expired_ids:
        db.commit()
        record_expired_events(db, expired_ids)

    options: list[dict] = []
    policies = invitation_role_policies()
    for role_name in sorted(policies):
        if not actor_can_invite_role(actor, role_name):
            continue
        role = db.scalar(select(Role).where(Role.name == role_name))
        if role is None:
            continue
        maximum_active = policies[role_name].get("maximum_active")
        active_count = active_role_holder_count(db, role)
        pending_count = pending_role_invitation_count(db, role_name)
        available_slots = (
            None
            if maximum_active is None
            else max(int(maximum_active) - active_count - pending_count, 0)
        )
        options.append(
            {
                "role_name": role.name,
                "description": role.description,
                "maximum_active": maximum_active,
                "active_count": active_count,
                "pending_count": pending_count,
                "available_slots": available_slots,
            }
        )
    return options


def list_invitations(
    db: Session,
    *,
    status_filter: str | None,
    limit: int,
    offset: int,
) -> list[Invitation]:
    expired_ids = expire_pending_invitations(db)
    if expired_ids:
        db.commit()
        record_expired_events(db, expired_ids)

    statement = select(Invitation)
    if status_filter is not None:
        statement = statement.where(Invitation.status == status_filter)
    statement = statement.order_by(Invitation.created_at.desc()).offset(offset).limit(limit)
    return list(db.scalars(statement).all())


def create_invitation(
    db: Session,
    *,
    email: str,
    role_name: str,
    actor: User,
) -> Invitation:
    assert_invitation_workflow_enabled()
    policy = assert_actor_can_manage_role(actor, role_name)
    normalized_email = normalize_email(email)
    role = lock_role(db, role_name)
    expired_ids = expire_pending_invitations(
        db,
        role_name=role_name,
        email=normalized_email,
    )

    if db.scalar(select(User.id).where(User.email == normalized_email)) is not None:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account already exists for this email address.",
        )

    if db.scalar(
        select(Invitation.id).where(
            Invitation.pending_email_key == normalized_email,
            Invitation.status == "pending",
        )
    ) is not None:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pending invitation already exists for this email address.",
        )

    assert_capacity_available(db, role, policy, include_pending=True)

    now = utc_now()
    expires_at = now + timedelta(hours=invitation_expiry_hours())
    invitation_id = str(uuid4())
    raw_token = create_invitation_token(invitation_id, expires_at)
    invitation = Invitation(
        id=invitation_id,
        email=normalized_email,
        pending_email_key=normalized_email,
        role_name=role.name,
        token_hash=hash_token(raw_token),
        status="pending",
        delivery_status="queued",
        invited_by_user_id=actor.id,
        expires_at=expires_at,
        last_sent_at=now,
        send_count=1,
    )
    db.add(invitation)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pending invitation already exists for this email address.",
        ) from exc

    db.refresh(invitation)
    record_expired_events(db, expired_ids)
    record_audit_event(
        db,
        action=AuditAction.INVITATION_CREATED,
        actor=actor,
        resource_type="invitation",
        resource_id=invitation.id,
        metadata={"role_name": invitation.role_name, "status": invitation.status},
    )
    deliver_invitation(db, invitation, raw_token)
    return invitation


def invitation_for_management(db: Session, invitation_id: str, actor: User) -> Invitation:
    invitation = db.scalar(
        select(Invitation).where(Invitation.id == invitation_id).with_for_update()
    )
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found.")
    assert_actor_can_manage_role(actor, invitation.role_name)
    return invitation


def revoke_invitation(db: Session, invitation_id: str, actor: User) -> Invitation:
    assert_invitation_workflow_enabled()
    invitation = invitation_for_management(db, invitation_id, actor)
    now = utc_now()
    if invitation.status == "pending" and invitation.expires_at <= now:
        mark_expired(invitation, now)
        db.commit()
        record_expired_events(db, [invitation.id])
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invitation has expired.")
    if invitation.status != "pending":
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending invitations can be revoked.",
        )

    invitation.status = "revoked"
    invitation.revoked_at = now
    invitation.revoked_by_user_id = actor.id
    invitation.token_hash = None
    invitation.pending_email_key = None
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    record_audit_event(
        db,
        action=AuditAction.INVITATION_REVOKED,
        actor=actor,
        resource_type="invitation",
        resource_id=invitation.id,
        metadata={"role_name": invitation.role_name, "status": invitation.status},
    )
    return invitation


def resend_invitation(db: Session, invitation_id: str, actor: User) -> Invitation:
    assert_invitation_workflow_enabled()
    invitation = invitation_for_management(db, invitation_id, actor)
    now = utc_now()
    if invitation.status == "pending" and invitation.expires_at <= now:
        mark_expired(invitation, now)
        db.commit()
        record_expired_events(db, [invitation.id])
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invitation has expired.")
    if invitation.status != "pending":
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending invitations can be resent.",
        )
    if (now - invitation.last_sent_at).total_seconds() < INVITATION_RESEND_COOLDOWN_SECONDS:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Wait before resending this invitation.",
        )

    invitation.expires_at = now + timedelta(hours=invitation_expiry_hours())
    raw_token = create_invitation_token(invitation.id, invitation.expires_at)
    invitation.token_hash = hash_token(raw_token)
    invitation.delivery_status = "queued"
    invitation.last_sent_at = now
    invitation.send_count += 1
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    record_audit_event(
        db,
        action=AuditAction.INVITATION_RESENT,
        actor=actor,
        resource_type="invitation",
        resource_id=invitation.id,
        metadata={"role_name": invitation.role_name, "send_count": invitation.send_count},
    )
    deliver_invitation(db, invitation, raw_token)
    return invitation


def accept_invitation(
    db: Session,
    *,
    token: str,
    full_name: str,
    password: str,
) -> User:
    assert_invitation_workflow_enabled()
    token_digest = hash_token(token)
    try:
        invitation_id = decode_invitation_token(token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired invitation.",
        ) from exc

    preview = db.scalar(
        select(Invitation).where(
            Invitation.id == invitation_id,
            Invitation.token_hash == token_digest,
        )
    )
    if preview is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired invitation.",
        )

    policy = invitation_role_policy(preview.role_name)
    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The invited role is no longer available.",
        )
    role = lock_role(db, preview.role_name)
    invitation = db.scalar(
        select(Invitation)
        .where(
            Invitation.id == invitation_id,
            Invitation.token_hash == token_digest,
        )
        .with_for_update()
    )
    if invitation is None or invitation.status != "pending":
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired invitation.",
        )

    now = utc_now()
    if invitation.expires_at <= now:
        mark_expired(invitation, now)
        db.commit()
        record_expired_events(db, [invitation.id])
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired invitation.",
        )

    if db.scalar(select(User.id).where(User.email == invitation.email)) is not None:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account already exists for this invitation email.",
        )
    assert_capacity_available(db, role, policy, include_pending=False)

    user = User(
        email=invitation.email,
        full_name=full_name.strip(),
        password_hash=hash_password(password),
        is_active=True,
        is_verified=True,
    )
    user.roles = [role]
    db.add(user)
    db.flush()

    invitation.status = "accepted"
    invitation.accepted_at = now
    invitation.accepted_by_user_id = user.id
    invitation.token_hash = None
    invitation.pending_email_key = None
    db.add(invitation)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account already exists for this invitation email.",
        ) from exc

    db.refresh(user)
    record_audit_event(
        db,
        action=AuditAction.INVITATION_ACCEPTED,
        actor=user,
        resource_type="invitation",
        resource_id=invitation.id,
        metadata={"role_name": invitation.role_name, "status": invitation.status},
    )
    return user
