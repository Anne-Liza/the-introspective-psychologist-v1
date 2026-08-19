from decimal import Decimal
from types import SimpleNamespace

from app.modules.commerce_core.models import CommerceOrder
from app.modules.commerce_core.service import settle_paid_commerce_payment_request
from app.modules.mpesa_payments import service as mpesa
from app.modules.payment_requests.models import PaymentRequest
from app.modules.payment_requests.schemas import PublicPaymentRequestFromOrderCreate


def test_public_checkout_accepts_mpesa():
    payload = PublicPaymentRequestFromOrderCreate(
        commerce_order_id="order-1",
        customer_email="client@example.com",
        provider="mpesa",
    )
    assert payload.provider == "mpesa"


def test_paid_mpesa_settles_commerce_order():
    request = SimpleNamespace(
        target_type="commerce_order",
        target_id="order-1",
        commerce_order_id="order-1",
        status="paid",
        amount=Decimal("1500"),
        currency="KES",
    )
    order = SimpleNamespace(
        id="order-1",
        status="pending_payment",
        total_amount=Decimal("1500"),
        currency="KES",
    )

    class DB:
        def get(self, model, _id):
            return request if model is PaymentRequest else order
        def add(self, _obj): pass
        def commit(self): pass
        def refresh(self, _obj): pass

    settle_paid_commerce_payment_request(
        DB(),
        payment_request_id="payment-1",
    )

    assert order.status == "paid"


def test_public_stk_accepts_commerce_order(monkeypatch):
    request = SimpleNamespace(
        id="payment-1",
        request_number="PAY-TEST",
        target_type="commerce_order",
        provider="mpesa",
        amount=Decimal("1500"),
        currency="KES",
        expires_at=None,
        status="pending",
        description="Store order",
    )
    attempt = SimpleNamespace(id="attempt-1")

    class DB:
        def get(self, model, _id):
            return request if model is PaymentRequest else None
        def scalar(self, _query):
            return None

    monkeypatch.setattr(
        mpesa,
        "prepare_stk_push_attempt",
        lambda *args, **kwargs: attempt,
    )

    result = mpesa.prepare_public_stk_push_attempt(
        DB(),
        payment_request_id="payment-1",
        phone_number="0712345678",
        config=SimpleNamespace(),
    )

    assert result is attempt
