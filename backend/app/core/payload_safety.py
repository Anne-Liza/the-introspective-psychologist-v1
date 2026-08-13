from __future__ import annotations

import json
import re
from typing import Any

from app.core.redaction import redact_sensitive_text

REDACTED_VALUE = "[REDACTED]"

EMAIL_RE = re.compile(
    r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b",
    re.IGNORECASE,
)

SENSITIVE_PAYLOAD_KEY_FRAGMENTS: tuple[str, ...] = (
    "password",
    "passwd",
    "pwd",
    "token",
    "secret",
    "api_key",
    "apikey",
    "authorization",
    "cookie",
    "set_cookie",
    "private_key",
    "client_secret",
    "webhook_signature",
    "signature",
    "cvc",
    "cvv",
    "card_number",
    "card_token",
    "payment_method_token",
    "bearer",
)

MASKED_PAYLOAD_KEY_FRAGMENTS: tuple[str, ...] = (
    "email",
    "phone",
)


def normalize_payload_key(key: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", key.lower()).strip("_")


def is_sensitive_payload_key(key: str | None) -> bool:
    if not key:
        return False

    normalized_key = normalize_payload_key(key)
    return any(fragment in normalized_key for fragment in SENSITIVE_PAYLOAD_KEY_FRAGMENTS)


def is_masked_payload_key(key: str | None) -> bool:
    if not key:
        return False

    normalized_key = normalize_payload_key(key)
    return any(fragment in normalized_key for fragment in MASKED_PAYLOAD_KEY_FRAGMENTS)


def mask_email_address(value: str) -> str:
    if "@" not in value:
        return value

    local_part, domain = value.split("@", 1)

    if not local_part:
        return f"***@{domain}"

    if len(local_part) == 1:
        masked_local = f"{local_part[0]}***"
    else:
        masked_local = f"{local_part[0]}***{local_part[-1]}"

    return f"{masked_local}@{domain}"


def mask_email_addresses_in_text(value: str) -> str:
    return EMAIL_RE.sub(lambda match: mask_email_address(match.group(0)), value)


def mask_phone_number(value: str) -> str:
    digits = re.sub(r"\D", "", value)

    if len(digits) < 7:
        return "[MASKED]"

    return f"***{digits[-4:]}"


def sanitize_string_value(value: str, *, key: str | None = None) -> str:
    redacted = redact_sensitive_text(value) or ""

    if is_masked_payload_key(key) and "phone" in normalize_payload_key(key or ""):
        return mask_phone_number(redacted)

    if is_masked_payload_key(key) and "email" in normalize_payload_key(key or ""):
        return mask_email_address(redacted)

    return mask_email_addresses_in_text(redacted)


def sanitize_payload(value: Any, *, key: str | None = None) -> Any:
    if is_sensitive_payload_key(key):
        return REDACTED_VALUE

    if isinstance(value, dict):
        return {
            item_key: sanitize_payload(item_value, key=str(item_key))
            for item_key, item_value in value.items()
        }

    if isinstance(value, list):
        return [sanitize_payload(item) for item in value]

    if isinstance(value, tuple):
        return [sanitize_payload(item) for item in value]

    if isinstance(value, str):
        return sanitize_string_value(value, key=key)

    return value


def serialize_sanitized_payload(value: Any) -> str:
    return json.dumps(sanitize_payload(value or {}), sort_keys=True)
