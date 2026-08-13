from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit_events import AuditAction, record_audit_event
from app.core.database import get_db
from app.modules.auth.dependencies import require_permission
from app.modules.client_records.schemas import (
    ClientRecordCreate,
    ClientRecordFromAppointment,
    ClientRecordFromCommerceOrder,
    ClientRecordRead,
    ClientRecordUpdate,
)
from app.modules.client_records.service import (
    create_client_from_appointment,
    create_client_from_commerce_order,
    create_client_record,
    get_client_with_links,
    list_client_records,
    update_client_record_from_payload,
)
from app.modules.users.models import User

router = APIRouter()


@router.get("", response_model=list[ClientRecordRead])
def list_clients(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("client_records.read")),
):
    return list_client_records(db)


@router.post("", response_model=ClientRecordRead, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: ClientRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("client_records.create")),
):
    try:
        record = create_client_record(db, payload=payload, created_by_user_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    record_audit_event(
        db,
        action=AuditAction.CLIENT_RECORD_CREATED,
        actor=current_user,
        resource_type="client_record",
        resource_id=record.id,
        metadata={
            "client_number": record.client_number,
            "email": record.email,
            "source": record.source,
            "status": record.status,
        },
    )

    return record


@router.post("/from-appointment", response_model=ClientRecordRead, status_code=status.HTTP_201_CREATED)
def create_client_from_appointment_record(
    payload: ClientRecordFromAppointment,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("client_records.create")),
):
    try:
        record = create_client_from_appointment(
            db,
            payload=payload,
            created_by_user_id=current_user.id,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    record_audit_event(
        db,
        action=AuditAction.CLIENT_RECORD_LINKED,
        actor=current_user,
        resource_type="client_record",
        resource_id=record.id,
        metadata={
            "client_number": record.client_number,
            "email": record.email,
            "source": "appointment",
            "appointment_id": payload.appointment_id,
        },
    )

    return record


@router.post("/from-commerce-order", response_model=ClientRecordRead, status_code=status.HTTP_201_CREATED)
def create_client_from_commerce_order_record(
    payload: ClientRecordFromCommerceOrder,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("client_records.create")),
):
    try:
        record = create_client_from_commerce_order(
            db,
            payload=payload,
            created_by_user_id=current_user.id,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    record_audit_event(
        db,
        action=AuditAction.CLIENT_RECORD_LINKED,
        actor=current_user,
        resource_type="client_record",
        resource_id=record.id,
        metadata={
            "client_number": record.client_number,
            "email": record.email,
            "source": "commerce_order",
            "commerce_order_id": payload.commerce_order_id,
        },
    )

    return record


@router.get("/{client_record_id}", response_model=ClientRecordRead)
def get_client(
    client_record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("client_records.read")),
):
    record, _links = get_client_with_links(db, client_record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client record not found.")

    return record


@router.patch("/{client_record_id}", response_model=ClientRecordRead)
def update_client(
    client_record_id: str,
    payload: ClientRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("client_records.update")),
):
    record, _links = get_client_with_links(db, client_record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client record not found.")

    try:
        updated = update_client_record_from_payload(db, record, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    record_audit_event(
        db,
        action=AuditAction.CLIENT_RECORD_UPDATED,
        actor=current_user,
        resource_type="client_record",
        resource_id=updated.id,
        metadata={
            "client_number": updated.client_number,
            "email": updated.email,
            "status": updated.status,
        },
    )

    return updated
