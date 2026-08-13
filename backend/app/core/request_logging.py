from __future__ import annotations

from time import monotonic
from typing import Any

from starlette.requests import Request
from starlette.responses import Response

from app.core.request_context import get_request_id
from app.core.structured_logging import log_event


def safe_request_path(request: Request) -> str:
    # Path only. Do not include query strings because they may contain tokens or personal data.
    return request.url.path


def request_log_metadata(
    *,
    request: Request,
    status_code: int,
    duration_ms: float,
) -> dict[str, Any]:
    return {
        "method": request.method,
        "path": safe_request_path(request),
        "status_code": status_code,
        "duration_ms": round(duration_ms, 2),
    }


def request_log_level(status_code: int) -> str:
    if status_code >= 500:
        return "error"

    if status_code >= 400:
        return "warning"

    return "info"


async def add_request_logging(request: Request, call_next) -> Response:
    started_at = monotonic()
    status_code = 500

    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        duration_ms = (monotonic() - started_at) * 1000
        request_id = getattr(request.state, "request_id", None) or get_request_id()

        log_event(
            event="http.request.completed",
            level=request_log_level(status_code),
            message="HTTP request completed.",
            metadata=request_log_metadata(
                request=request,
                status_code=status_code,
                duration_ms=duration_ms,
            ),
            request_id=request_id,
        )
