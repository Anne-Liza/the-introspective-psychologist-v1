from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.security import decode_access_token
from app.modules.users.models import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    try:
        payload = decode_access_token(credentials.credentials)
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token.") from exc

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type.")

    user_id = payload.get("sub")
    user = db.scalar(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.roles).selectinload("*"))
    )

    if user is None or not user.is_active or not user.is_verified:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found, inactive, or unverified.")

    return user


def require_permission(permission_code: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        user_permissions = {
            permission.code
            for role in current_user.roles
            for permission in role.permissions
        }

        if "system.all" in user_permissions or permission_code in user_permissions:
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Missing required permission: {permission_code}",
        )

    return dependency



def require_all_permissions(permission_codes: list[str]):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        user_permissions = {
            permission.code
            for role in current_user.roles
            for permission in role.permissions
        }

        if "system.all" in user_permissions:
            return current_user

        missing = [
            permission_code
            for permission_code in permission_codes
            if permission_code not in user_permissions
        ]

        if not missing:
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Missing required permissions: {', '.join(missing)}",
        )

    return dependency
