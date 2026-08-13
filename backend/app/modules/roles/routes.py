from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.modules.auth.dependencies import require_permission
from app.modules.roles.models import Role
from app.modules.roles.schemas import RoleRead
from app.modules.users.models import User

router = APIRouter()


@router.get("", response_model=list[RoleRead])
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("roles.read")),
):
    return db.scalars(select(Role).options(selectinload(Role.permissions))).all()
