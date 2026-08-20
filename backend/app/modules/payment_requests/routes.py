from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit_events import AuditAction, record_audit_event
from app.core.database import get_db
from app.core.rate_limit import enforce_public_action_rate_limit
from app.modules.auth.dependencies import require_permission
from app.modules.payment_requests.models import PaymentRequest
from app.modules.payment_requests.schemas import (
    PaymentRequestCreate,
    PaymentRequestFromOrderCreate,
    PaymentRequestRead,
    PaymentRequestUpdate,
    PublicPaymentRequestFromOrderCreate,
    PublicPaymentStatusRead,
)
from app.modules.receipts.models import ReceiptRecord
from app.modules.payment_requests.service import (
    attach_events,
    create_payment_request_from_order,
    expire_stale_payment_requests,
    get_payment_request_events,
    get_payment_request_with_events,
    update_payment_request_from_payload,
)
from app.modules.users.models import User

router = APIRouter()


@router.post("/public/from-order", response_model=PaymentRequestRead, status_code=status.HTTP_201_CREATED)
def create_public_payment_request_from_order(
    payload: PublicPaymentRequestFromOrderCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_public_action_rate_limit(request, scope="checkout_payment")

    try:
        payment_request = create_payment_request_from_order(
            db,
            payload=payload,
            expected_customer_email=payload.customer_email,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commerce order not found.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    record_audit_event(
        db,
        action=AuditAction.PAYMENT_REQUEST_CREATED,
        actor=None,
        resource_type="payment_request",
        resource_id=payment_request.id,
        metadata={
            "commerce_order_id": payment_request.commerce_order_id,
            "amount": str(payment_request.amount),
            "currency": payment_request.currency,
            "provider": payment_request.provider,
            "status": payment_request.status,
            "source": "public",
        },
    )
    return payment_request


@router.get(
    "/public/{payment_request_id}/status",
    response_model=PublicPaymentStatusRead,
)
def get_public_payment_status(
    payment_request_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_public_action_rate_limit(
        request,
        scope="checkout_payment_status",
    )

    expire_stale_payment_requests(db)

    payment_request = db.scalar(
        select(PaymentRequest).where(
            PaymentRequest.id == payment_request_id
        )
    )

    if payment_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment status not found.",
        )

    receipt = db.scalar(
        select(ReceiptRecord).where(
            ReceiptRecord.payment_request_id
            == payment_request.id
        )
    )

    return PublicPaymentStatusRead(
        payment_request_id=payment_request.id,
        request_number=payment_request.request_number,
        status=payment_request.status,
        amount=payment_request.amount,
        currency=payment_request.currency,
        provider=payment_request.provider,
        provider_transaction_reference=(
            payment_request.provider_transaction_reference
        ),
        receipt_number=(
            receipt.receipt_number
            if receipt is not None
            else None
        ),
        receipt_status=(
            receipt.status
            if receipt is not None
            else None
        ),
    )


@router.get("", response_model=list[PaymentRequestRead])
def list_payment_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payment_requests.read")),
):
    expire_stale_payment_requests(db)
    payment_requests = db.scalars(select(PaymentRequest).order_by(PaymentRequest.created_at.desc())).all()
    return [
        attach_events(payment_request, get_payment_request_events(db, payment_request.id))
        for payment_request in payment_requests
    ]


@router.post("/from-order", response_model=PaymentRequestRead, status_code=status.HTTP_201_CREATED)
def create_payment_request_from_order_admin(
    payload: PaymentRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payment_requests.create")),
):
    try:
        payment_request = create_payment_request_from_order(
            db,
            payload=payload,
            created_by_user_id=current_user.id,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commerce order not found.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    record_audit_event(
        db,
        action=AuditAction.PAYMENT_REQUEST_CREATED,
        actor=current_user,
        resource_type="payment_request",
        resource_id=payment_request.id,
        metadata={
            "commerce_order_id": payment_request.commerce_order_id,
            "amount": str(payment_request.amount),
            "currency": payment_request.currency,
            "provider": payment_request.provider,
            "status": payment_request.status,
            "source": "admin",
        },
    )
    return payment_request


@router.get("/{payment_request_id}", response_model=PaymentRequestRead)
def get_payment_request(
    payment_request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payment_requests.read")),
):
    payment_request, events = get_payment_request_with_events(db, payment_request_id)
    if payment_request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment request not found.")
    return attach_events(payment_request, events)


@router.patch("/{payment_request_id}", response_model=PaymentRequestRead)
def update_payment_request(
    payment_request_id: str,
    payload: PaymentRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payment_requests.update")),
):
    payment_request, _events = get_payment_request_with_events(db, payment_request_id)
    if payment_request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment request not found.")

    previous_status = payment_request.status

    try:
        updated = update_payment_request_from_payload(
            db,
            payment_request,
            payload,
            actor_user_id=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if payload.status is not None and payload.status != previous_status:
        record_audit_event(
            db,
            action=AuditAction.PAYMENT_REQUEST_STATUS_CHANGED,
            actor=current_user,
            resource_type="payment_request",
            resource_id=updated.id,
            metadata={
                "from_status": previous_status,
                "to_status": updated.status,
                "amount": str(updated.amount),
                "currency": updated.currency,
                "provider": updated.provider,
            },
        )

    return updated
