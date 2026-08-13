from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.appointments.models import Appointment
from app.modules.client_records.models import ClientRecord, ClientRecordLink
from app.modules.client_records.schemas import (
    ClientRecordCreate,
    ClientRecordFromAppointment,
    ClientRecordFromCommerceOrder,
    ClientRecordUpdate,
)
from app.modules.commerce_core.models import CommerceOrder


def generate_client_number() -> str:
    return f"CLT-{uuid4().hex[:10].upper()}"


def attach_links(record: ClientRecord, links: list[ClientRecordLink]) -> ClientRecord:
    setattr(record, "links", links)
    return record


def get_client_links(db: Session, client_record_id: str) -> list[ClientRecordLink]:
    return db.scalars(
        select(ClientRecordLink)
        .where(ClientRecordLink.client_record_id == client_record_id)
        .order_by(ClientRecordLink.created_at.desc())
    ).all()


def get_client_with_links(
    db: Session,
    client_record_id: str,
) -> tuple[ClientRecord | None, list[ClientRecordLink]]:
    record = db.scalar(select(ClientRecord).where(ClientRecord.id == client_record_id))
    if record is None:
        return None, []
    links = get_client_links(db, record.id)
    return attach_links(record, links), links


def list_client_records(db: Session) -> list[ClientRecord]:
    records = db.scalars(select(ClientRecord).order_by(ClientRecord.created_at.desc())).all()
    for record in records:
        attach_links(record, get_client_links(db, record.id))
    return records


def get_client_by_email(db: Session, email: str) -> ClientRecord | None:
    return db.scalar(select(ClientRecord).where(ClientRecord.email == email.strip().lower()))


def ensure_email_available(db: Session, *, email: str, current_record_id: str | None = None) -> None:
    existing = get_client_by_email(db, email)
    if existing is not None and existing.id != current_record_id:
        raise ValueError("A client record with this email already exists.")


def create_client_record(
    db: Session,
    *,
    payload: ClientRecordCreate,
    created_by_user_id: str | None = None,
) -> ClientRecord:
    ensure_email_available(db, email=payload.email)

    record = ClientRecord(
        client_number=generate_client_number(),
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        status=payload.status,
        source=payload.source,
        preferred_contact_method=payload.preferred_contact_method,
        admin_notes=payload.admin_notes,
        created_by_user_id=created_by_user_id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return attach_links(record, [])


def create_or_update_client_identity(
    db: Session,
    *,
    full_name: str,
    email: str,
    phone: str | None,
    source: str,
    admin_notes: str | None = None,
    created_by_user_id: str | None = None,
) -> ClientRecord:
    normalized_email = email.strip().lower()
    existing = get_client_by_email(db, normalized_email)

    if existing is not None:
        if not existing.phone and phone:
            existing.phone = phone
        if admin_notes and not existing.admin_notes:
            existing.admin_notes = admin_notes
        db.add(existing)
        db.flush()
        return existing

    record = ClientRecord(
        client_number=generate_client_number(),
        full_name=full_name.strip(),
        email=normalized_email,
        phone=phone,
        status="lead",
        source=source,
        preferred_contact_method="email",
        admin_notes=admin_notes,
        created_by_user_id=created_by_user_id,
    )
    db.add(record)
    db.flush()
    return record


def create_client_link(
    db: Session,
    *,
    client_record: ClientRecord,
    link_type: str,
    linked_record_id: str,
    label: str | None = None,
    notes: str | None = None,
    created_by_user_id: str | None = None,
) -> ClientRecordLink:
    existing = db.scalar(
        select(ClientRecordLink).where(
            ClientRecordLink.client_record_id == client_record.id,
            ClientRecordLink.link_type == link_type,
            ClientRecordLink.linked_record_id == linked_record_id,
        )
    )
    if existing is not None:
        return existing

    link = ClientRecordLink(
        client_record_id=client_record.id,
        link_type=link_type,
        linked_record_id=linked_record_id,
        label=label,
        notes=notes,
        created_by_user_id=created_by_user_id,
    )
    db.add(link)
    db.flush()
    return link


def create_client_from_appointment(
    db: Session,
    *,
    payload: ClientRecordFromAppointment,
    created_by_user_id: str | None = None,
) -> ClientRecord:
    appointment = db.scalar(select(Appointment).where(Appointment.id == payload.appointment_id))
    if appointment is None:
        raise LookupError("Appointment not found.")

    record = create_or_update_client_identity(
        db,
        full_name=appointment.client_name,
        email=appointment.client_email,
        phone=appointment.client_phone,
        source="appointment",
        admin_notes=payload.admin_notes,
        created_by_user_id=created_by_user_id,
    )

    create_client_link(
        db,
        client_record=record,
        link_type="appointment",
        linked_record_id=appointment.id,
        label=f"Appointment {appointment.appointment_date.isoformat()}",
        notes=payload.admin_notes,
        created_by_user_id=created_by_user_id,
    )

    db.commit()
    db.refresh(record)
    return attach_links(record, get_client_links(db, record.id))


def create_client_from_commerce_order(
    db: Session,
    *,
    payload: ClientRecordFromCommerceOrder,
    created_by_user_id: str | None = None,
) -> ClientRecord:
    order = db.scalar(select(CommerceOrder).where(CommerceOrder.id == payload.commerce_order_id))
    if order is None:
        raise LookupError("Commerce order not found.")

    record = create_or_update_client_identity(
        db,
        full_name=order.customer_name,
        email=order.customer_email,
        phone=order.customer_phone,
        source="commerce_order",
        admin_notes=payload.admin_notes,
        created_by_user_id=created_by_user_id,
    )

    create_client_link(
        db,
        client_record=record,
        link_type="commerce_order",
        linked_record_id=order.id,
        label=order.order_number,
        notes=payload.admin_notes,
        created_by_user_id=created_by_user_id,
    )

    db.commit()
    db.refresh(record)
    return attach_links(record, get_client_links(db, record.id))


def update_client_record_from_payload(
    db: Session,
    record: ClientRecord,
    payload: ClientRecordUpdate,
) -> ClientRecord:
    update_data = payload.model_dump(exclude_unset=True)

    if "email" in update_data:
        ensure_email_available(db, email=update_data["email"], current_record_id=record.id)

    for key, value in update_data.items():
        setattr(record, key, value)

    db.add(record)
    db.commit()
    db.refresh(record)

    return attach_links(record, get_client_links(db, record.id))
