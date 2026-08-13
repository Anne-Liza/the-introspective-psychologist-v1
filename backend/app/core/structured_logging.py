from __future__ import annotations

import json
import logging
from typing import Any

from app.core.payload_safety import sanitize_payload
from app.core.request_context import get_request_id


APP_LOGGER_NAME = "launch_kit"

VALID_LOG_LEVELS = {
    "debug",
    "info",
    "warning",
    "error",
    "critical",
}


def app_logger() -> logging.Logger:
    return logging.getLogger(APP_LOGGER_NAME)


def normalize_log_level(level: str) -> str:
    normalized = level.lower().strip()

    if normalized not in VALID_LOG_LEVELS:
        raise ValueError(f"Unsupported log level: {level}")

    return normalized


def structured_log_payload(
    *,
    event: str,
    level: str = "info",
    message: str | None = None,
    metadata: dict[str, Any] | None = None,
    request_id: str | None = None,
) -> dict[str, Any]:
    normalized_level = normalize_log_level(level)

    payload: dict[str, Any] = {
        "event": event,
        "level": normalized_level,
        "request_id": request_id or get_request_id(),
        "message": sanitize_payload(message or "", key="message"),
        "metadata": sanitize_payload(metadata or {}),
    }

    return payload


def log_event(
    *,
    event: str,
    level: str = "info",
    message: str | None = None,
    metadata: dict[str, Any] | None = None,
    request_id: str | None = None,
    logger: logging.Logger | None = None,
) -> dict[str, Any]:
    payload = structured_log_payload(
        event=event,
        level=level,
        message=message,
        metadata=metadata,
        request_id=request_id,
    )

    target_logger = logger or app_logger()
    serialized = json.dumps(payload, sort_keys=True, default=str)

    getattr(target_logger, payload["level"])(serialized)

    return payload
