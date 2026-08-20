from types import SimpleNamespace

from app.modules.mpesa_payments import service as mpesa
from app.modules.payment_attempts import service as attempts


def test_mpesa_customer_cancellation_maps_to_cancelled():
    assert (
        mpesa.mpesa_event_status_from_result_code(1032)
        == "cancelled"
    )

    assert (
        mpesa.mpesa_event_status_from_result_code(0)
        == "succeeded"
    )

    assert (
        mpesa.mpesa_event_status_from_result_code(1)
        == "failed"
    )


def test_verified_cancelled_event_stays_cancelled(
    monkeypatch,
):
    attempt = SimpleNamespace(
        id="attempt-1",
        payment_request_id="payment-1",
        provider_reference="checkout-1",
        provider_transaction_reference=None,
        status="processing",
        verification_status="unverified",
        verified_at=None,
        error_message=None,
    )

    event = SimpleNamespace(
        is_duplicate=False,
        verification_status="verified",
    )

    payload = SimpleNamespace(
        provider_reference="checkout-1",
        provider_transaction_reference=None,
        event_status="cancelled",
    )

    transitions = []

    monkeypatch.setattr(
        attempts,
        "update_payment_request_after_verified_event",
        lambda _db, **kwargs: transitions.append(kwargs),
    )

    class DB:
        def add(self, _obj):
            pass

    attempts.apply_event_to_attempt_and_request(
        DB(),
        attempt=attempt,
        event=event,
        payload=payload,
    )

    assert attempt.status == "cancelled"
    assert attempt.verification_status == "verified"

    assert len(transitions) == 1
    assert transitions[0]["next_status"] == "cancelled"


def test_mpesa_result_code_mismatch_reason_includes_both_codes():
    reason = mpesa.mpesa_result_code_mismatch_reason(
        1032,
        1,
    )

    assert "1032" in reason
    assert "1" in reason
    assert "Daraja STK query" in reason


def test_mpesa_4999_query_result_is_transient():
    assert mpesa.mpesa_stk_query_result_is_transient(
        4999
    )
    assert not mpesa.mpesa_stk_query_result_is_transient(
        1032
    )


def test_mpesa_query_retries_transient_4999(
    monkeypatch,
):
    results = [
        {"ResultCode": 4999},
        {"ResultCode": "4999"},
        {"ResultCode": 1032},
    ]
    calls = []
    sleeps = []

    def fake_query(*_args, **_kwargs):
        calls.append(True)
        return results.pop(0)

    monkeypatch.setattr(
        mpesa,
        "query_mpesa_provider_event",
        fake_query,
    )
    monkeypatch.setattr(
        mpesa.time,
        "sleep",
        lambda seconds: sleeps.append(seconds),
    )

    result = (
        mpesa._query_mpesa_provider_event_with_retry(
            SimpleNamespace(),
            provider_event_id="event-1",
        )
    )

    assert result["ResultCode"] == 1032
    assert len(calls) == 3
    assert sleeps == [1.0, 2.0]


def test_deferred_mpesa_verification_moves_request_to_review(
    monkeypatch,
):
    attempt = SimpleNamespace(
        id="attempt-1",
        payment_request_id="payment-1",
        status="processing",
        verification_status="unverified",
        error_code=None,
        error_message=None,
    )

    payment_request = SimpleNamespace(
        id="payment-1",
        status="processing",
    )

    event = SimpleNamespace(
        id="event-1",
        payment_attempt_id="attempt-1",
        notes="Request Cancelled by user.",
    )

    recorded_events = []

    monkeypatch.setattr(
        mpesa,
        "create_payment_request_event",
        lambda _db, **kwargs: recorded_events.append(
            kwargs
        ),
    )

    class DB:
        def get(self, _model, object_id):
            if object_id == "attempt-1":
                return attempt
            if object_id == "payment-1":
                return payment_request
            return None

        def add(self, _obj):
            pass

        def commit(self):
            pass

        def refresh(self, _obj):
            pass

    result = mpesa.mark_mpesa_verification_deferred(
        DB(),
        event=event,
        error_code="stk_query_rejected",
        error_message=(
            "M-Pesa rejected the STK status query."
        ),
    )

    assert result is event
    assert attempt.status == "needs_review"
    assert attempt.verification_status == "unverified"
    assert attempt.error_code == "stk_query_rejected"
    assert (
        attempt.error_message
        == "M-Pesa rejected the STK status query."
    )

    assert payment_request.status == "needs_review"

    assert len(recorded_events) == 1
    assert (
        recorded_events[0]["event_type"]
        == "payment_request.needs_review"
    )
    assert (
        recorded_events[0]["from_status"]
        == "processing"
    )
    assert (
        recorded_events[0]["to_status"]
        == "needs_review"
    )

    assert (
        "Automatic Daraja verification was deferred"
        in event.notes
    )

