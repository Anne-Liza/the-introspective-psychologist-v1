import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.core import rate_limit


def make_request(ip: str = "203.0.113.10") -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/auth/login",
            "headers": [],
            "client": (ip, 12345),
            "server": ("testserver", 80),
            "scheme": "http",
            "query_string": b"",
        }
    )


def setup_function():
    rate_limit._BUCKETS.clear()


def test_successful_login_checks_do_not_consume_failure_limit(monkeypatch):
    monkeypatch.setattr(
        rate_limit.settings,
        "RATE_LIMIT_ENABLED",
        True,
    )

    request = make_request()
    email = "admin@example.com"

    # A legitimate user can successfully authenticate repeatedly.
    # Checking the limiter alone must not record failures.
    for _ in range(
        rate_limit.settings.RATE_LIMIT_AUTH_IDENTIFIER_REQUESTS + 3
    ):
        rate_limit.enforce_login_failure_rate_limit(
            request,
            email,
        )

    failure_buckets = {
        key: bucket
        for key, bucket in rate_limit._BUCKETS.items()
        if key.startswith("auth-login-failure:")
    }

    assert failure_buckets
    assert all(len(bucket) == 0 for bucket in failure_buckets.values())


def test_failed_logins_eventually_trigger_429(monkeypatch):
    monkeypatch.setattr(
        rate_limit.settings,
        "RATE_LIMIT_ENABLED",
        True,
    )

    request = make_request()
    email = "admin@example.com"
    limit = (
        rate_limit.settings
        .RATE_LIMIT_AUTH_IDENTIFIER_REQUESTS
    )

    for _ in range(limit):
        rate_limit.enforce_login_failure_rate_limit(
            request,
            email,
        )
        rate_limit.record_login_failure(
            request,
            email,
        )

    with pytest.raises(HTTPException) as exc_info:
        rate_limit.enforce_login_failure_rate_limit(
            request,
            email,
        )

    assert exc_info.value.status_code == 429
    assert "Too many authentication attempts" in str(
        exc_info.value.detail
    )
