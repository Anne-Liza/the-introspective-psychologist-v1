from types import SimpleNamespace

import pytest

from app.modules.fulfillment import service
from app.modules.fulfillment.schemas import (
    FulfillmentCreateFromReceipt,
    FulfillmentUpdate,
)


def make_record():
    return SimpleNamespace(
        id="fulfillment-1",
        commerce_order_id="order-1",
        status="pending",
        fulfillment_type="physical",
        notes=None,
        started_at=None,
        fulfilled_at=None,
        cancelled_at=None,
    )


def test_unpaid_order_cannot_create_fulfillment(
    monkeypatch,
):
    receipt = SimpleNamespace(
        id="receipt-1",
        commerce_order_id="order-1",
    )
    order = SimpleNamespace(
        id="order-1",
        status="pending_payment",
    )

    monkeypatch.setattr(
        service,
        "get_existing_fulfillment_for_receipt",
        lambda *_args, **_kwargs: None,
    )
    monkeypatch.setattr(
        service,
        "load_issued_receipt",
        lambda *_args, **_kwargs: receipt,
    )
    monkeypatch.setattr(
        service,
        "load_commerce_order",
        lambda *_args, **_kwargs: order,
    )

    payload = FulfillmentCreateFromReceipt(
        receipt_id="receipt-1",
        fulfillment_type="physical",
    )

    with pytest.raises(
        ValueError,
        match="must be paid",
    ):
        service.create_fulfillment_from_receipt(
            SimpleNamespace(),
            payload=payload,
        )


def test_unpaid_order_cannot_start_fulfillment(
    monkeypatch,
):
    record = make_record()
    order = SimpleNamespace(
        id="order-1",
        status="pending_payment",
    )

    monkeypatch.setattr(
        service,
        "load_commerce_order",
        lambda *_args, **_kwargs: order,
    )

    with pytest.raises(
        ValueError,
        match="must be paid",
    ):
        service.update_fulfillment_from_payload(
            SimpleNamespace(),
            record,
            FulfillmentUpdate(
                status="in_progress",
            ),
        )

    assert record.status == "pending"
    assert record.started_at is None


def test_unpaid_order_cannot_be_fulfilled(
    monkeypatch,
):
    record = make_record()
    order = SimpleNamespace(
        id="order-1",
        status="pending_payment",
    )

    monkeypatch.setattr(
        service,
        "load_commerce_order",
        lambda *_args, **_kwargs: order,
    )

    with pytest.raises(
        ValueError,
        match="must be paid",
    ):
        service.update_fulfillment_from_payload(
            SimpleNamespace(),
            record,
            FulfillmentUpdate(
                status="fulfilled",
            ),
        )

    assert record.status == "pending"
    assert record.fulfilled_at is None


def test_paid_order_can_start_fulfillment(
    monkeypatch,
):
    record = make_record()
    order = SimpleNamespace(
        id="order-1",
        status="paid",
    )

    class DB:
        def add(self, _instance):
            pass

        def commit(self):
            pass

        def refresh(self, _instance):
            pass

    monkeypatch.setattr(
        service,
        "load_commerce_order",
        lambda *_args, **_kwargs: order,
    )
    monkeypatch.setattr(
        service,
        "sync_order_fulfillment_status",
        lambda *_args, **_kwargs: None,
    )
    monkeypatch.setattr(
        service,
        "create_fulfillment_event",
        lambda *_args, **_kwargs: None,
    )
    monkeypatch.setattr(
        service,
        "get_fulfillment_events",
        lambda *_args, **_kwargs: [],
    )

    result = (
        service.update_fulfillment_from_payload(
            DB(),
            record,
            FulfillmentUpdate(
                status="in_progress",
            ),
        )
    )

    assert result.status == "in_progress"
    assert result.started_at is not None
