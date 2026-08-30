from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.appointments.models import Appointment
from app.modules.appointments.schemas import (
    AppointmentCreate,
    AppointmentRead,
    AppointmentUpdate,
    TherapistAppointmentRead,
)
from app.modules.auth.dependencies import require_permission
from app.modules.booking_engine.service import (
    create_scheduled_appointment,
    delete_scheduled_appointment,
    update_scheduled_appointment,
)
from app.modules.services.models import Service
from app.modules.therapist_profiles.access import resolve_assigned_therapist_profile_id
from app.modules.therapist_profiles.models import TherapistProfile
from app.modules.users.models import User

router = APIRouter()


def _load_services_by_id(
    db: Session,
    appointments,
) -> dict[str, Service]:
    service_ids = {
        appointment.service_id
        for appointment in appointments
        if appointment.service_id
    }

    if not service_ids:
        return {}

    services = db.scalars(
        select(Service).where(
            Service.id.in_(service_ids)
        )
    ).all()

    return {
        service.id: service
        for service in services
    }


def _load_therapists_by_id(
    db: Session,
    appointments,
) -> dict[str, TherapistProfile]:
    therapist_ids = {
        appointment.therapist_profile_id
        for appointment in appointments
        if appointment.therapist_profile_id
    }

    if not therapist_ids:
        return {}

    therapists = db.scalars(
        select(TherapistProfile).where(
            TherapistProfile.id.in_(therapist_ids)
        )
    ).all()

    return {
        therapist.id: therapist
        for therapist in therapists
    }


def _service_display_values(
    service: Service | None,
) -> dict:
    if service is None:
        return {
            "service_name": None,
            "service_category": None,
            "service_format": None,
            "service_duration_minutes": None,
        }

    return {
        "service_name": service.name,
        "service_category": service.category,
        "service_format": service.service_format,
        "service_duration_minutes": (
            service.duration_minutes
        ),
    }


def _admin_appointment_reads(
    db: Session,
    appointments,
) -> list[AppointmentRead]:
    appointments = list(appointments)

    services = _load_services_by_id(
        db,
        appointments,
    )
    therapists = _load_therapists_by_id(
        db,
        appointments,
    )

    results = []

    for appointment in appointments:
        service = services.get(
            appointment.service_id
        )
        therapist = therapists.get(
            appointment.therapist_profile_id
        )

        results.append(
            AppointmentRead
            .model_validate(appointment)
            .model_copy(
                update={
                    **_service_display_values(
                        service
                    ),
                    "therapist_name": (
                        therapist.full_name
                        if therapist
                        else None
                    ),
                }
            )
        )

    return results


def _therapist_appointment_reads(
    db: Session,
    appointments,
) -> list[TherapistAppointmentRead]:
    appointments = list(appointments)

    services = _load_services_by_id(
        db,
        appointments,
    )

    results = []

    for appointment in appointments:
        service = services.get(
            appointment.service_id
        )

        results.append(
            TherapistAppointmentRead
            .model_validate(appointment)
            .model_copy(
                update=_service_display_values(
                    service
                )
            )
        )

    return results


@router.get("", response_model=list[AppointmentRead])
def list_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments.read")),
):
    appointments = db.scalars(
        select(Appointment).order_by(
            Appointment.appointment_date.desc(),
            Appointment.start_time,
            Appointment.created_at.desc(),
        )
    ).all()

    return _admin_appointment_reads(
        db,
        appointments,
    )


@router.get(
    "/mine",
    response_model=list[TherapistAppointmentRead],
)
def list_my_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("appointments.own.read")
    ),
):
    therapist_profile_id = (
        resolve_assigned_therapist_profile_id(
            db,
            current_user,
        )
    )

    appointments = db.scalars(
        select(Appointment)
        .where(
            Appointment.therapist_profile_id
            == therapist_profile_id
        )
        .order_by(
            Appointment.appointment_date.asc(),
            Appointment.start_time,
            Appointment.created_at.asc(),
        )
    ).all()

    return _therapist_appointment_reads(
        db,
        appointments,
    )


@router.post("", response_model=AppointmentRead, status_code=status.HTTP_201_CREATED)
def create_appointment(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments.create")),
):
    try:
        appointment = create_scheduled_appointment(
            db,
            values=payload.model_dump(),
        )

        return _admin_appointment_reads(
            db,
            [appointment],
        )[0]
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

    return _admin_appointment_reads(
        db,
        [appointment],
    )[0]


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

    return _admin_appointment_reads(
        db,
        [appointment],
    )[0]


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
