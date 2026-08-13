from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.profile_policy import role_maximum_active
from app.modules.roles.models import Role, user_roles
from app.modules.users.models import User


def active_role_holder_count(db: Session, role: Role) -> int:
    value = db.scalar(
        select(func.count())
        .select_from(user_roles.join(User, user_roles.c.user_id == User.id))
        .where(user_roles.c.role_id == role.id, User.is_active.is_(True))
    )
    return int(value or 0)


def assert_role_activation_capacity(
    db: Session,
    role: Role,
    maximum_active: int | None,
    *,
    additional_reservations: int = 0,
) -> None:
    if maximum_active is None:
        return

    reserved = active_role_holder_count(db, role) + additional_reservations
    if reserved >= maximum_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"The active capacity for {role.name} has already been reserved.",
        )


def assert_user_activation_capacity(db: Session, role_names: set[str]) -> None:
    capped_roles = {
        role_name: maximum_active
        for role_name in role_names
        if (maximum_active := role_maximum_active(role_name)) is not None
    }

    for role_name in sorted(capped_roles):
        role = db.scalar(select(Role).where(Role.name == role_name).with_for_update())
        if role is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"The assigned role {role_name} no longer exists.",
            )
        assert_role_activation_capacity(db, role, capped_roles[role_name])
