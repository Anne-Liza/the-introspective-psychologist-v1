from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.time import utc_now
from app.modules.commerce_core.models import CommerceOrder
from app.modules.fulfillment.models import FulfillmentEvent, FulfillmentRecord
from app.modules.fulfillment.schemas import FulfillmentCreateFromReceipt, FulfillmentUpdate
from app.modules.receipts.models import ReceiptRecord

ALLOWED_STATUS_TRANSITIONS = {
    "pending": {"in_progress", "fulfilled", "cancelled"},
    "in_progress": {"fulfilled", "cancelled"},
    "fulfilled": set(),
    "cancelled": set(),
}

ORDER_FULFILLMENT_STATUS_BY_FULFILLMENT_STATUS = {
    "pending": "unfulfilled",
    "in_progress": "partial",
    "fulfilled": "fulfilled",
    "cancelled": "cancelled",
}


def generate_fulfillment_number() -> str:
    return f"FUL-{uuid4().hex[:10].upper()}"


def attach_events(record: FulfillmentRecord, events: list[FulfillmentEvent]) -> FulfillmentRecord:
    setattr(record, "events", events)
    return record


def get_fulfillment_events(db: Session, fulfillment_id: str) -> list[FulfillmentEvent]:
    return db.scalars(
        select(FulfillmentEvent)
        .where(FulfillmentEvent.fulfillment_id == fulfillment_id)
        .order_by(FulfillmentEvent.created_at)
    ).all()


def get_fulfillment_with_events(
    db: Session,
    fulfillment_id: str,
) -> tuple[FulfillmentRecord | None, list[FulfillmentEvent]]:
    record = db.scalar(select(FulfillmentRecord).where(FulfillmentRecord.id == fulfillment_id))
    if record is None:
        return None, []
    events = get_fulfillment_events(db, record.id)
    return attach_events(record, events), events


def list_fulfillment_records(db: Session) -> list[FulfillmentRecord]:
    records = db.scalars(select(FulfillmentRecord).order_by(FulfillmentRecord.created_at.desc())).all()
    for record in records:
        attach_events(record, get_fulfillment_events(db, record.id))
    return records


def get_existing_fulfillment_for_receipt(db: Session, receipt_id: str) -> FulfillmentRecord | None:
    return db.scalar(select(FulfillmentRecord).where(FulfillmentRecord.receipt_id == receipt_id))


def get_existing_fulfillment_for_order(db: Session, commerce_order_id: str) -> FulfillmentRecord | None:
    return db.scalar(select(FulfillmentRecord).where(FulfillmentRecord.commerce_order_id == commerce_order_id))


def create_fulfillment_event(
    db: Session,
    *,
    record: FulfillmentRecord,
    event_type: str,
    from_status: str | None = None,
    to_status: str | None = None,
    actor_user_id: str | None = None,
    notes: str | None = None,
) -> FulfillmentEvent:
    event = FulfillmentEvent(
        fulfillment_id=record.id,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        actor_user_id=actor_user_id,
        notes=notes,
    )
    db.add(event)
    return event


def load_issued_receipt(db: Session, receipt_id: str) -> ReceiptRecord:
    receipt = db.scalar(select(ReceiptRecord).where(ReceiptRecord.id == receipt_id))
    if receipt is None:
        raise LookupError("Receipt not found.")

    if receipt.status != "issued":
        raise ValueError(
            "Fulfillment can only be created "
            "from issued receipts."
        )

    if (
        receipt.target_type
        != "commerce_order"
        or receipt.commerce_order_id is None
    ):
        raise ValueError(
            "Fulfillment can only be created "
            "from commerce-order receipts."
        )

    return receipt


def load_commerce_order(db: Session, commerce_order_id: str) -> CommerceOrder:
    order = db.scalar(select(CommerceOrder).where(CommerceOrder.id == commerce_order_id))
    if order is None:
        raise LookupError("Commerce order not found.")
    return order


def assert_order_paid_for_fulfillment(
    order: CommerceOrder,
) -> None:
    if order.status != "paid":
        raise ValueError(
            "Commerce order must be paid before "
            "fulfillment can begin."
        )


def sync_order_fulfillment_status(
    db: Session,
    *,
    commerce_order_id: str,
    fulfillment_status: str,
) -> None:
    order = load_commerce_order(db, commerce_order_id)
    order.fulfillment_status = ORDER_FULFILLMENT_STATUS_BY_FULFILLMENT_STATUS[fulfillment_status]
    db.add(order)


def assert_status_transition_allowed(current_status: str, next_status: str) -> None:
    if current_status == next_status:
        return

    allowed = ALLOWED_STATUS_TRANSITIONS.get(current_status, set())
    if next_status not in allowed:
        raise ValueError(f"Cannot move fulfillment from {current_status} to {next_status}.")


def create_fulfillment_from_receipt(
    db: Session,
    *,
    payload: FulfillmentCreateFromReceipt,
    created_by_user_id: str | None = None,
) -> FulfillmentRecord:
    existing_for_receipt = get_existing_fulfillment_for_receipt(db, payload.receipt_id)
    if existing_for_receipt is not None:
        return attach_events(existing_for_receipt, get_fulfillment_events(db, existing_for_receipt.id))

    receipt = load_issued_receipt(
        db,
        payload.receipt_id,
    )
    order = load_commerce_order(
        db,
        receipt.commerce_order_id,
    )

    assert_order_paid_for_fulfillment(order)

    existing_for_order = get_existing_fulfillment_for_order(
        db,
        receipt.commerce_order_id,
    )
    if existing_for_order is not None:
        raise ValueError("A fulfillment record already exists for this commerce order.")

    record = FulfillmentRecord(
        fulfillment_number=generate_fulfillment_number(),
        receipt_id=receipt.id,
        payment_request_id=receipt.payment_request_id,
        commerce_order_id=receipt.commerce_order_id,
        order_number=order.order_number,
        customer_name=receipt.customer_name,
        customer_email=receipt.customer_email,
        customer_phone=receipt.customer_phone,
        fulfillment_type=payload.fulfillment_type,
        status="pending",
        notes=payload.notes,
        started_at=None,
        fulfilled_at=None,
        cancelled_at=None,
        created_by_user_id=created_by_user_id,
    )
    db.add(record)
    db.flush()

    sync_order_fulfillment_status(db, commerce_order_id=record.commerce_order_id, fulfillment_status=record.status)

    create_fulfillment_event(
        db,
        record=record,
        event_type="fulfillment.created",
        from_status=None,
        to_status="pending",
        actor_user_id=created_by_user_id,
        notes=payload.notes or "Fulfillment created from issued receipt.",
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    return attach_events(record, get_fulfillment_events(db, record.id))


def update_fulfillment_from_payload(
    db: Session,
    record: FulfillmentRecord,
    payload: FulfillmentUpdate,
    *,
    actor_user_id: str | None = None,
) -> FulfillmentRecord:
    update_data = payload.model_dump(exclude_unset=True)
    next_status = update_data.pop("status", None)
    event_notes = update_data.pop("event_notes", None)

    previous_status = record.status

    if "notes" in update_data:
        record.notes = update_data["notes"]

    if "fulfillment_type" in update_data:
        if previous_status in {"fulfilled", "cancelled"}:
            raise ValueError("Fulfilled or cancelled fulfillment records cannot change type.")
        record.fulfillment_type = update_data["fulfillment_type"]

    if next_status is not None and next_status != previous_status:
        assert_status_transition_allowed(
            previous_status,
            next_status,
        )

        if next_status in {
            "in_progress",
            "fulfilled",
        }:
            order = load_commerce_order(
                db,
                record.commerce_order_id,
            )
            assert_order_paid_for_fulfillment(
                order
            )

        record.status = next_status

        if next_status == "in_progress" and record.started_at is None:
            record.started_at = utc_now()
        if next_status == "fulfilled":
            record.fulfilled_at = utc_now()
        if next_status == "cancelled":
            record.cancelled_at = utc_now()

        sync_order_fulfillment_status(
            db,
            commerce_order_id=record.commerce_order_id,
            fulfillment_status=next_status,
        )

        create_fulfillment_event(
            db,
            record=record,
            event_type="fulfillment.status_changed",
            from_status=previous_status,
            to_status=next_status,
            actor_user_id=actor_user_id,
            notes=event_notes or f"Fulfillment moved to {next_status}.",
        )

    db.add(record)
    db.commit()
    db.refresh(record)

    return attach_events(record, get_fulfillment_events(db, record.id))
