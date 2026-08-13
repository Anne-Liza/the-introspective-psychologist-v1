from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.audit_events import AuditAction, record_audit_event
from app.core.database import get_db
from app.core.profile_policy import (
    actor_can_assign_roles,
    actor_can_manage_role_transition,
    actor_can_manage_user,
    direct_user_creation_enabled,
    invitation_onboarding_enabled,
    role_maximum_active,
)
from app.core.security import hash_password
from app.modules.auth.dependencies import require_all_permissions, require_permission
from app.modules.roles.capacity import (
    assert_role_activation_capacity,
    assert_user_activation_capacity,
)
from app.modules.roles.models import Role
from app.modules.users.models import User
from app.modules.users.schemas import (
    UserCreate,
    UserRead,
    UserRoleAssign,
    UserTeamRoleAssign,
    UserUpdate,
)

router = APIRouter()


@router.get("", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.read")),
):
    return db.scalars(select(User).order_by(User.created_at.desc())).unique().all()


@router.post("", response_model=UserRead)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_all_permissions(["users.create", "roles.manage"])),
):
    if not direct_user_creation_enabled():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Staff accounts must be created through the invitation workflow.",
        )

    if not actor_can_assign_roles(current_user, payload.role_names):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Protected system roles cannot be assigned through the API.",
        )

    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists.")

    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        is_active=True,
        is_verified=True,
    )

    roles = db.scalars(select(Role).where(Role.name.in_(payload.role_names))).all()
    user.roles = roles

    db.add(user)
    db.commit()
    db.refresh(user)
    record_audit_event(
        db,
        action=AuditAction.USER_CREATED,
        actor=current_user,
        resource_type="user",
        resource_id=user.id,
        metadata={"email": user.email, "role_names": payload.role_names},
    )
    return user


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.update")),
):
    user = db.scalar(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.roles))
        .with_for_update()
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    updates = payload.model_dump(exclude_unset=True)

    if (
        user.id == current_user.id
        and updates.get("is_active") is False
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You cannot deactivate your own account.",
        )

    if not actor_can_manage_user(current_user, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot modify this protected team account.",
        )
    if updates.get("is_active") is True and not user.is_active:
        assert_user_activation_capacity(db, {role.name for role in user.roles})

    for key, value in updates.items():
        setattr(user, key, value)

    changed_fields = list(updates.keys())
    db.add(user)
    db.commit()
    db.refresh(user)
    record_audit_event(
        db,
        action=AuditAction.USER_UPDATED,
        actor=current_user,
        resource_type="user",
        resource_id=user.id,
        metadata={"changed_fields": changed_fields},
    )
    return user


@router.patch("/{user_id}/team-role", response_model=UserRead)
def assign_team_role(
    user_id: str,
    payload: UserTeamRoleAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_all_permissions(
            ["users.update", "invitations.manage"]
        )
    ),
):
    if not invitation_onboarding_enabled():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Controlled team role changes are available only "
                "for invitation-based staff onboarding."
            ),
        )

    user = db.scalar(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.roles))
        .with_for_update()
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You cannot change your own team role.",
        )

    if not actor_can_manage_user(current_user, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot modify this protected team account.",
        )

    current_role_names = {
        role.name
        for role in user.roles
    }

    if not actor_can_manage_role_transition(
        current_user,
        current_role_names,
        payload.role_name,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "You cannot assign this role or manage one of "
                "the account's current roles."
            ),
        )

    role = db.scalar(
        select(Role)
        .where(Role.name == payload.role_name)
        .with_for_update()
    )
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The selected team role does not exist.",
        )

    if user.is_active and role.name not in current_role_names:
        assert_role_activation_capacity(
            db,
            role,
            role_maximum_active(role.name),
        )

    user.roles = [role]
    db.add(user)
    db.commit()
    db.refresh(user)

    record_audit_event(
        db,
        action=AuditAction.USER_ROLES_ASSIGNED,
        actor=current_user,
        resource_type="user",
        resource_id=user.id,
        metadata={
            "previous_role_names": sorted(current_role_names),
            "role_names": [role.name],
            "workflow": "invitation_team_management",
        },
    )
    return user


@router.patch("/{user_id}/roles", response_model=UserRead)
def assign_roles(
    user_id: str,
    payload: UserRoleAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("roles.manage")),
):
    if not direct_user_creation_enabled():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Staff roles must be managed through the invitation workflow.",
        )

    user = db.scalar(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.roles))
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if not actor_can_manage_user(current_user, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a system role holder can modify a protected system account.",
        )

    if not actor_can_assign_roles(current_user, payload.role_names):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Protected system roles cannot be assigned through the API.",
        )

    roles = db.scalars(select(Role).where(Role.name.in_(payload.role_names))).all()
    found_names = {role.name for role in roles}
    missing = [name for name in payload.role_names if name not in found_names]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown roles: {', '.join(missing)}",
        )

    user.roles = roles
    db.add(user)
    db.commit()
    db.refresh(user)
    record_audit_event(
        db,
        action=AuditAction.USER_ROLES_ASSIGNED,
        actor=current_user,
        resource_type="user",
        resource_id=user.id,
        metadata={"role_names": payload.role_names},
    )
    return user
