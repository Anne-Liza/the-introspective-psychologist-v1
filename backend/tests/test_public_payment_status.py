from decimal import Decimal
from types import SimpleNamespace

from app.modules.payment_requests import routes
from app.modules.payment_requests import service


def test_public_payment_status_returns_safe_confirmation(monkeypatch):
    payment = SimpleNamespace(
        id="payment-1",
        request_number="PAY-TEST",
        status="paid",
        amount=Decimal("1.00"),
        currency="KES",
        provider="mpesa",
        provider_transaction_reference="MPESA123",
    )
    receipt = SimpleNamespace(
        receipt_number="REC-TEST",
        status="issued",
    )

    class DB:
        def __init__(self):
            self.values = iter([
                payment,
                receipt,
                None,
            ])

        def scalar(self, _query):
            return next(self.values)

    monkeypatch.setattr(
        routes,
        "expire_stale_payment_requests",
        lambda _db: 0,
    )
    monkeypatch.setattr(
        routes,
        "enforce_public_action_rate_limit",
        lambda *args, **kwargs: None,
    )

    result = routes.get_public_payment_status(
        "payment-1",
        request=SimpleNamespace(),
        db=DB(),
    )

    assert result.status == "paid"
    assert result.receipt_number == "REC-TEST"
    assert result.provider_transaction_reference == "MPESA123"

    assert set(result.model_dump()) == {
        "payment_request_id",
        "request_number",
        "status",
        "amount",
        "currency",
        "provider",
        "provider_transaction_reference",
        "customer_state",
        "provider_outcome",
        "confirmation_pending",
        "receipt_number",
        "receipt_status",
    }


def test_cancelled_callback_gives_immediate_feedback():
    state, pending = (
        service.derive_public_payment_state(
            request_status="processing",
            provider_outcome="cancelled",
            reconciliation_status="retrying",
        )
    )

    assert state == "cancelled"
    assert pending is True


def test_success_callback_waits_for_verification():
    state, pending = (
        service.derive_public_payment_state(
            request_status="processing",
            provider_outcome="succeeded",
            reconciliation_status="pending",
        )
    )

    assert state == "confirming"
    assert pending is True


def test_needs_review_is_not_confirmed():
    state, pending = (
        service.derive_public_payment_state(
            request_status="needs_review",
            provider_outcome="cancelled",
            reconciliation_status="exhausted",
        )
    )

    assert state == "not_confirmed"
    assert pending is False
