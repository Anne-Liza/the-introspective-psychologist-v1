from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit_events import AuditAction, record_audit_event
from app.core.database import get_db
from app.core.rate_limit import enforce_public_action_rate_limit
from app.modules.auth.dependencies import require_permission
from app.modules.payment_attempts.models import PaymentAttempt
from app.modules.payment_attempts.schemas import (
    PaymentAttemptCreate,
    PaymentAttemptRead,
    PaymentProviderEventCreate,
    PaymentProviderEventVerify,
    PaymentProviderEventRead,
)
from app.modules.payment_attempts.service import (
    attach_provider_events,
    create_payment_attempt_from_request,
    get_attempt_events,
    get_attempt_with_events,
    record_provider_event,
    verify_provider_event,
)
from app.modules.users.models import User

router = APIRouter()


@router.get("", response_model=list[PaymentAttemptRead])
def list_payment_attempts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payment_attempts.read")),
):
    attempts = db.scalars(select(PaymentAttempt).order_by(PaymentAttempt.created_at.desc())).all()
    return [attach_provider_events(attempt, get_attempt_events(db, attempt.id)) for attempt in attempts]


@router.post("/from-request", response_model=PaymentAttemptRead, status_code=status.HTTP_201_CREATED)
def create_payment_attempt(
    payload: PaymentAttemptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payment_attempts.create")),
):
    try:
        attempt = create_payment_attempt_from_request(
            db,
            payload=payload,
            initiated_by_user_id=current_user.id,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment request not found.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    record_audit_event(
        db,
        action=AuditAction.PAYMENT_ATTEMPT_CREATED,
        actor=current_user,
        resource_type="payment_attempt",
        resource_id=attempt.id,
        metadata={
            "payment_request_id": attempt.payment_request_id,
            "provider": attempt.provider,
            "amount": str(attempt.amount),
            "currency": attempt.currency,
            "status": attempt.status,
        },
    )
    return attempt


@router.get("/{attempt_id}", response_model=PaymentAttemptRead)
def get_payment_attempt(
    attempt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payment_attempts.read")),
):
    attempt, events = get_attempt_with_events(db, attempt_id)
    if attempt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment attempt not found.")
    return attach_provider_events(attempt, events)


@router.post("/provider-events", response_model=PaymentProviderEventRead, status_code=status.HTTP_201_CREATED)
def record_verified_or_admin_provider_event(
    payload: PaymentProviderEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payment_attempts.verify")),
):
    event = record_provider_event(db, payload=payload)

    record_audit_event(
        db,
        action=AuditAction.PAYMENT_PROVIDER_EVENT_RECORDED,
        actor=current_user,
        resource_type="payment_provider_event",
        resource_id=event.id,
        metadata={
            "payment_attempt_id": event.payment_attempt_id,
            "payment_request_id": event.payment_request_id,
            "provider": event.provider,
            "event_status": event.event_status,
            "verification_status": event.verification_status,
            "is_duplicate": event.is_duplicate,
        },
    )

    if event.verification_status == "verified" and event.event_status == "succeeded":
        record_audit_event(
            db,
            action=AuditAction.PAYMENT_ATTEMPT_VERIFIED,
            actor=current_user,
            resource_type="payment_attempt",
            resource_id=event.payment_attempt_id,
            metadata={
                "payment_request_id": event.payment_request_id,
                "provider": event.provider,
                "provider_reference": event.provider_reference,
            },
        )

    return event


@router.post("/public/provider-events", response_model=PaymentProviderEventRead, status_code=status.HTTP_201_CREATED)
def record_public_provider_event(
    payload: PaymentProviderEventCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_public_action_rate_limit(request, scope="provider_callback")

    event = record_provider_event(db, payload=payload, force_unverified=True)

    record_audit_event(
        db,
        action=AuditAction.PAYMENT_PROVIDER_EVENT_RECORDED,
        actor=None,
        resource_type="payment_provider_event",
        resource_id=event.id,
        metadata={
            "payment_attempt_id": event.payment_attempt_id,
            "payment_request_id": event.payment_request_id,
            "provider": event.provider,
            "event_status": event.event_status,
            "verification_status": event.verification_status,
            "is_duplicate": event.is_duplicate,
            "source": "public_unverified",
        },
    )

    return event



@router.post("/provider-events/{provider_event_id}/verify", response_model=PaymentProviderEventRead)
def verify_payment_provider_event(
    provider_event_id: str,
    payload: PaymentProviderEventVerify,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payment_attempts.verify")),
):
    try:
        event = verify_provider_event(
            db,
            provider_event_id=provider_event_id,
            verified_by_user_id=current_user.id,
            notes=payload.notes,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment provider event not found.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    record_audit_event(
        db,
        action=AuditAction.PAYMENT_ATTEMPT_VERIFIED,
        actor=current_user,
        resource_type="payment_provider_event",
        resource_id=event.id,
        metadata={
            "payment_attempt_id": event.payment_attempt_id,
            "payment_request_id": event.payment_request_id,
            "provider": event.provider,
            "event_status": event.event_status,
            "verification_status": event.verification_status,
            "is_duplicate": event.is_duplicate,
        },
    )

    return event
