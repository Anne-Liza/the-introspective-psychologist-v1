from __future__ import annotations

from collections import defaultdict, deque
from hashlib import sha256
from time import monotonic
from typing import Literal

from fastapi import HTTPException, Request, status
from starlette.responses import JSONResponse, Response

from app.core.config import settings


_BUCKETS: dict[str, deque[float]] = defaultdict(deque)

PublicActionRateLimitScope = Literal[
    "appointment_request",
    "booking_hold",
    "checkout_order",
    "checkout_payment",
    "checkout_payment_status",
    "contact_submission",
    "payment_initiation",
    "provider_callback",
]

PUBLIC_ACTION_RATE_LIMIT_SCOPES = frozenset(
    {
        "appointment_request",
        "booking_hold",
        "checkout_order",
        "checkout_payment",
        "checkout_payment_status",
        "contact_submission",
        "payment_initiation",
        "provider_callback",
    }
)

PUBLIC_ACTION_RATE_LIMIT_POLICY_SETTINGS: dict[
    PublicActionRateLimitScope,
    tuple[str, str],
] = {
    "appointment_request": (
        "RATE_LIMIT_APPOINTMENT_REQUEST_REQUESTS",
        "RATE_LIMIT_APPOINTMENT_REQUEST_WINDOW_SECONDS",
    ),
    "booking_hold": (
        "RATE_LIMIT_BOOKING_HOLD_REQUESTS",
        "RATE_LIMIT_BOOKING_HOLD_WINDOW_SECONDS",
    ),
    "checkout_order": (
        "RATE_LIMIT_CHECKOUT_ORDER_REQUESTS",
        "RATE_LIMIT_CHECKOUT_ORDER_WINDOW_SECONDS",
    ),
    "checkout_payment": (
        "RATE_LIMIT_CHECKOUT_PAYMENT_REQUESTS",
        "RATE_LIMIT_CHECKOUT_PAYMENT_WINDOW_SECONDS",
    ),
    "checkout_payment_status": (
        "RATE_LIMIT_CHECKOUT_PAYMENT_STATUS_REQUESTS",
        "RATE_LIMIT_CHECKOUT_PAYMENT_STATUS_WINDOW_SECONDS",
    ),
    "contact_submission": (
        "RATE_LIMIT_CONTACT_REQUESTS",
        "RATE_LIMIT_CONTACT_WINDOW_SECONDS",
    ),
    "payment_initiation": (
        "RATE_LIMIT_PAYMENT_INITIATION_REQUESTS",
        "RATE_LIMIT_PAYMENT_INITIATION_WINDOW_SECONDS",
    ),
    "provider_callback": (
        "RATE_LIMIT_PROVIDER_CALLBACK_REQUESTS",
        "RATE_LIMIT_PROVIDER_CALLBACK_WINDOW_SECONDS",
    ),
}


def client_ip(request: Request) -> str:
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def identifier_hash(value: str) -> str:
    normalized = value.strip().lower()
    return sha256(normalized.encode("utf-8")).hexdigest()


def _check_bucket(
    key: str,
    limit: int,
    window_seconds: int,
    *,
    record_attempt: bool = True,
) -> tuple[int, int]:
    now = monotonic()
    bucket = _BUCKETS[key]

    while bucket and now - bucket[0] >= window_seconds:
        bucket.popleft()

    if len(bucket) >= limit:
        retry_after = max(
            1,
            int(window_seconds - (now - bucket[0])),
        )
        return retry_after, 0

    if record_attempt:
        bucket.append(now)

    remaining = max(0, limit - len(bucket))
    return 0, remaining


def enforce_rate_limit(
    *,
    key: str,
    limit: int,
    window_seconds: int,
    detail: str = "Too many requests. Please try again later.",
    record_attempt: bool = True,
) -> None:
    if not settings.RATE_LIMIT_ENABLED:
        return

    retry_after, _remaining = _check_bucket(
        key,
        limit,
        window_seconds,
        record_attempt=record_attempt,
    )

    if retry_after > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            headers={"Retry-After": str(retry_after)},
        )


def enforce_auth_rate_limit(request: Request, identifier: str) -> None:
    ip = client_ip(request)
    hashed_identifier = identifier_hash(identifier)

    enforce_rate_limit(
        key=f"auth:ip:{ip}",
        limit=settings.RATE_LIMIT_AUTH_IP_REQUESTS,
        window_seconds=settings.RATE_LIMIT_AUTH_IP_WINDOW_SECONDS,
        detail="Too many authentication attempts. Please try again later.",
    )

    enforce_rate_limit(
        key=f"auth:identifier:{hashed_identifier}",
        limit=settings.RATE_LIMIT_AUTH_IDENTIFIER_REQUESTS,
        window_seconds=settings.RATE_LIMIT_AUTH_IDENTIFIER_WINDOW_SECONDS,
        detail="Too many authentication attempts. Please try again later.",
    )

    enforce_rate_limit(
        key=f"auth:pair:{ip}:{hashed_identifier}",
        limit=settings.RATE_LIMIT_AUTH_IDENTIFIER_REQUESTS,
        window_seconds=settings.RATE_LIMIT_AUTH_IDENTIFIER_WINDOW_SECONDS,
        detail="Too many authentication attempts. Please try again later.",
    )


def _login_failure_keys(
    request: Request,
    identifier: str,
) -> tuple[str, str, str]:
    ip = client_ip(request)
    hashed_identifier = identifier_hash(identifier)

    return (
        f"auth-login-failure:ip:{ip}",
        f"auth-login-failure:identifier:{hashed_identifier}",
        f"auth-login-failure:pair:{ip}:{hashed_identifier}",
    )


def enforce_login_failure_rate_limit(
    request: Request,
    identifier: str,
) -> None:
    ip_key, identifier_key, pair_key = (
        _login_failure_keys(request, identifier)
    )

    enforce_rate_limit(
        key=ip_key,
        limit=settings.RATE_LIMIT_AUTH_IP_REQUESTS,
        window_seconds=settings.RATE_LIMIT_AUTH_IP_WINDOW_SECONDS,
        detail="Too many authentication attempts. Please try again later.",
        record_attempt=False,
    )

    for key in (identifier_key, pair_key):
        enforce_rate_limit(
            key=key,
            limit=settings.RATE_LIMIT_AUTH_IDENTIFIER_REQUESTS,
            window_seconds=settings.RATE_LIMIT_AUTH_IDENTIFIER_WINDOW_SECONDS,
            detail="Too many authentication attempts. Please try again later.",
            record_attempt=False,
        )


def record_login_failure(
    request: Request,
    identifier: str,
) -> None:
    now = monotonic()

    for key in _login_failure_keys(request, identifier):
        _BUCKETS[key].append(now)


def enforce_invitation_manage_rate_limit(user_id: str) -> None:
    enforce_rate_limit(
        key=f"invitation:manage:{user_id}",
        limit=settings.RATE_LIMIT_INVITATION_MANAGE_REQUESTS,
        window_seconds=settings.RATE_LIMIT_INVITATION_MANAGE_WINDOW_SECONDS,
        detail="Too many invitation operations. Please try again later.",
    )


def public_action_rate_limit_policy(
    scope: PublicActionRateLimitScope,
) -> tuple[int, int]:
    try:
        limit_setting, window_setting = (
            PUBLIC_ACTION_RATE_LIMIT_POLICY_SETTINGS[
                scope
            ]
        )
    except KeyError as exc:
        raise ValueError(
            "Unsupported public action "
            f"rate-limit scope: {scope}"
        ) from exc

    return (
        int(getattr(settings, limit_setting)),
        int(getattr(settings, window_setting)),
    )


def enforce_public_action_rate_limit(
    request: Request,
    *,
    scope: PublicActionRateLimitScope,
) -> None:
    limit, window_seconds = (
        public_action_rate_limit_policy(scope)
    )

    ip = client_ip(request)
    enforce_rate_limit(
        key=f"public_action:{scope}:ip:{ip}",
        limit=limit,
        window_seconds=window_seconds,
        detail=(
            "Too many requests for this action. "
            "Please try again later."
        ),
    )


def enforce_contact_rate_limit(request: Request) -> None:
    """Backward-compatible wrapper for contact form submissions."""
    enforce_public_action_rate_limit(request, scope="contact_submission")


def enforce_upload_rate_limit(request: Request, user_id: str) -> None:
    ip = client_ip(request)
    enforce_rate_limit(
        key=f"upload:user:{user_id}",
        limit=settings.RATE_LIMIT_UPLOAD_REQUESTS,
        window_seconds=settings.RATE_LIMIT_UPLOAD_WINDOW_SECONDS,
        detail="Too many uploads. Please try again later.",
    )
    enforce_rate_limit(
        key=f"upload:ip:{ip}",
        limit=settings.RATE_LIMIT_UPLOAD_REQUESTS,
        window_seconds=settings.RATE_LIMIT_UPLOAD_WINDOW_SECONDS,
        detail="Too many uploads. Please try again later.",
    )


async def add_global_rate_limit(request: Request, call_next) -> Response:
    if settings.RATE_LIMIT_ENABLED:
        ip = client_ip(request)
        retry_after, remaining = _check_bucket(
            key=f"global:{ip}",
            limit=settings.RATE_LIMIT_GLOBAL_REQUESTS,
            window_seconds=settings.RATE_LIMIT_GLOBAL_WINDOW_SECONDS,
        )

        if retry_after > 0:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Too many requests. Please try again later."},
                headers={"Retry-After": str(retry_after)},
            )

    response = await call_next(request)

    if settings.RATE_LIMIT_ENABLED:
        response.headers.setdefault("X-RateLimit-Policy", "global-ip")

    return response
