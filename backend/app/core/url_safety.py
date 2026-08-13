from __future__ import annotations

import ipaddress
import re
from urllib.parse import urlparse


class URLSafetyError(ValueError):
    pass


MAX_URL_LENGTH = 2048
CONTROL_CHAR_RE = re.compile(r"[\x00-\x1f\x7f]")


BLOCKED_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
}


BLOCKED_HOST_SUFFIXES = (
    ".localhost",
    ".local",
)


def normalize_url_value(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = value.strip()

    if not normalized:
        return None

    if len(normalized) > MAX_URL_LENGTH:
        raise URLSafetyError("URL is too long.")

    if CONTROL_CHAR_RE.search(normalized):
        raise URLSafetyError("URL contains unsafe control characters.")

    if "\\" in normalized:
        raise URLSafetyError("URL must not contain backslashes.")

    return normalized


def is_blocked_hostname(hostname: str | None) -> bool:
    if not hostname:
        return True

    normalized = hostname.rstrip(".").lower()

    if normalized in BLOCKED_HOSTNAMES:
        return True

    if any(normalized.endswith(suffix) for suffix in BLOCKED_HOST_SUFFIXES):
        return True

    try:
        ip = ipaddress.ip_address(normalized)
    except ValueError:
        return False

    return any(
        [
            ip.is_private,
            ip.is_loopback,
            ip.is_link_local,
            ip.is_multicast,
            ip.is_reserved,
            ip.is_unspecified,
        ]
    )


def validate_external_url(value: str | None, *, field_name: str = "url") -> str | None:
    normalized = normalize_url_value(value)

    if normalized is None:
        return None

    parsed = urlparse(normalized)

    if parsed.scheme not in {"http", "https"}:
        raise URLSafetyError(f"{field_name} must use http or https.")

    if not parsed.netloc or not parsed.hostname:
        raise URLSafetyError(f"{field_name} must include a valid hostname.")

    if parsed.username or parsed.password:
        raise URLSafetyError(f"{field_name} must not include embedded credentials.")

    if is_blocked_hostname(parsed.hostname):
        raise URLSafetyError(f"{field_name} points to a blocked or private host.")

    return normalized


def validate_app_relative_path(value: str | None, *, field_name: str = "url") -> str | None:
    normalized = normalize_url_value(value)

    if normalized is None:
        return None

    if not normalized.startswith("/"):
        raise URLSafetyError(f"{field_name} must start with '/'.")

    if normalized.startswith("//"):
        raise URLSafetyError(f"{field_name} must not be a protocol-relative URL.")

    if "://" in normalized:
        raise URLSafetyError(f"{field_name} must not contain a URL scheme.")

    return normalized


def validate_public_url_or_path(value: str | None, *, field_name: str = "url") -> str | None:
    normalized = normalize_url_value(value)

    if normalized is None:
        return None

    if normalized.startswith("/"):
        return validate_app_relative_path(normalized, field_name=field_name)

    return validate_external_url(normalized, field_name=field_name)
