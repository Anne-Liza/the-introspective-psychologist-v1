from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.audit_events import AuditAction, record_audit_event
from app.core.database import get_db
from app.core.rate_limit import enforce_public_action_rate_limit
from app.modules.auth.dependencies import require_permission
from app.modules.mpesa_payments.client import (
    MpesaConfigurationError,
    MpesaOAuthError,
    MpesaQueryRejectedError,
    MpesaQueryUncertainError,
    MpesaSubmissionRejectedError,
    MpesaSubmissionUncertainError,
)
from app.modules.mpesa_payments.schemas import (
    MpesaCallbackRead,
    MpesaCallbackVerifyRequest,
    MpesaStkPushPrepareRequest,
    MpesaPublicStkPushPrepareRequest,
    MpesaStkPushPrepareResponse,
)
from app.modules.mpesa_payments.service import (
    initiate_public_stk_push,
    prepare_public_stk_push_attempt,
    prepare_stk_push_attempt,
    mark_mpesa_verification_deferred,
    record_mpesa_callback_event,
    schedule_mpesa_reconciliation,
    verify_mpesa_provider_event,
)
from app.modules.payment_attempts.models import (
    PaymentAttempt,
)
from app.modules.users.models import User

router = APIRouter()


@router.post("/stk-push/prepare", response_model=MpesaStkPushPrepareResponse, status_code=status.HTTP_201_CREATED)
def prepare_mpesa_stk_push(
    payload: MpesaStkPushPrepareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("mpesa_payments.initiate")),
):
    try:
        attempt = prepare_stk_push_attempt(
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
        action=AuditAction.MPESA_STK_PUSH_PREPARED,
        actor=current_user,
        resource_type="payment_attempt",
        resource_id=attempt.id,
        metadata={
            "payment_request_id": attempt.payment_request_id,
            "provider": attempt.provider,
            "amount": str(attempt.amount),
            "currency": attempt.currency,
            "status": attempt.status,
            "adapter_mode": "prepare_only",
        },
    )

    return MpesaStkPushPrepareResponse(
        payment_attempt_id=attempt.id,
        attempt_number=attempt.attempt_number,
        payment_request_id=attempt.payment_request_id,
        provider=attempt.provider,
        provider_reference=attempt.provider_reference,
        provider_session_id=attempt.provider_session_id,
        amount=attempt.amount,
        currency=attempt.currency,
        status=attempt.status,
        verification_status=attempt.verification_status,
        phone_number=payload.phone_number,
        adapter_mode="prepare_only",
        message="M-Pesa STK Push payload prepared but not sent in this milestone.",
    )


@router.post(
    "/public/payment-requests/"
    "{payment_request_id}/stk-push/prepare",
    response_model=MpesaStkPushPrepareResponse,
    status_code=status.HTTP_201_CREATED,
)
def prepare_public_mpesa_stk_push(
    payment_request_id: str,
    payload: MpesaPublicStkPushPrepareRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_public_action_rate_limit(
        request,
        scope="checkout_payment",
    )

    try:
        attempt = prepare_public_stk_push_attempt(
            db,
            payment_request_id=payment_request_id,
            phone_number=payload.phone_number,
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment request not found.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    record_audit_event(
        db,
        action=AuditAction.MPESA_STK_PUSH_PREPARED,
        actor=None,
        resource_type="payment_attempt",
        resource_id=attempt.id,
        metadata={
            "payment_request_id": (
                attempt.payment_request_id
            ),
            "provider": attempt.provider,
            "amount": str(attempt.amount),
            "currency": attempt.currency,
            "status": attempt.status,
            "adapter_mode": "prepare_only",
            "source": "public_payment",
        },
    )

    return MpesaStkPushPrepareResponse(
        payment_attempt_id=attempt.id,
        attempt_number=attempt.attempt_number,
        payment_request_id=(
            attempt.payment_request_id
        ),
        provider=attempt.provider,
        provider_reference=(
            attempt.provider_reference
        ),
        provider_session_id=(
            attempt.provider_session_id
        ),
        amount=attempt.amount,
        currency=attempt.currency,
        status=attempt.status,
        verification_status=(
            attempt.verification_status
        ),
        phone_number=payload.phone_number,
        adapter_mode="prepare_only",
        message=(
            "M-Pesa STK Push payload prepared "
            "but not sent in this milestone."
        ),
    )


@router.post(
    "/public/payment-requests/"
    "{payment_request_id}/stk-push/initiate",
    response_model=MpesaStkPushPrepareResponse,
    status_code=status.HTTP_201_CREATED,
)
def initiate_public_mpesa_stk_push(
    payment_request_id: str,
    payload: MpesaPublicStkPushPrepareRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_public_action_rate_limit(
        request,
        scope="checkout_payment",
    )

    try:
        attempt = initiate_public_stk_push(
            db,
            payment_request_id=payment_request_id,
            phone_number=payload.phone_number,
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment request not found.",
        ) from exc
    except (
        MpesaConfigurationError,
        MpesaOAuthError,
    ) as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=str(exc),
        ) from exc
    except MpesaSubmissionRejectedError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except MpesaSubmissionUncertainError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    record_audit_event(
        db,
        action=(
            AuditAction.MPESA_STK_PUSH_INITIATED
        ),
        actor=None,
        resource_type="payment_attempt",
        resource_id=attempt.id,
        metadata={
            "payment_request_id": (
                attempt.payment_request_id
            ),
            "provider": attempt.provider,
            "provider_reference": (
                attempt.provider_reference
            ),
            "provider_session_id": (
                attempt.provider_session_id
            ),
            "amount": str(attempt.amount),
            "currency": attempt.currency,
            "status": attempt.status,
            "adapter_mode": "live",
            "source": "public_payment",
        },
    )

    return MpesaStkPushPrepareResponse(
        payment_attempt_id=attempt.id,
        attempt_number=attempt.attempt_number,
        payment_request_id=(
            attempt.payment_request_id
        ),
        provider=attempt.provider,
        provider_reference=(
            attempt.provider_reference
        ),
        provider_session_id=(
            attempt.provider_session_id
        ),
        amount=attempt.amount,
        currency=attempt.currency,
        status=attempt.status,
        verification_status=(
            attempt.verification_status
        ),
        phone_number=payload.phone_number,
        adapter_mode="live",
        message=(
            "M-Pesa STK Push submitted. "
            "Check your phone to complete "
            "payment."
        ),
    )


@router.post("/callbacks/stk", response_model=MpesaCallbackRead, status_code=status.HTTP_201_CREATED)
def receive_mpesa_stk_callback(
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_public_action_rate_limit(
        request,
        scope="provider_callback",
    )

    event = record_mpesa_callback_event(
        db,
        payload=payload,
        force_unverified=True,
    )

    automatic_reconciliation_scheduled = False

    if (
        not event.is_duplicate
        and event.payment_attempt_id is not None
        and event.verification_status
        == "unverified"
    ):
        attempt = db.get(
            PaymentAttempt,
            event.payment_attempt_id,
        )

        if attempt is not None:
            schedule_mpesa_reconciliation(
                db,
                attempt=attempt,
            )
            automatic_reconciliation_scheduled = (
                True
            )

    record_audit_event(
        db,
        action=AuditAction.MPESA_CALLBACK_RECEIVED,
        actor=None,
        resource_type=(
            "payment_provider_event"
        ),
        resource_id=event.id,
        metadata={
            "payment_attempt_id": (
                event.payment_attempt_id
            ),
            "payment_request_id": (
                event.payment_request_id
            ),
            "provider": event.provider,
            "event_status": event.event_status,
            "verification_status": (
                event.verification_status
            ),
            "is_duplicate": event.is_duplicate,
            "automatic_reconciliation_scheduled": (
                automatic_reconciliation_scheduled
            ),
        },
    )

    return MpesaCallbackRead(
        provider_event_id=event.id,
        payment_attempt_id=(
            event.payment_attempt_id
        ),
        payment_request_id=(
            event.payment_request_id
        ),
        provider_reference=(
            event.provider_reference
        ),
        event_status=event.event_status,
        verification_status=(
            event.verification_status
        ),
        is_duplicate=event.is_duplicate,
    )



@router.post("/callbacks/{provider_event_id}/verify", response_model=MpesaCallbackRead)
def verify_mpesa_callback_event(
    provider_event_id: str,
    payload: MpesaCallbackVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payment_attempts.verify")),
):
    try:
        event = verify_mpesa_provider_event(
            db,
            provider_event_id=provider_event_id,
            verified_by_user_id=current_user.id,
            notes=payload.notes,
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "M-Pesa provider event not found."
            ),
        ) from exc
    except (
        MpesaConfigurationError,
        MpesaOAuthError,
        MpesaQueryUncertainError,
    ) as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=str(exc),
        ) from exc
    except MpesaQueryRejectedError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

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

    return MpesaCallbackRead(
        provider_event_id=event.id,
        payment_attempt_id=event.payment_attempt_id,
        payment_request_id=event.payment_request_id,
        provider_reference=event.provider_reference,
        event_status=event.event_status,
        verification_status=event.verification_status,
        is_duplicate=event.is_duplicate,
    )
