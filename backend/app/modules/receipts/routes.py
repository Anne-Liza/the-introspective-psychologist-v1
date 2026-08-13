from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit_events import AuditAction, record_audit_event
from app.core.database import get_db
from app.modules.auth.dependencies import require_permission
from app.modules.receipts.schemas import ReceiptCreateFromPaymentRequest, ReceiptRead, ReceiptUpdate
from app.modules.receipts.service import (
    create_receipt_from_payment_request,
    get_receipt_with_events,
    list_receipts,
    update_receipt_from_payload,
)
from app.modules.users.models import User

router = APIRouter()


@router.get("", response_model=list[ReceiptRead])
def list_receipt_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("receipts.read")),
):
    return list_receipts(db)


@router.post("/from-payment-request", response_model=ReceiptRead, status_code=status.HTTP_201_CREATED)
def create_receipt_record_from_payment_request(
    payload: ReceiptCreateFromPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("receipts.create")),
):
    try:
        receipt = create_receipt_from_payment_request(
            db,
            payload=payload,
            created_by_user_id=current_user.id,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment request not found.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    record_audit_event(
        db,
        action=AuditAction.RECEIPT_CREATED,
        actor=current_user,
        resource_type="receipt",
        resource_id=receipt.id,
        metadata={
            "receipt_number": receipt.receipt_number,
            "payment_request_id": receipt.payment_request_id,
            "commerce_order_id": receipt.commerce_order_id,
            "amount": str(receipt.amount),
            "currency": receipt.currency,
            "status": receipt.status,
        },
    )

    return receipt


@router.get("/{receipt_id}", response_model=ReceiptRead)
def get_receipt_record(
    receipt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("receipts.read")),
):
    receipt, events = get_receipt_with_events(db, receipt_id)
    if receipt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found.")

    return receipt


@router.patch("/{receipt_id}", response_model=ReceiptRead)
def update_receipt_record(
    receipt_id: str,
    payload: ReceiptUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("receipts.update")),
):
    receipt, _events = get_receipt_with_events(db, receipt_id)
    if receipt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found.")

    try:
        updated = update_receipt_from_payload(
            db,
            receipt,
            payload,
            actor_user_id=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    record_audit_event(
        db,
        action=AuditAction.RECEIPT_STATUS_CHANGED,
        actor=current_user,
        resource_type="receipt",
        resource_id=updated.id,
        metadata={
            "receipt_number": updated.receipt_number,
            "payment_request_id": updated.payment_request_id,
            "commerce_order_id": updated.commerce_order_id,
            "status": updated.status,
        },
    )

    return updated
