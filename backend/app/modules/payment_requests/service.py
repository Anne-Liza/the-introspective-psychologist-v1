from datetime import timedelta
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.time import utc_now
from app.modules.commerce_core.models import CommerceOrder
from app.modules.payment_requests.models import PaymentRequest, PaymentRequestEvent
from app.modules.payment_requests.schemas import PaymentRequestCreate, PaymentRequestFromOrderCreate, PaymentRequestUpdate

ACTIVE_PAYMENT_REQUEST_STATUSES = {"pending", "processing", "needs_review"}

PUBLIC_PAYMENT_ACTIVE_RECONCILIATION_STATUSES = {
    "pending",
    "retrying",
}


def derive_public_payment_state(
    *,
    request_status: str,
    provider_outcome: str | None = None,
    reconciliation_status: str | None = None,
) -> tuple[str, bool]:
    if request_status == "paid":
        return "paid", False

    if request_status == "needs_review":
        return "not_confirmed", False

    if request_status == "cancelled":
        return "cancelled", False

    if request_status in {"failed", "expired"}:
        return "failed", False

    reconciliation_active = (
        reconciliation_status
        in PUBLIC_PAYMENT_ACTIVE_RECONCILIATION_STATUSES
    )

    if provider_outcome == "cancelled":
        return (
            "cancelled",
            reconciliation_active,
        )

    if provider_outcome == "failed":
        return (
            "failed",
            reconciliation_active,
        )

    if provider_outcome == "succeeded":
        return "confirming", True

    if request_status == "processing":
        return "waiting", True

    return "waiting", False


ALLOWED_STATUS_TRANSITIONS = {
    "pending": {"processing", "paid", "failed", "expired", "cancelled", "needs_review"},
    "processing": {"paid", "failed", "cancelled", "needs_review"},
    "failed": {"pending", "cancelled", "needs_review"},
    "needs_review": {"paid", "failed", "cancelled"},
    "paid": set(),
    "expired": set(),
    "cancelled": set(),
}


def generate_payment_request_number() -> str:
    return f"PAY-{uuid4().hex[:10].upper()}"


def attach_events(payment_request: PaymentRequest, events: list[PaymentRequestEvent]) -> PaymentRequest:
    setattr(payment_request, "events", events)
    return payment_request


def get_payment_request_events(db: Session, payment_request_id: str) -> list[PaymentRequestEvent]:
    return db.scalars(
        select(PaymentRequestEvent)
        .where(PaymentRequestEvent.payment_request_id == payment_request_id)
        .order_by(PaymentRequestEvent.created_at)
    ).all()


def get_payment_request_with_events(
    db: Session,
    payment_request_id: str,
) -> tuple[PaymentRequest | None, list[PaymentRequestEvent]]:
    payment_request = db.scalar(select(PaymentRequest).where(PaymentRequest.id == payment_request_id))
    if payment_request is None:
        return None, []
    return payment_request, get_payment_request_events(db, payment_request.id)


def create_payment_request_event(
    db: Session,
    *,
    payment_request: PaymentRequest,
    event_type: str,
    from_status: str | None = None,
    to_status: str | None = None,
    actor_user_id: str | None = None,
    notes: str | None = None,
) -> PaymentRequestEvent:
    event = PaymentRequestEvent(
        payment_request_id=payment_request.id,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        provider=payment_request.provider,
        provider_reference=(
            payment_request.provider_reference
        ),
        provider_transaction_reference=(
            payment_request
            .provider_transaction_reference
        ),
        amount=payment_request.amount,
        currency=payment_request.currency,
        actor_user_id=actor_user_id,
        notes=notes,
    )
    db.add(event)
    return event


def assert_status_transition_allowed(current_status: str, next_status: str) -> None:
    if current_status == next_status:
        return

    allowed_targets = ALLOWED_STATUS_TRANSITIONS.get(current_status, set())
    if next_status not in allowed_targets:
        raise ValueError(f"Cannot move payment request from {current_status} to {next_status}.")


def expire_stale_payment_requests(db: Session) -> int:
    now = utc_now()
    stale_requests = db.scalars(
        select(PaymentRequest).where(
            PaymentRequest.status.in_(["pending", "processing"]),
            PaymentRequest.expires_at.is_not(None),
            PaymentRequest.expires_at < now,
        )
    ).all()

    expired_count = 0
    for payment_request in stale_requests:
        previous_status = payment_request.status
        payment_request.status = "expired"
        create_payment_request_event(
            db,
            payment_request=payment_request,
            event_type="payment_request.expired",
            from_status=previous_status,
            to_status="expired",
            notes="Payment request expired automatically during request-time cleanup.",
        )
        db.add(payment_request)
        expired_count += 1

    if expired_count:
        db.commit()

    return expired_count


def assert_no_active_payment_request_for_order(db: Session, commerce_order_id: str) -> None:
    existing = db.scalar(
        select(PaymentRequest).where(
            PaymentRequest.commerce_order_id == commerce_order_id,
            PaymentRequest.status.in_(ACTIVE_PAYMENT_REQUEST_STATUSES),
        )
    )
    if existing is not None:
        raise ValueError("An active payment request already exists for this order.")


def load_order_for_payment_request(
    db: Session,
    commerce_order_id: str,
    *,
    expected_customer_email: str | None = None,
) -> CommerceOrder:
    order = db.scalar(select(CommerceOrder).where(CommerceOrder.id == commerce_order_id))
    if order is None:
        raise LookupError("Commerce order not found.")

    if expected_customer_email is not None and order.customer_email.lower() != expected_customer_email.lower():
        raise LookupError("Commerce order not found.")

    if order.total_amount <= 0:
        raise ValueError("Commerce order total must be greater than zero.")

    return order


def create_payment_request_from_order(
    db: Session,
    *,
    payload: PaymentRequestCreate | PaymentRequestFromOrderCreate,
    created_by_user_id: str | None = None,
    expected_customer_email: str | None = None,
) -> PaymentRequest:
    expire_stale_payment_requests(db)

    order = load_order_for_payment_request(
        db,
        payload.commerce_order_id,
        expected_customer_email=expected_customer_email,
    )
    assert_no_active_payment_request_for_order(db, order.id)

    payment_request = PaymentRequest(
        request_number=generate_payment_request_number(),
        commerce_order_id=order.id,
        target_type="commerce_order",
        target_id=order.id,
        customer_name=order.customer_name,
        customer_email=order.customer_email,
        customer_phone=order.customer_phone,
        amount=order.total_amount,
        currency=order.currency,
        provider=payload.provider,
        provider_reference=None,
        settlement_account_label=payload.settlement_account_label,
        status="pending",
        description=payload.description,
        admin_notes=None,
        expires_at=utc_now() + timedelta(minutes=payload.expires_in_minutes),
        paid_at=None,
        cancelled_at=None,
        created_by_user_id=created_by_user_id,
    )
    db.add(payment_request)
    db.flush()

    create_payment_request_event(
        db,
        payment_request=payment_request,
        event_type="payment_request.created",
        from_status=None,
        to_status="pending",
        actor_user_id=created_by_user_id,
        notes="Payment request created from commerce order.",
    )

    db.add(payment_request)
    db.commit()
    db.refresh(payment_request)

    return attach_events(payment_request, get_payment_request_events(db, payment_request.id))


def update_payment_request_from_payload(
    db: Session,
    payment_request: PaymentRequest,
    payload: PaymentRequestUpdate,
    *,
    actor_user_id: str | None = None,
) -> PaymentRequest:
    update_data = payload.model_dump(exclude_unset=True)
    next_status = update_data.pop("status", None)
    event_notes = update_data.pop("event_notes", None)

    previous_status = payment_request.status

    for key, value in update_data.items():
        setattr(payment_request, key, value)

    if next_status is not None and next_status != previous_status:
        assert_status_transition_allowed(previous_status, next_status)
        payment_request.status = next_status

        if next_status == "paid":
            payment_request.paid_at = utc_now()
        if next_status == "cancelled":
            payment_request.cancelled_at = utc_now()

        create_payment_request_event(
            db,
            payment_request=payment_request,
            event_type="payment_request.status_changed",
            from_status=previous_status,
            to_status=next_status,
            actor_user_id=actor_user_id,
            notes=event_notes,
        )

    db.add(payment_request)
    db.commit()
    db.refresh(payment_request)

    return attach_events(payment_request, get_payment_request_events(db, payment_request.id))
