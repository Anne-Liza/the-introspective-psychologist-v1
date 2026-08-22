from datetime import datetime
from types import SimpleNamespace

from app.modules.mpesa_payments import service as mpesa


class FakeDB:
    def add(self, _obj):
        pass

    def commit(self):
        pass

    def refresh(self, _obj):
        pass

    def get(self, _model, _object_id):
        return None


def make_attempt():
    return SimpleNamespace(
        id="attempt-test",
        provider="mpesa",
        provider_reference="ws_CO_TEST",
        payment_request_id="payment-request-test",
        status="processing",
        error_code=None,
        error_message=None,
        reconciliation_status="idle",
        reconciliation_retry_count=0,
        reconciliation_last_attempt_at=None,
        reconciliation_next_attempt_at=None,
        reconciliation_completed_at=None,
        reconciliation_last_error_code=None,
        reconciliation_last_error_message=None,
    )


def test_schedule_mpesa_reconciliation(monkeypatch):
    now = datetime(2026, 8, 21, 12, 0, 0)
    monkeypatch.setattr(mpesa, "utc_now", lambda: now)

    attempt = make_attempt()

    mpesa.schedule_mpesa_reconciliation(
        FakeDB(),
        attempt=attempt,
    )

    assert attempt.reconciliation_status == "pending"
    assert attempt.reconciliation_retry_count == 0
    assert (
        attempt.reconciliation_next_attempt_at
        - now
    ).total_seconds() == 5


def test_mpesa_reconciliation_uses_backoff(monkeypatch):
    now = datetime(2026, 8, 21, 12, 0, 0)
    monkeypatch.setattr(mpesa, "utc_now", lambda: now)

    attempt = make_attempt()
    attempt.reconciliation_status = "pending"

    mpesa.defer_mpesa_reconciliation(
        FakeDB(),
        attempt=attempt,
        error_code="provider_rate_limited",
        error_message="Daraja returned 429.",
    )

    assert attempt.reconciliation_status == "retrying"
    assert attempt.reconciliation_retry_count == 1
    assert (
        attempt.reconciliation_next_attempt_at
        - now
    ).total_seconds() == 15


def test_mpesa_reconciliation_exhausts(monkeypatch):
    now = datetime(2026, 8, 21, 12, 0, 0)
    monkeypatch.setattr(mpesa, "utc_now", lambda: now)

    attempt = make_attempt()
    attempt.reconciliation_status = "retrying"
    attempt.reconciliation_retry_count = 5

    mpesa.defer_mpesa_reconciliation(
        FakeDB(),
        attempt=attempt,
        error_code="provider_unavailable",
        error_message="Daraja remains unavailable.",
    )

    assert attempt.reconciliation_status == "exhausted"
    assert attempt.reconciliation_retry_count == 6
    assert attempt.reconciliation_next_attempt_at is None
    assert attempt.reconciliation_completed_at == now
    assert attempt.status == "needs_review"
    assert (
        attempt.error_code
        == "mpesa_reconciliation_exhausted"
    )


def test_complete_mpesa_reconciliation(monkeypatch):
    now = datetime(2026, 8, 21, 12, 0, 0)
    monkeypatch.setattr(mpesa, "utc_now", lambda: now)

    attempt = make_attempt()
    attempt.reconciliation_status = "retrying"
    attempt.reconciliation_retry_count = 2
    attempt.reconciliation_last_error_code = "429"
    attempt.reconciliation_last_error_message = "Busy"

    mpesa.complete_mpesa_reconciliation(
        FakeDB(),
        attempt=attempt,
    )

    assert attempt.reconciliation_status == "completed"
    assert attempt.reconciliation_completed_at == now
    assert attempt.reconciliation_next_attempt_at is None
    assert attempt.reconciliation_last_error_code is None
    assert attempt.reconciliation_last_error_message is None


class ClaimDB(FakeDB):
    def __init__(self, candidate):
        self.candidate = candidate
        self.commit_count = 0

    def scalar(self, _statement):
        return self.candidate

    def commit(self):
        self.commit_count += 1


def test_claim_due_mpesa_reconciliation_sets_lease():
    now = datetime(2026, 8, 21, 12, 0, 0)
    attempt = make_attempt()
    attempt.reconciliation_status = "pending"
    attempt.reconciliation_next_attempt_at = now

    db = ClaimDB(attempt)

    claimed = (
        mpesa.claim_next_due_mpesa_reconciliation(
            db,
            now=now,
            lease_seconds=90,
        )
    )

    assert claimed is attempt
    assert (
        attempt.reconciliation_last_attempt_at
        == now
    )
    assert (
        attempt.reconciliation_next_attempt_at
        - now
    ).total_seconds() == 90
    assert db.commit_count == 1


def test_claim_due_mpesa_reconciliation_returns_none():
    db = ClaimDB(None)

    claimed = (
        mpesa.claim_next_due_mpesa_reconciliation(
            db,
            now=datetime(
                2026,
                8,
                21,
                12,
                0,
                0,
            ),
        )
    )

    assert claimed is None
    assert db.commit_count == 0


def callback_event():
    return SimpleNamespace(
        id="event-test",
    )


def test_processor_retries_http_429(monkeypatch):
    attempt = make_attempt()
    attempt.reconciliation_status = "pending"

    monkeypatch.setattr(
        mpesa,
        "latest_mpesa_callback_event_for_attempt",
        lambda *_args, **_kwargs: callback_event(),
    )

    def rejected_query(*_args, **_kwargs):
        raise mpesa.MpesaQueryRejectedError(
            "Too many requests.",
            code="429",
        )

    monkeypatch.setattr(
        mpesa,
        "query_mpesa_provider_event",
        rejected_query,
    )

    result = (
        mpesa.process_claimed_mpesa_reconciliation(
            FakeDB(),
            attempt=attempt,
        )
    )

    assert result.reconciliation_status == "retrying"
    assert result.reconciliation_retry_count == 1
    assert (
        result.reconciliation_last_error_code
        == "stk_query_rate_limited"
    )
    assert result.status == "processing"


def test_processor_retries_result_code_4999(
    monkeypatch,
):
    attempt = make_attempt()
    attempt.reconciliation_status = "pending"

    monkeypatch.setattr(
        mpesa,
        "latest_mpesa_callback_event_for_attempt",
        lambda *_args, **_kwargs: callback_event(),
    )
    monkeypatch.setattr(
        mpesa,
        "query_mpesa_provider_event",
        lambda *_args, **_kwargs: {
            "ResultCode": 4999,
        },
    )

    result = (
        mpesa.process_claimed_mpesa_reconciliation(
            FakeDB(),
            attempt=attempt,
        )
    )

    assert result.reconciliation_status == "retrying"
    assert result.reconciliation_retry_count == 1
    assert (
        result.reconciliation_last_error_code
        == "stk_query_transient"
    )


def test_processor_completes_terminal_result(
    monkeypatch,
):
    attempt = make_attempt()
    attempt.reconciliation_status = "pending"

    event = callback_event()
    query_result = {
        "ResultCode": 1032,
    }
    observed = {}

    monkeypatch.setattr(
        mpesa,
        "latest_mpesa_callback_event_for_attempt",
        lambda *_args, **_kwargs: event,
    )
    monkeypatch.setattr(
        mpesa,
        "query_mpesa_provider_event",
        lambda *_args, **_kwargs: query_result,
    )

    def fake_verify(*_args, **kwargs):
        observed["query_result"] = (
            kwargs.get("query_result_override")
        )
        return SimpleNamespace(
            verification_status="verified",
        )

    monkeypatch.setattr(
        mpesa,
        "verify_mpesa_provider_event",
        fake_verify,
    )

    result = (
        mpesa.process_claimed_mpesa_reconciliation(
            FakeDB(),
            attempt=attempt,
        )
    )

    assert observed["query_result"] is query_result
    assert (
        result.reconciliation_status
        == "completed"
    )
    assert (
        result.reconciliation_next_attempt_at
        is None
    )


def test_query_mpesa_attempt_uses_checkout_id(
    monkeypatch,
):
    attempt = make_attempt()
    observed = {}

    def fake_build_query_payload(**kwargs):
        observed["payload_args"] = kwargs

        return {
            "CheckoutRequestID": (
                kwargs["checkout_request_id"]
            ),
        }

    monkeypatch.setattr(
        mpesa,
        "build_stk_query_payload",
        fake_build_query_payload,
    )

    monkeypatch.setattr(
        mpesa,
        "fetch_daraja_access_token",
        lambda **_kwargs: "token",
    )

    monkeypatch.setattr(
        mpesa,
        "submit_daraja_stk_query",
        lambda **kwargs: {
            "CheckoutRequestID":
                kwargs["payload"][
                    "CheckoutRequestID"
                ],
            "ResultCode": 1032,
        },
    )

    result = mpesa.query_mpesa_attempt(
        attempt=attempt,
        config=SimpleNamespace(),
        client=SimpleNamespace(),
    )

    assert (
        observed["payload_args"][
            "checkout_request_id"
        ]
        == "ws_CO_TEST"
    )
    assert result["ResultCode"] == 1032


def test_missing_callback_cancellation_is_reconciled(
    monkeypatch,
):
    attempt = make_attempt()
    attempt.reconciliation_status = "pending"

    recorded = {}

    monkeypatch.setattr(
        mpesa,
        "latest_mpesa_callback_event_for_attempt",
        lambda *_args, **_kwargs: None,
    )

    monkeypatch.setattr(
        mpesa,
        "query_mpesa_attempt",
        lambda **_kwargs: {
            "CheckoutRequestID": "ws_CO_TEST",
            "ResultCode": 1032,
            "ResultDesc": "Cancelled by user.",
        },
    )

    def fake_record(_db, *, payload, **_kwargs):
        recorded["payload"] = payload
        return SimpleNamespace(id="query-event")

    monkeypatch.setattr(
        mpesa,
        "record_provider_event",
        fake_record,
    )

    result = (
        mpesa.process_claimed_mpesa_reconciliation(
            FakeDB(),
            attempt=attempt,
        )
    )

    payload = recorded["payload"]

    assert (
        payload.event_type
        == "mpesa.stk_query_reconciliation"
    )
    assert payload.event_status == "cancelled"
    assert (
        payload.verification_status == "verified"
    )
    assert (
        result.reconciliation_status
        == "completed"
    )


def test_missing_callback_success_does_not_settle(
    monkeypatch,
):
    attempt = make_attempt()
    attempt.reconciliation_status = "pending"

    recorded = []

    monkeypatch.setattr(
        mpesa,
        "latest_mpesa_callback_event_for_attempt",
        lambda *_args, **_kwargs: None,
    )

    monkeypatch.setattr(
        mpesa,
        "query_mpesa_attempt",
        lambda **_kwargs: {
            "CheckoutRequestID": "ws_CO_TEST",
            "ResultCode": 0,
        },
    )

    monkeypatch.setattr(
        mpesa,
        "record_provider_event",
        lambda *_args, **_kwargs:
            recorded.append(True),
    )

    result = (
        mpesa.process_claimed_mpesa_reconciliation(
            FakeDB(),
            attempt=attempt,
        )
    )

    assert recorded == []
    assert result.status == "processing"
    assert (
        result.reconciliation_status
        == "retrying"
    )
    assert (
        result.reconciliation_last_error_code
        == "stk_query_success_callback_pending"
    )
