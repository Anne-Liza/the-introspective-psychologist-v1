from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.appointments.models import Appointment
from app.modules.appointments.schemas import (
    AppointmentCreate,
    AppointmentRead,
    AppointmentUpdate,
)
from app.modules.booking_engine.service import (
    create_scheduled_appointment,
    delete_scheduled_appointment,
    update_scheduled_appointment,
)
from app.modules.auth.dependencies import require_permission
from app.modules.users.models import User

router = APIRouter()


@router.get("", response_model=list[AppointmentRead])
def list_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments.read")),
):
    return db.scalars(
        select(Appointment).order_by(
            Appointment.appointment_date.desc(),
            Appointment.start_time,
            Appointment.created_at.desc(),
        )
    ).all()


@router.post("", response_model=AppointmentRead, status_code=status.HTTP_201_CREATED)
def create_appointment(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments.create")),
):
    try:
        return create_scheduled_appointment(
            db,
            values=payload.model_dump(),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.get("/{appointment_id}", response_model=AppointmentRead)
def get_appointment(
    appointment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments.read")),
):
    appointment = db.scalar(select(Appointment).where(Appointment.id == appointment_id))
    if appointment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")

    return appointment


@router.patch("/{appointment_id}", response_model=AppointmentRead)
def update_appointment(
    appointment_id: str,
    payload: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments.update")),
):
    try:
        appointment = update_scheduled_appointment(
            db,
            appointment_id=appointment_id,
            values=payload.model_dump(
                exclude_unset=True
            ),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    if appointment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found.",
        )

    return appointment


@router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_appointment(
    appointment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments.delete")),
):
    deleted = delete_scheduled_appointment(
        db,
        appointment_id=appointment_id,
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found.",
        )

    return None
