from __future__ import annotations

import re
from contextvars import ContextVar, Token
from uuid import uuid4

from starlette.requests import Request
from starlette.responses import Response


REQUEST_ID_HEADER = "X-Request-ID"
CORRELATION_ID_HEADER = "X-Correlation-ID"

_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,100}$")
_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)


def generate_request_id() -> str:
    return f"req_{uuid4().hex}"


def normalize_request_id(value: str | None) -> str | None:
    if not value:
        return None

    candidate = value.strip()

    if not _REQUEST_ID_PATTERN.fullmatch(candidate):
        return None

    return candidate


def request_id_from_request(request: Request) -> str:
    return (
        normalize_request_id(request.headers.get(REQUEST_ID_HEADER))
        or normalize_request_id(request.headers.get(CORRELATION_ID_HEADER))
        or generate_request_id()
    )


def set_request_id(request_id: str) -> Token[str | None]:
    return _request_id.set(request_id)


def reset_request_id(token: Token[str | None]) -> None:
    _request_id.reset(token)


def get_request_id() -> str | None:
    return _request_id.get()


async def add_request_id(request: Request, call_next) -> Response:
    request_id = request_id_from_request(request)
    token = set_request_id(request_id)
    request.state.request_id = request_id

    try:
        response = await call_next(request)
    finally:
        reset_request_id(token)

    response.headers[REQUEST_ID_HEADER] = request_id
    return response
