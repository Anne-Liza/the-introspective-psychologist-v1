from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace

from app.modules.receipts import routes


def test_public_receipt_returns_safe_order_details(
    monkeypatch,
):
    receipt = SimpleNamespace(
        receipt_number="RCT-TEST",
        status="issued",
        issued_at=datetime(2026, 8, 20, 12, 0, 0),
        amount=Decimal("1500.00"),
        currency="KES",
        provider="mpesa",
        provider_transaction_reference="MPESA123",
        commerce_order_id="order-1",
        customer_name="Test Customer",
    )

    order = SimpleNamespace(
        id="order-1",
        order_number="ORD-TEST",
        created_at=datetime(2026, 8, 20, 11, 55, 0),
    )

    items = [
        SimpleNamespace(
            item_name="Wellness Journal",
            quantity=2,
            unit_amount=Decimal("750.00"),
            line_total_amount=Decimal("1500.00"),
            currency="KES",
            sort_order=0,
            created_at=datetime(2026, 8, 20, 11, 55, 0),
        )
    ]

    class ScalarResult:
        def all(self):
            return items

    class DB:
        def __init__(self):
            self.scalar_values = iter([receipt, order])

        def scalar(self, _query):
            return next(self.scalar_values)

        def scalars(self, _query):
            return ScalarResult()

    monkeypatch.setattr(
        routes,
        "enforce_public_action_rate_limit",
        lambda *args, **kwargs: None,
    )

    result = routes.get_public_receipt(
        "payment-1",
        request=SimpleNamespace(),
        db=DB(),
    )

    assert result.receipt_number == "RCT-TEST"
    assert result.order_number == "ORD-TEST"
    assert result.amount == Decimal("1500.00")
    assert len(result.items) == 1
    assert result.items[0].item_name == "Wellness Journal"

    assert set(result.model_dump()) == {
        "receipt_number",
        "status",
        "issued_at",
        "amount",
        "currency",
        "provider",
        "provider_transaction_reference",
        "order_number",
        "order_created_at",
        "customer_name",
        "items",
    }

    public_payload = result.model_dump()

    assert "customer_email" not in public_payload
    assert "customer_phone" not in public_payload
    assert "notes" not in public_payload
    assert "events" not in public_payload
    assert "provider_reference" not in public_payload
