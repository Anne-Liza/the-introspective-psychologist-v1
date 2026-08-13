from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Any
from uuid import uuid4

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"
RESERVED_TOKEN_CLAIMS = {"sub", "exp", "type", "jti"}


def apply_extra_token_claims(payload: dict[str, Any], extra_claims: dict[str, Any] | None) -> dict[str, Any]:
    if not extra_claims:
        return payload

    for key, value in extra_claims.items():
        if key in RESERVED_TOKEN_CLAIMS:
            continue
        payload[key] = value

    return payload


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def hash_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": subject,
        "exp": expire,
        "type": "access",
        "jti": str(uuid4()),
    }
    apply_extra_token_claims(payload, extra_claims)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    expire = datetime.now(UTC) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    payload: dict[str, Any] = {
        "sub": subject,
        "exp": expire,
        "type": "refresh",
        "jti": str(uuid4()),
    }
    apply_extra_token_claims(payload, extra_claims)
    return jwt.encode(payload, settings.JWT_REFRESH_SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[ALGORITHM])


def decode_refresh_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.JWT_REFRESH_SECRET_KEY, algorithms=[ALGORITHM])
