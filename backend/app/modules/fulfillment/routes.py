from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit_events import AuditAction, record_audit_event
from app.core.database import get_db
from app.modules.auth.dependencies import require_permission
from app.modules.fulfillment.schemas import FulfillmentCreateFromReceipt, FulfillmentRead, FulfillmentUpdate
from app.modules.fulfillment.service import (
    create_fulfillment_from_receipt,
    get_fulfillment_with_events,
    list_fulfillment_records,
    update_fulfillment_from_payload,
)
from app.modules.users.models import User

router = APIRouter()


@router.get("", response_model=list[FulfillmentRead])
def list_fulfillment(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("fulfillment.read")),
):
    return list_fulfillment_records(db)


@router.post("/from-receipt", response_model=FulfillmentRead, status_code=status.HTTP_201_CREATED)
def create_fulfillment_record_from_receipt(
    payload: FulfillmentCreateFromReceipt,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("fulfillment.create")),
):
    try:
        record = create_fulfillment_from_receipt(
            db,
            payload=payload,
            created_by_user_id=current_user.id,
        )
    except LookupError as exc:
        message = str(exc) or "Receipt or commerce order not found."
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    record_audit_event(
        db,
        action=AuditAction.FULFILLMENT_CREATED,
        actor=current_user,
        resource_type="fulfillment",
        resource_id=record.id,
        metadata={
            "fulfillment_number": record.fulfillment_number,
            "receipt_id": record.receipt_id,
            "payment_request_id": record.payment_request_id,
            "commerce_order_id": record.commerce_order_id,
            "status": record.status,
            "fulfillment_type": record.fulfillment_type,
        },
    )

    return record


@router.get("/{fulfillment_id}", response_model=FulfillmentRead)
def get_fulfillment_record(
    fulfillment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("fulfillment.read")),
):
    record, _events = get_fulfillment_with_events(db, fulfillment_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fulfillment record not found.")

    return record


@router.patch("/{fulfillment_id}", response_model=FulfillmentRead)
def update_fulfillment_record(
    fulfillment_id: str,
    payload: FulfillmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("fulfillment.update")),
):
    record, _events = get_fulfillment_with_events(db, fulfillment_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fulfillment record not found.")

    try:
        updated = update_fulfillment_from_payload(
            db,
            record,
            payload,
            actor_user_id=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    record_audit_event(
        db,
        action=AuditAction.FULFILLMENT_STATUS_CHANGED,
        actor=current_user,
        resource_type="fulfillment",
        resource_id=updated.id,
        metadata={
            "fulfillment_number": updated.fulfillment_number,
            "receipt_id": updated.receipt_id,
            "commerce_order_id": updated.commerce_order_id,
            "status": updated.status,
            "fulfillment_type": updated.fulfillment_type,
        },
    )

    return updated
