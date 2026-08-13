from datetime import UTC, datetime
from secrets import token_urlsafe

from jose import JWTError, jwt

from app.core.config import settings
from app.core.security import ALGORITHM


INVITATION_TOKEN_TYPE = "invitation"


def aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def create_invitation_token(invitation_id: str, expires_at: datetime) -> str:
    payload = {
        "sub": invitation_id,
        "exp": aware_utc(expires_at),
        "type": INVITATION_TOKEN_TYPE,
        "jti": token_urlsafe(32),
    }
    return jwt.encode(payload, settings.INVITATION_TOKEN_SECRET, algorithm=ALGORITHM)


def decode_invitation_token(token: str) -> str:
    payload = jwt.decode(
        token,
        settings.INVITATION_TOKEN_SECRET,
        algorithms=[ALGORITHM],
    )
    invitation_id = payload.get("sub")
    if payload.get("type") != INVITATION_TOKEN_TYPE or not isinstance(invitation_id, str):
        raise JWTError("Invalid invitation token claims.")
    return invitation_id
