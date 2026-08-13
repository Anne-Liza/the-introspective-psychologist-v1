from __future__ import annotations

from hashlib import sha256
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.payload_safety import serialize_sanitized_payload
from app.core.time import utc_now
from app.modules.payment_attempts.models import PaymentAttempt, PaymentProviderEvent
from app.modules.payment_attempts.schemas import PaymentAttemptCreate, PaymentProviderEventCreate
from app.modules.payment_requests.models import PaymentRequest
from app.modules.payment_requests.schemas import PaymentRequestUpdate
from app.modules.payment_requests.service import update_payment_request_from_payload

REQUEST_STATUSES_ALLOWING_ATTEMPTS = {"pending", "processing", "failed", "needs_review"}
SUCCESS_EVENT_STATUSES = {"succeeded"}
FAILED_EVENT_STATUSES = {"failed", "cancelled"}


def generate_attempt_number() -> str:
    return f"PAT-{uuid4().hex[:10].upper()}"


def attach_provider_events(
    attempt: PaymentAttempt,
    provider_events: list[PaymentProviderEvent],
) -> PaymentAttempt:
    setattr(attempt, "provider_events", provider_events)
    return attempt


def get_attempt_events(db: Session, attempt_id: str) -> list[PaymentProviderEvent]:
    return db.scalars(
        select(PaymentProviderEvent)
        .where(PaymentProviderEvent.payment_attempt_id == attempt_id)
        .order_by(PaymentProviderEvent.created_at)
    ).all()


def get_attempt_with_events(db: Session, attempt_id: str) -> tuple[PaymentAttempt | None, list[PaymentProviderEvent]]:
    attempt = db.scalar(select(PaymentAttempt).where(PaymentAttempt.id == attempt_id))
    if attempt is None:
        return None, []
    return attempt, get_attempt_events(db, attempt.id)


def get_attempt_by_provider_reference(
    db: Session,
    *,
    provider: str,
    provider_reference: str,
) -> PaymentAttempt | None:
    return db.scalar(
        select(PaymentAttempt).where(
            PaymentAttempt.provider == provider,
            PaymentAttempt.provider_reference == provider_reference,
        )
    )


def assert_provider_reference_available(
    db: Session,
    *,
    provider: str,
    provider_reference: str | None,
) -> None:
    if provider_reference is None:
        return

    existing = get_attempt_by_provider_reference(
        db,
        provider=provider,
        provider_reference=provider_reference,
    )
    if existing is not None:
        raise ValueError("provider_reference is already linked to another payment attempt.")


def load_payment_request_for_attempt(db: Session, payment_request_id: str) -> PaymentRequest:
    payment_request = db.scalar(select(PaymentRequest).where(PaymentRequest.id == payment_request_id))
    if payment_request is None:
        raise LookupError("Payment request not found.")

    if payment_request.status not in REQUEST_STATUSES_ALLOWING_ATTEMPTS:
        raise ValueError(f"Cannot create a payment attempt for a {payment_request.status} payment request.")

    if payment_request.amount <= 0:
        raise ValueError("Payment request amount must be greater than zero.")

    return payment_request


def create_payment_attempt_from_request(
    db: Session,
    *,
    payload: PaymentAttemptCreate,
    initiated_by_user_id: str | None = None,
) -> PaymentAttempt:
    if payload.idempotency_key is not None:
        existing = db.scalar(
            select(PaymentAttempt).where(PaymentAttempt.idempotency_key == payload.idempotency_key)
        )
        if existing is not None:
            return attach_provider_events(existing, get_attempt_events(db, existing.id))

    payment_request = load_payment_request_for_attempt(db, payload.payment_request_id)
    provider = payload.provider or payment_request.provider

    assert_provider_reference_available(
        db,
        provider=provider,
        provider_reference=payload.provider_reference,
    )

    attempt = PaymentAttempt(
        attempt_number=generate_attempt_number(),
        payment_request_id=payment_request.id,
        provider=provider,
        provider_reference=payload.provider_reference,
        provider_transaction_reference=(
            payload.provider_transaction_reference
        ),
        provider_session_id=payload.provider_session_id,
        idempotency_key=payload.idempotency_key,
        amount=payment_request.amount,
        currency=payment_request.currency,
        status="created",
        verification_status="unverified",
        checkout_url=payload.checkout_url,
        error_code=None,
        error_message=None,
        initiated_by_user_id=initiated_by_user_id,
        verified_at=None,
    )

    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    return attach_provider_events(attempt, [])


def sanitized_payload_and_hash(payload: PaymentProviderEventCreate) -> tuple[str, str]:
    sanitized = serialize_sanitized_payload(payload.model_dump(mode="json"))
    return sanitized, sha256(sanitized.encode("utf-8")).hexdigest()


def build_event_fingerprint(
    *,
    provider: str,
    provider_reference: str | None,
    external_event_id: str | None,
    event_type: str,
    payload_hash: str,
) -> str:
    stable_event_id = external_event_id or payload_hash
    raw = "|".join([provider, provider_reference or "", stable_event_id, event_type])
    return sha256(raw.encode("utf-8")).hexdigest()


def find_original_event(db: Session, *, provider: str, event_fingerprint: str) -> PaymentProviderEvent | None:
    return db.scalar(
        select(PaymentProviderEvent)
        .where(
            PaymentProviderEvent.provider == provider,
            PaymentProviderEvent.event_fingerprint == event_fingerprint,
            PaymentProviderEvent.is_duplicate.is_(False),
        )
        .order_by(PaymentProviderEvent.created_at)
    )


def resolve_attempt_for_event(db: Session, payload: PaymentProviderEventCreate) -> PaymentAttempt | None:
    if payload.payment_attempt_id is not None:
        attempt = db.scalar(select(PaymentAttempt).where(PaymentAttempt.id == payload.payment_attempt_id))
        if attempt is not None:
            return attempt

    if payload.provider_reference is not None:
        return get_attempt_by_provider_reference(
            db,
            provider=payload.provider,
            provider_reference=payload.provider_reference,
        )

    return None


def amount_and_currency_match(attempt: PaymentAttempt, payload: PaymentProviderEventCreate) -> bool:
    if payload.amount is not None and payload.amount != attempt.amount:
        return False
    if payload.currency is not None and payload.currency != attempt.currency:
        return False
    return True


def update_payment_request_after_verified_event(
    db: Session,
    *,
    attempt: PaymentAttempt,
    next_status: str,
    provider_reference: str | None,
    provider_transaction_reference: str | None,
) -> None:
    payment_request = db.scalar(
        select(PaymentRequest).where(
            PaymentRequest.id
            == attempt.payment_request_id
        )
    )

    if payment_request is None:
        return

    update_payment_request_from_payload(
        db,
        payment_request,
        PaymentRequestUpdate(
            status=next_status,
            provider_reference=provider_reference,
            provider_transaction_reference=(
                provider_transaction_reference
            ),
            event_notes=(
                "Payment request moved to "
                f"{next_status} from verified "
                "provider event."
            ),
        ),
    )


def apply_event_to_attempt_and_request(
    db: Session,
    *,
    attempt: PaymentAttempt | None,
    event: PaymentProviderEvent,
    payload: PaymentProviderEventCreate,
) -> None:
    if attempt is None or event.is_duplicate:
        return

    if event.verification_status == "rejected":
        attempt.status = "needs_review"
        attempt.verification_status = "rejected"
        db.add(attempt)
        return

    if event.verification_status != "verified":
        if attempt.status not in {"succeeded", "failed", "cancelled"}:
            attempt.status = "needs_review"
            attempt.verification_status = event.verification_status
            db.add(attempt)
        return

    attempt.verification_status = "verified"

    if payload.provider_reference is not None:
        attempt.provider_reference = (
            payload.provider_reference
        )

    if (
        payload.provider_transaction_reference
        is not None
    ):
        attempt.provider_transaction_reference = (
            payload.provider_transaction_reference
        )

    if payload.event_status in SUCCESS_EVENT_STATUSES:
        attempt.status = "succeeded"
        attempt.verified_at = utc_now()
        db.add(attempt)

        try:
            update_payment_request_after_verified_event(
                db,
                attempt=attempt,
                next_status="paid",
                provider_reference=(
                    attempt.provider_reference
                ),
                provider_transaction_reference=(
                    attempt
                    .provider_transaction_reference
                ),
            )
        except ValueError:
            attempt.status = "needs_review"
            attempt.error_message = "Payment request could not be moved to paid."
            db.add(attempt)

    elif payload.event_status in FAILED_EVENT_STATUSES:
        attempt.status = "failed"
        db.add(attempt)

        try:
            update_payment_request_after_verified_event(
                db,
                attempt=attempt,
                next_status="failed",
                provider_reference=(
                    attempt.provider_reference
                ),
                provider_transaction_reference=(
                    attempt
                    .provider_transaction_reference
                ),
            )
        except ValueError:
            attempt.status = "needs_review"
            attempt.error_message = "Payment request could not be moved to failed."
            db.add(attempt)

    elif payload.event_status in {"pending", "processing", "received"}:
        attempt.status = "processing"
        db.add(attempt)


def record_provider_event(
    db: Session,
    *,
    payload: PaymentProviderEventCreate,
    force_unverified: bool = False,
) -> PaymentProviderEvent:
    payload_json, payload_hash = sanitized_payload_and_hash(payload)
    event_fingerprint = build_event_fingerprint(
        provider=payload.provider,
        provider_reference=payload.provider_reference,
        external_event_id=payload.external_event_id,
        event_type=payload.event_type,
        payload_hash=payload_hash,
    )

    attempt = resolve_attempt_for_event(db, payload)
    original_event = find_original_event(db, provider=payload.provider, event_fingerprint=event_fingerprint)

    verification_status = "unverified" if force_unverified else payload.verification_status
    is_duplicate = original_event is not None

    if is_duplicate:
        verification_status = "duplicate"

    if attempt is None and verification_status == "verified":
        verification_status = "needs_review"

    if attempt is not None and not amount_and_currency_match(attempt, payload):
        verification_status = "rejected"

    event = PaymentProviderEvent(
        payment_attempt_id=attempt.id if attempt is not None else None,
        payment_request_id=attempt.payment_request_id if attempt is not None else None,
        provider=payload.provider,
        provider_reference=payload.provider_reference,
        provider_transaction_reference=(
            payload.provider_transaction_reference
        ),
        external_event_id=payload.external_event_id,
        event_type=payload.event_type,
        event_status=payload.event_status,
        verification_status=verification_status,
        amount=payload.amount,
        currency=payload.currency,
        event_fingerprint=event_fingerprint,
        payload_hash=payload_hash,
        payload_json=payload_json,
        is_duplicate=is_duplicate,
        original_event_id=original_event.id if original_event is not None else None,
        notes=payload.notes,
        received_at=utc_now(),
        processed_at=utc_now(),
    )

    db.add(event)
    apply_event_to_attempt_and_request(db, attempt=attempt, event=event, payload=payload)

    db.commit()
    db.refresh(event)

    if attempt is not None:
        db.refresh(attempt)

    return event



def provider_event_to_payload(event: PaymentProviderEvent) -> PaymentProviderEventCreate:
    return PaymentProviderEventCreate(
        payment_attempt_id=event.payment_attempt_id,
        provider=event.provider,
        provider_reference=event.provider_reference,
        provider_transaction_reference=(
            event.provider_transaction_reference
        ),
        external_event_id=event.external_event_id,
        event_type=event.event_type,
        event_status=event.event_status,
        verification_status=event.verification_status,
        amount=event.amount,
        currency=event.currency,
        raw_payload={},
        notes=event.notes,
    )


def verify_provider_event(
    db: Session,
    *,
    provider_event_id: str,
    verified_by_user_id: str | None = None,
    notes: str | None = None,
) -> PaymentProviderEvent:
    event = db.scalar(select(PaymentProviderEvent).where(PaymentProviderEvent.id == provider_event_id))
    if event is None:
        raise LookupError("Payment provider event not found.")

    if event.is_duplicate:
        raise ValueError("Duplicate provider events cannot be verified.")

    if event.verification_status == "verified":
        return event

    if event.payment_attempt_id is None:
        event.verification_status = "needs_review"
        event.processed_at = utc_now()
        event.notes = notes or event.notes or "Provider event could not be verified because no payment attempt was matched."
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    attempt = db.scalar(select(PaymentAttempt).where(PaymentAttempt.id == event.payment_attempt_id))
    if attempt is None:
        event.verification_status = "needs_review"
        event.processed_at = utc_now()
        event.notes = notes or event.notes or "Provider event could not be verified because the matched attempt no longer exists."
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    payload = provider_event_to_payload(event)

    if not amount_and_currency_match(attempt, payload):
        event.verification_status = "rejected"
        event.processed_at = utc_now()
        event.notes = notes or event.notes or "Provider event rejected because amount or currency does not match the payment attempt."
        apply_event_to_attempt_and_request(db, attempt=attempt, event=event, payload=provider_event_to_payload(event))
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    event.verification_status = "verified"
    event.processed_at = utc_now()
    if notes:
        event.notes = notes

    apply_event_to_attempt_and_request(db, attempt=attempt, event=event, payload=provider_event_to_payload(event))

    db.add(event)
    db.commit()
    db.refresh(event)
    return event
