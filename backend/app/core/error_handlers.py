from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.requests import Request

from app.core.redaction import redact_sensitive_text
from app.core.request_context import REQUEST_ID_HEADER, get_request_id


ERROR_CODE_BY_STATUS: dict[int, str] = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
    500: "INTERNAL_SERVER_ERROR",
}


DEFAULT_DETAIL_BY_STATUS: dict[int, str] = {
    400: "Bad request.",
    401: "Authentication required.",
    403: "Forbidden.",
    404: "Not found.",
    409: "Conflict.",
    413: "Payload too large.",
    422: "Request validation failed.",
    429: "Too many requests.",
    500: "Internal server error.",
}


def request_id_from_request(request: Request) -> str | None:
    state_request_id = getattr(request.state, "request_id", None)
    return state_request_id or get_request_id()


def error_code_for_status(status_code: int) -> str:
    return ERROR_CODE_BY_STATUS.get(status_code, f"HTTP_{status_code}")


def default_detail_for_status(status_code: int) -> str:
    return DEFAULT_DETAIL_BY_STATUS.get(status_code, "Request failed.")


def safe_detail(value: Any, *, status_code: int) -> str:
    if isinstance(value, str):
        redacted = redact_sensitive_text(value) or ""
        cleaned = redacted.strip()

        if cleaned:
            return cleaned[:500]

    return default_detail_for_status(status_code)


def safe_validation_errors(exc: RequestValidationError) -> list[dict[str, Any]]:
    safe_errors: list[dict[str, Any]] = []

    for error in exc.errors():
        raw_msg = str(error.get("msg", "Invalid value."))
        scrubbed_msg = redact_sensitive_text(raw_msg) or "Invalid value."

        safe_errors.append(
            {
                "type": error.get("type"),
                "loc": error.get("loc", []),
                "msg": scrubbed_msg[:500],
            }
        )

    return safe_errors


def error_response(
    *,
    request: Request,
    status_code: int,
    detail: str,
    error_code: str | None = None,
    extra: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    request_id = request_id_from_request(request)

    payload: dict[str, Any] = {
        "detail": detail,
        "error_code": error_code or error_code_for_status(status_code),
        "request_id": request_id,
    }

    if extra:
        payload.update(extra)

    response = JSONResponse(
        status_code=status_code,
        content=payload,
        headers=headers,
    )

    if request_id:
        response.headers[REQUEST_ID_HEADER] = request_id

    return response


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return error_response(
        request=request,
        status_code=exc.status_code,
        detail=safe_detail(exc.detail, status_code=exc.status_code),
        headers=exc.headers,
    )


async def request_validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    return error_response(
        request=request,
        status_code=422,
        detail="Request validation failed.",
        error_code="VALIDATION_ERROR",
        extra={"errors": safe_validation_errors(exc)},
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return error_response(
        request=request,
        status_code=500,
        detail="Internal server error.",
        error_code="INTERNAL_SERVER_ERROR",
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, request_validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
