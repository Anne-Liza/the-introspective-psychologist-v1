from __future__ import annotations

import logging
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.appointments.models import Appointment
from app.modules.email.models import EmailLog
from app.modules.email.service import send_email
from app.modules.email_templates.models import EmailTemplate
from app.modules.services.models import Service
from app.modules.therapist_profiles.models import TherapistProfile
from app.modules.users.models import User

logger = logging.getLogger(__name__)

TherapistAppointmentEvent = Literal[
    "assigned",
    "updated",
    "cancelled",
]

THERAPIST_VISIBLE_UPDATE_FIELDS = (
    "client_name",
    "service_id",
    "appointment_date",
    "start_time",
    "end_time",
    "session_format",
    "location",
)

TEMPLATE_KEYS: dict[
    TherapistAppointmentEvent,
    str,
] = {
    "assigned": "therapist_appointment_assigned",
    "updated": "therapist_appointment_updated",
    "cancelled": "therapist_appointment_cancelled",
}

FALLBACK_SUBJECTS: dict[
    TherapistAppointmentEvent,
    str,
] = {
    "assigned": "New appointment assigned",
    "updated": "Appointment updated",
    "cancelled": "Appointment cancelled",
}

FALLBACK_MESSAGES: dict[
    TherapistAppointmentEvent,
    str,
] = {
    "assigned": (
        "A new appointment has been assigned to you."
    ),
    "updated": (
        "An appointment on your schedule has been updated."
    ),
    "cancelled": (
        "An appointment on your schedule has been cancelled."
    ),
}


def therapist_notification_snapshot(
    appointment: Appointment,
) -> dict[str, object]:
    snapshot: dict[str, object] = {
        "therapist_profile_id": (
            appointment.therapist_profile_id
        ),
        "status": appointment.status,
    }

    for field in THERAPIST_VISIBLE_UPDATE_FIELDS:
        snapshot[field] = getattr(
            appointment,
            field,
        )

    return snapshot


def therapist_notification_event(
    before: dict[str, object],
    appointment: Appointment,
) -> TherapistAppointmentEvent | None:
    previous_therapist_id = before.get(
        "therapist_profile_id"
    )
    current_therapist_id = (
        appointment.therapist_profile_id
    )

    if (
        previous_therapist_id
        != current_therapist_id
    ):
        if current_therapist_id:
            return "assigned"

        return None

    if not current_therapist_id:
        return None

    previous_status = before.get("status")

    if (
        appointment.status == "cancelled"
        and previous_status != "cancelled"
    ):
        return "cancelled"

    if (
        appointment.status
        in {"confirmed", "declined"}
        and previous_status
        != appointment.status
    ):
        return "updated"

    for field in THERAPIST_VISIBLE_UPDATE_FIELDS:
        if before.get(field) != getattr(
            appointment,
            field,
        ):
            return "updated"

    return None


def _therapist_recipient(
    db: Session,
    appointment: Appointment,
) -> tuple[TherapistProfile, User] | None:
    if not appointment.therapist_profile_id:
        return None

    profile = db.scalar(
        select(TherapistProfile).where(
            TherapistProfile.id
            == appointment.therapist_profile_id
        )
    )

    if (
        profile is None
        or not profile.user_id
    ):
        return None

    user = db.scalar(
        select(User).where(
            User.id == profile.user_id
        )
    )

    if user is None or not user.is_active:
        return None

    return profile, user


def _appointment_service(
    db: Session,
    appointment: Appointment,
) -> Service | None:
    if not appointment.service_id:
        return None

    return db.scalar(
        select(Service).where(
            Service.id == appointment.service_id
        )
    )


def _active_template(
    db: Session,
    event: TherapistAppointmentEvent,
) -> EmailTemplate | None:
    return db.scalar(
        select(EmailTemplate).where(
            EmailTemplate.key
            == TEMPLATE_KEYS[event],
            EmailTemplate.is_active.is_(True),
        )
    )


def _replace_placeholders(
    value: str,
    replacements: dict[str, str],
) -> str:
    rendered = value

    for key, replacement in replacements.items():
        rendered = rendered.replace(
            f"{{{{{key}}}}}",
            replacement,
        )
        rendered = rendered.replace(
            f"{{{{ {key} }}}}",
            replacement,
        )

    return rendered


def _format_time(appointment: Appointment) -> str:
    return (
        f"{appointment.start_time.strftime('%H:%M')}"
        " – "
        f"{appointment.end_time.strftime('%H:%M')}"
    )


def _fallback_body(
    event: TherapistAppointmentEvent,
) -> str:
    return (
        "Hello {{therapist_name}},\n\n"
        f"{FALLBACK_MESSAGES[event]}\n\n"
        "Client: {{client_name}}\n"
        "Service: {{service_name}}\n"
        "Date: {{appointment_date}}\n"
        "Time: {{appointment_time}}\n"
        "Format: {{session_format}}\n"
        "Location: {{location}}\n"
        "Status: {{appointment_status}}\n\n"
        "View your appointments:\n"
        "{{appointments_url}}\n\n"
        "Best,\n"
        "{{site_name}}"
    )


def _deliver_therapist_notification(
    db: Session,
    *,
    appointment: Appointment,
    event: TherapistAppointmentEvent,
) -> EmailLog | None:
    recipient = _therapist_recipient(
        db,
        appointment,
    )

    if recipient is None:
        return None

    profile, user = recipient

    service = _appointment_service(
        db,
        appointment,
    )

    template = _active_template(
        db,
        event,
    )

    subject = (
        template.subject
        if template is not None
        else FALLBACK_SUBJECTS[event]
    )

    body = (
        template.body
        if template is not None
        else _fallback_body(event)
    )

    effective_format = (
        appointment.session_format
        or (
            service.service_format
            if service is not None
            else None
        )
        or "Not specified"
    )

    replacements = {
        "therapist_name": profile.full_name,
        "client_name": appointment.client_name,
        "service_name": (
            service.name
            if service is not None
            else "Service details pending"
        ),
        "appointment_date": (
            appointment.appointment_date.strftime(
                "%d %b %Y"
            )
        ),
        "appointment_time": _format_time(
            appointment
        ),
        "session_format": effective_format,
        "location": (
            appointment.location
            or "Not specified"
        ),
        "appointment_status": (
            appointment.status
            .replace("_", " ")
            .title()
        ),
        "appointments_url": (
            f"{settings.FRONTEND_BASE_URL}"
            "/dashboard/appointments"
        ),
        "site_name": settings.APP_NAME,
    }

    return send_email(
        db,
        to_email=user.email,
        subject=_replace_placeholders(
            subject,
            replacements,
        ),
        body=_replace_placeholders(
            body,
            replacements,
        ),
    )


def notify_therapist_appointment(
    db: Session,
    *,
    appointment: Appointment,
    event: TherapistAppointmentEvent,
) -> EmailLog | None:
    try:
        return _deliver_therapist_notification(
            db,
            appointment=appointment,
            event=event,
        )
    except Exception:
        logger.exception(
            "Therapist appointment notification "
            "failed for appointment %s.",
            appointment.id,
        )
        return None
