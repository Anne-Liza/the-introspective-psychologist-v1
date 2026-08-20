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
