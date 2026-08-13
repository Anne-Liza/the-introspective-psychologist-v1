from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.time import utc_now
from app.modules.payment_requests.models import (
    PaymentRequest,
)
from app.modules.receipts.models import (
    ReceiptEvent,
    ReceiptRecord,
)
from app.modules.receipts.schemas import (
    ReceiptCreateFromPaymentRequest,
    ReceiptUpdate,
)


VALID_RECEIPT_TARGET_TYPES = {
    "commerce_order",
    "booking_hold",
}


def generate_receipt_number() -> str:
    return f"RCT-{uuid4().hex[:10].upper()}"


def attach_events(
    receipt: ReceiptRecord,
    events: list[ReceiptEvent],
) -> ReceiptRecord:
    setattr(receipt, "events", events)
    return receipt


def get_receipt_events(
    db: Session,
    receipt_id: str,
) -> list[ReceiptEvent]:
    return db.scalars(
        select(ReceiptEvent)
        .where(
            ReceiptEvent.receipt_id
            == receipt_id
        )
        .order_by(ReceiptEvent.created_at)
    ).all()


def get_receipt_with_events(
    db: Session,
    receipt_id: str,
) -> tuple[
    ReceiptRecord | None,
    list[ReceiptEvent],
]:
    receipt = db.scalar(
        select(ReceiptRecord).where(
            ReceiptRecord.id == receipt_id
        )
    )

    if receipt is None:
        return None, []

    events = get_receipt_events(
        db,
        receipt.id,
    )
    return attach_events(receipt, events), events


def get_existing_receipt_for_payment_request(
    db: Session,
    payment_request_id: str,
) -> ReceiptRecord | None:
    return db.scalar(
        select(ReceiptRecord).where(
            ReceiptRecord.payment_request_id
            == payment_request_id
        )
    )


def list_receipts(
    db: Session,
) -> list[ReceiptRecord]:
    receipts = db.scalars(
        select(ReceiptRecord).order_by(
            ReceiptRecord.created_at.desc()
        )
    ).all()

    for receipt in receipts:
        attach_events(
            receipt,
            get_receipt_events(
                db,
                receipt.id,
            ),
        )

    return receipts


def create_receipt_event(
    db: Session,
    *,
    receipt: ReceiptRecord,
    event_type: str,
    from_status: str | None = None,
    to_status: str | None = None,
    actor_user_id: str | None = None,
    notes: str | None = None,
) -> ReceiptEvent:
    event = ReceiptEvent(
        receipt_id=receipt.id,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        actor_user_id=actor_user_id,
        notes=notes,
    )
    db.add(event)
    return event


def load_paid_payment_request(
    db: Session,
    payment_request_id: str,
) -> PaymentRequest:
    payment_request = db.scalar(
        select(PaymentRequest).where(
            PaymentRequest.id
            == payment_request_id
        )
    )

    if payment_request is None:
        raise LookupError(
            "Payment request not found."
        )

    if payment_request.status != "paid":
        raise ValueError(
            "Receipt can only be generated from "
            "a paid payment request."
        )

    return payment_request


def validate_receipt_target(
    payment_request: PaymentRequest,
    *,
    appointment_id: str | None,
) -> None:
    if (
        payment_request.target_type
        not in VALID_RECEIPT_TARGET_TYPES
    ):
        raise ValueError(
            "Payment request target is not "
            "supported by receipts."
        )

    if (
        payment_request.target_type
        == "commerce_order"
    ):
        if (
            payment_request.commerce_order_id
            is None
            or payment_request.target_id
            != payment_request.commerce_order_id
        ):
            raise ValueError(
                "Commerce payment request has an "
                "invalid target."
            )

        if appointment_id is not None:
            raise ValueError(
                "Commerce receipts cannot be linked "
                "to appointments."
            )

    if (
        payment_request.target_type
        == "booking_hold"
        and payment_request.commerce_order_id
        is not None
    ):
        raise ValueError(
            "Booking payment request has an "
            "invalid commerce-order target."
        )


def attach_appointment_to_receipt(
    db: Session,
    *,
    receipt: ReceiptRecord,
    appointment_id: str | None,
    actor_user_id: str | None = None,
) -> ReceiptRecord:
    if appointment_id is None:
        return attach_events(
            receipt,
            get_receipt_events(
                db,
                receipt.id,
            ),
        )

    if receipt.target_type != "booking_hold":
        raise ValueError(
            "Only booking receipts can be linked "
            "to appointments."
        )

    if receipt.appointment_id is not None:
        if (
            receipt.appointment_id
            != appointment_id
        ):
            raise ValueError(
                "Receipt is already linked to a "
                "different appointment."
            )

        return attach_events(
            receipt,
            get_receipt_events(
                db,
                receipt.id,
            ),
        )

    receipt.appointment_id = appointment_id

    create_receipt_event(
        db,
        receipt=receipt,
        event_type="receipt.target_resolved",
        from_status=receipt.status,
        to_status=receipt.status,
        actor_user_id=actor_user_id,
        notes=(
            "Booking receipt linked to "
            f"appointment {appointment_id}."
        ),
    )

    db.add(receipt)
    db.commit()
    db.refresh(receipt)

    return attach_events(
        receipt,
        get_receipt_events(
            db,
            receipt.id,
        ),
    )


def issue_receipt_for_paid_payment_request(
    db: Session,
    *,
    payment_request_id: str,
    appointment_id: str | None = None,
    notes: str | None = None,
    created_by_user_id: str | None = None,
) -> ReceiptRecord:
    existing = (
        get_existing_receipt_for_payment_request(
            db,
            payment_request_id,
        )
    )

    if existing is not None:
        return attach_appointment_to_receipt(
            db,
            receipt=existing,
            appointment_id=appointment_id,
            actor_user_id=created_by_user_id,
        )

    payment_request = load_paid_payment_request(
        db,
        payment_request_id,
    )

    validate_receipt_target(
        payment_request,
        appointment_id=appointment_id,
    )

    receipt = ReceiptRecord(
        receipt_number=generate_receipt_number(),
        payment_request_id=payment_request.id,
        payment_reference=(
            payment_request.request_number
        ),
        target_type=payment_request.target_type,
        target_id=payment_request.target_id,
        commerce_order_id=(
            payment_request.commerce_order_id
        ),
        appointment_id=appointment_id,
        customer_name=(
            payment_request.customer_name
        ),
        customer_email=(
            payment_request.customer_email
        ),
        customer_phone=(
            payment_request.customer_phone
        ),
        amount=payment_request.amount,
        currency=payment_request.currency,
        provider=payment_request.provider,
        provider_reference=(
            payment_request.provider_reference
        ),
        provider_transaction_reference=(
            payment_request
            .provider_transaction_reference
        ),
        status="issued",
        notes=notes,
        issued_at=(
            payment_request.paid_at
            or utc_now()
        ),
        voided_at=None,
        created_by_user_id=(
            created_by_user_id
        ),
    )

    try:
        db.add(receipt)
        db.flush()

        create_receipt_event(
            db,
            receipt=receipt,
            event_type="receipt.issued",
            from_status=None,
            to_status="issued",
            actor_user_id=created_by_user_id,
            notes=(
                notes
                or (
                    "Receipt generated from paid "
                    "payment request."
                )
            ),
        )

        db.add(receipt)
        db.commit()
    except IntegrityError:
        db.rollback()

        existing = (
            get_existing_receipt_for_payment_request(
                db,
                payment_request_id,
            )
        )

        if existing is None:
            raise

        return attach_appointment_to_receipt(
            db,
            receipt=existing,
            appointment_id=appointment_id,
            actor_user_id=created_by_user_id,
        )

    db.refresh(receipt)

    return attach_events(
        receipt,
        get_receipt_events(
            db,
            receipt.id,
        ),
    )


def create_receipt_from_payment_request(
    db: Session,
    *,
    payload: ReceiptCreateFromPaymentRequest,
    created_by_user_id: str | None = None,
) -> ReceiptRecord:
    return issue_receipt_for_paid_payment_request(
        db,
        payment_request_id=(
            payload.payment_request_id
        ),
        notes=payload.notes,
        created_by_user_id=(
            created_by_user_id
        ),
    )


def update_receipt_from_payload(
    db: Session,
    receipt: ReceiptRecord,
    payload: ReceiptUpdate,
    *,
    actor_user_id: str | None = None,
) -> ReceiptRecord:
    update_data = payload.model_dump(
        exclude_unset=True
    )
    next_status = update_data.pop(
        "status",
        None,
    )
    event_notes = update_data.pop(
        "event_notes",
        None,
    )

    previous_status = receipt.status

    if "notes" in update_data:
        receipt.notes = update_data["notes"]

    if (
        next_status is not None
        and next_status != previous_status
    ):
        if previous_status == "voided":
            raise ValueError(
                "Voided receipts cannot be "
                "changed."
            )

        if next_status != "voided":
            raise ValueError(
                "Issued receipts can only be "
                "moved to voided."
            )

        receipt.status = "voided"
        receipt.voided_at = utc_now()

        create_receipt_event(
            db,
            receipt=receipt,
            event_type=(
                "receipt.status_changed"
            ),
            from_status=previous_status,
            to_status="voided",
            actor_user_id=actor_user_id,
            notes=(
                event_notes
                or (
                    "Receipt voided from admin "
                    "dashboard."
                )
            ),
        )

    db.add(receipt)
    db.commit()
    db.refresh(receipt)

    return attach_events(
        receipt,
        get_receipt_events(
            db,
            receipt.id,
        ),
    )
