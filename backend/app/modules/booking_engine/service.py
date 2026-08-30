from __future__ import annotations

import re
from collections import defaultdict
from datetime import UTC, date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from uuid import uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.booking_policy import (
    allocation_window_days,
    booking_timezone,
    booking_window_days,
    confirmation_mode,
    payment_policy,
    public_booking_policy,
)
from app.core.booking_policy import (
    deposit_percentage as configured_deposit_percentage,
)
from app.core.booking_policy import (
    hold_minutes as configured_hold_minutes,
)
from app.core.booking_state import (
    BLOCKING_APPOINTMENT_STATUSES,
    BLOCKING_HOLD_STATUSES,
    EXPIRABLE_HOLD_STATUSES,
    HOLD_STATUS_CONVERTED,
    HOLD_STATUS_EXPIRED,
    PAYMENT_POLICY_DEPOSIT,
    appointment_status_for_confirmation_mode,
    assert_appointment_status_transition,
    assert_hold_status_transition,
    hold_can_confirm,
    initial_hold_status,
    requires_advance_payment,
)
from app.core.time import utc_now
from app.modules.appointments.models import Appointment
from app.modules.appointments.notifications import (
    notify_therapist_appointment,
    therapist_notification_event,
    therapist_notification_snapshot,
)
from app.modules.availability.models import AvailabilityException, AvailabilityRule
from app.modules.booking_engine.models import (
    BookingHold,
    BookingScheduleLock,
    BookingSetting,
)
from app.modules.booking_engine.schemas import (
    BookableSlotRead,
    PublicAvailableDateRead,
    PublicBookableSlotRead,
    PublicBookingConfirmationRead,
)
from app.modules.payment_requests.models import (
    PaymentRequest,
    PaymentRequestEvent,
)
from app.modules.payment_requests.service import (
    ACTIVE_PAYMENT_REQUEST_STATUSES,
    attach_events,
    create_payment_request_event,
    generate_payment_request_number,
    get_payment_request_events,
)
from app.modules.services.models import Service
from app.modules.therapist_profiles.models import TherapistProfile

DEFAULT_HOLD_MINUTES = 10


def _notify_therapist_for_confirmation(
    db: Session,
    confirmation: PublicBookingConfirmationRead,
) -> None:
    appointment = db.get(
        Appointment,
        confirmation.appointment_id,
    )

    if appointment is None:
        return

    notify_therapist_appointment(
        db,
        appointment=appointment,
        event="assigned",
    )


def _booking_local_now() -> datetime:
    return (
        utc_now()
        .replace(tzinfo=UTC)
        .astimezone(
            ZoneInfo(booking_timezone())
        )
    )


def _slot_start_datetime(
    slot_date: date,
    start_time: time,
) -> datetime:
    return datetime.combine(
        slot_date,
        start_time,
        tzinfo=ZoneInfo(
            booking_timezone()
        ),
    )


def _slot_has_started(
    slot_date: date,
    start_time: time,
) -> bool:
    return (
        _slot_start_datetime(
            slot_date,
            start_time,
        )
        <= _booking_local_now()
    )


def _assert_future_slot(
    slot_date: date,
    start_time: time,
) -> None:
    if _slot_has_started(
        slot_date,
        start_time,
    ):
        raise ValueError(
            "Booking start time must be "
            "in the future."
        )


def _money_amount(
    value: Decimal,
) -> Decimal:
    return value.quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


def resolve_booking_payment_terms(
    db: Session,
    service: Service,
) -> tuple[
    str,
    str,
    Decimal | None,
    Decimal | None,
    str | None,
    int | None,
]:
    practice_settings = db.get(
        BookingSetting,
        "practice-default",
    )

    practice_policy = (
        practice_settings.payment_policy
        if practice_settings is not None
        else payment_policy()
    )
    practice_confirmation_mode = (
        practice_settings.confirmation_mode
        if practice_settings is not None
        else confirmation_mode()
    )
    practice_deposit_percentage = (
        practice_settings.deposit_percentage
        if practice_settings is not None
        else configured_deposit_percentage()
    )

    current_policy = (
        service.payment_policy_override
        if service.payment_policy_override
        is not None
        else practice_policy
    )
    current_confirmation_mode = (
        service.confirmation_mode_override
        if service.confirmation_mode_override
        is not None
        else practice_confirmation_mode
    )

    quoted_amount: Decimal | None = None
    advance_amount: Decimal | None = None
    resolved_currency: str | None = None
    percentage: int | None = None

    if service.price_amount is not None:
        quoted_amount = _money_amount(
            Decimal(service.price_amount)
        )

        if quoted_amount < 0:
            raise ValueError(
                "Service price cannot be negative."
            )

        if service.currency:
            resolved_currency = (
                service.currency.strip().upper()
            )

            if (
                len(resolved_currency) != 3
                or not resolved_currency.isalpha()
            ):
                raise ValueError(
                    "Service currency must be a "
                    "valid 3-letter currency code."
                )

        if (
            quoted_amount > 0
            and resolved_currency is None
        ):
            raise ValueError(
                "A currency is required for a "
                "priced booking service."
            )

    if requires_advance_payment(
        current_policy
    ):
        if (
            quoted_amount is None
            or quoted_amount <= 0
        ):
            raise ValueError(
                "A positive service price is "
                "required for advance-payment "
                "bookings."
            )

        if resolved_currency is None:
            raise ValueError(
                "A currency is required for "
                "advance-payment bookings."
            )

        if (
            current_policy
            == PAYMENT_POLICY_DEPOSIT
        ):
            percentage = (
                service.deposit_percentage_override
                if service.payment_policy_override
                == PAYMENT_POLICY_DEPOSIT
                else practice_deposit_percentage
            )

            if percentage is None:
                raise ValueError(
                    "A deposit percentage is "
                    "required for deposit bookings."
                )

            advance_amount = _money_amount(
                quoted_amount
                * Decimal(percentage)
                / Decimal("100")
            )
        else:
            advance_amount = quoted_amount

        if advance_amount <= 0:
            raise ValueError(
                "Advance payment amount must be "
                "greater than zero."
            )

    return (
        current_policy,
        current_confirmation_mode,
        quoted_amount,
        advance_amount,
        resolved_currency,
        percentage,
    )


def intervals_overlap(start_a: time, end_a: time, start_b: time, end_b: time) -> bool:
    return start_a < end_b and start_b < end_a


def add_minutes(base: time, minutes: int) -> time:
    combined = datetime.combine(date.today(), base) + timedelta(minutes=minutes)
    return combined.time()


def normalize_key(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")
    return normalized or None


def _format_policy_item(value: str) -> dict:
    selected = normalize_key(value)
    for item in public_booking_policy()["session_formats"]:
        if selected in {normalize_key(item.get("key")), normalize_key(item.get("label"))}:
            return item
    raise ValueError("Unsupported session format.")


def _resolve_location(value: str | None, *, requires_location: bool) -> str | None:
    if not requires_location:
        return None
    selected = normalize_key(value)
    if selected is None:
        raise ValueError("A location is required for in-person sessions.")
    for item in public_booking_policy()["locations"]:
        if selected in {normalize_key(item.get("key")), normalize_key(item.get("label"))}:
            return str(item["label"])
    raise ValueError("Unsupported booking location.")


def _supports_format(configured: str | None, session_format: str) -> bool:
    if not configured:
        return True
    configured_key = normalize_key(configured) or ""
    selected_key = normalize_key(session_format) or ""
    return selected_key in configured_key


def expire_stale_holds(
    db: Session,
    *,
    commit: bool = True,
) -> None:
    now = utc_now()
    stale_holds = db.scalars(
        select(BookingHold).where(
            BookingHold.status.in_(
                EXPIRABLE_HOLD_STATUSES
            ),
            BookingHold.expires_at <= now,
        )
    ).all()

    if not stale_holds:
        return

    for hold in stale_holds:
        hold.status = HOLD_STATUS_EXPIRED
        db.add(hold)

    if commit:
        db.commit()
    else:
        db.flush()


def _matches_filter(value: str | None, selected: str | None) -> bool:
    return selected is None or value is None or value == selected


def _matches_text_filter(value: str | None, selected: str | None) -> bool:
    return selected is None or value is None or normalize_key(value) == normalize_key(selected)


def acquire_booking_schedule_lock(
    db: Session,
    *,
    therapist_profile_id: str,
    schedule_date: date,
) -> BookingScheduleLock:
    values = {
        "id": str(uuid4()),
        "therapist_profile_id": (
            therapist_profile_id
        ),
        "schedule_date": schedule_date,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }

    dialect_name = db.get_bind().dialect.name

    if dialect_name == "postgresql":
        statement = (
            postgresql_insert(
                BookingScheduleLock
            )
            .values(**values)
            .on_conflict_do_nothing(
                index_elements=[
                    "therapist_profile_id",
                    "schedule_date",
                ]
            )
        )
        db.execute(statement)
    elif dialect_name == "sqlite":
        statement = (
            sqlite_insert(
                BookingScheduleLock
            )
            .values(**values)
            .on_conflict_do_nothing(
                index_elements=[
                    "therapist_profile_id",
                    "schedule_date",
                ]
            )
        )
        db.execute(statement)
    else:
        existing = db.scalar(
            select(BookingScheduleLock).where(
                BookingScheduleLock
                .therapist_profile_id
                == therapist_profile_id,
                BookingScheduleLock.schedule_date
                == schedule_date,
            )
        )

        if existing is None:
            try:
                with db.begin_nested():
                    db.add(
                        BookingScheduleLock(
                            **values
                        )
                    )
                    db.flush()
            except IntegrityError:
                pass

    db.execute(
        update(BookingScheduleLock)
        .where(
            BookingScheduleLock
            .therapist_profile_id
            == therapist_profile_id,
            BookingScheduleLock.schedule_date
            == schedule_date,
        )
        .values(updated_at=utc_now())
    )
    db.flush()

    lock = db.scalar(
        select(BookingScheduleLock)
        .where(
            BookingScheduleLock
            .therapist_profile_id
            == therapist_profile_id,
            BookingScheduleLock.schedule_date
            == schedule_date,
        )
        .with_for_update()
    )

    if lock is None:
        raise RuntimeError(
            "Booking schedule lock could not "
            "be acquired."
        )

    return lock


def _matching_blocked_exception(
    exceptions: list[AvailabilityException],
    *,
    start_time: time,
    end_time: time,
    service_id: str | None,
    therapist_profile_id: str | None,
) -> bool:
    for exception in exceptions:
        if exception.exception_type != "blocked":
            continue
        if not _matches_filter(exception.service_id, service_id):
            continue
        if not _matches_filter(exception.therapist_profile_id, therapist_profile_id):
            continue
        if exception.start_time is None or exception.end_time is None:
            return True
        if intervals_overlap(start_time, end_time, exception.start_time, exception.end_time):
            return True
    return False


def _matching_appointment(
    appointments: list[Appointment],
    *,
    start_time: time,
    end_time: time,
    service_id: str | None,
    therapist_profile_id: str | None,
) -> bool:
    for appointment in appointments:
        if appointment.status not in BLOCKING_APPOINTMENT_STATUSES:
            continue
        if not _matches_filter(appointment.therapist_profile_id, therapist_profile_id):
            continue
        if intervals_overlap(start_time, end_time, appointment.start_time, appointment.end_time):
            return True
    return False


def _matching_hold(
    holds: list[BookingHold],
    *,
    start_time: time,
    end_time: time,
    service_id: str | None,
    therapist_profile_id: str | None,
) -> bool:
    for hold in holds:
        if hold.status not in BLOCKING_HOLD_STATUSES:
            continue
        if not _matches_filter(hold.therapist_profile_id, therapist_profile_id):
            continue
        if intervals_overlap(start_time, end_time, hold.start_time, hold.end_time):
            return True
    return False


def _appointment_slot_has_conflict(
    db: Session,
    *,
    appointment_date: date,
    start_time: time,
    end_time: time,
    therapist_profile_id: str | None,
    exclude_appointment_id: str | None = None,
) -> bool:
    if therapist_profile_id is None:
        return False

    appointment_query = select(Appointment).where(
        Appointment.appointment_date
        == appointment_date,
        Appointment.therapist_profile_id
        == therapist_profile_id,
        Appointment.status.in_(
            BLOCKING_APPOINTMENT_STATUSES
        ),
    )

    if exclude_appointment_id is not None:
        appointment_query = appointment_query.where(
            Appointment.id
            != exclude_appointment_id
        )

    appointments = db.scalars(
        appointment_query
    ).all()

    holds = db.scalars(
        select(BookingHold).where(
            BookingHold.hold_date
            == appointment_date,
            BookingHold.therapist_profile_id
            == therapist_profile_id,
            BookingHold.status.in_(
                BLOCKING_HOLD_STATUSES
            ),
        )
    ).all()

    return any(
        intervals_overlap(
            start_time,
            end_time,
            appointment.start_time,
            appointment.end_time,
        )
        for appointment in appointments
    ) or any(
        intervals_overlap(
            start_time,
            end_time,
            hold.start_time,
            hold.end_time,
        )
        for hold in holds
    )


def _acquire_schedule_keys(
    db: Session,
    keys: set[tuple[str, date]],
) -> None:
    for therapist_profile_id, schedule_date in sorted(
        keys,
        key=lambda item: (
            item[1],
            item[0],
        ),
    ):
        acquire_booking_schedule_lock(
            db,
            therapist_profile_id=(
                therapist_profile_id
            ),
            schedule_date=schedule_date,
        )


def create_scheduled_appointment(
    db: Session,
    *,
    values: dict,
) -> Appointment:
    appointment_status = str(
        values.get("status", "requested")
    )
    therapist_profile_id = values.get(
        "therapist_profile_id"
    )
    appointment_date = values[
        "appointment_date"
    ]
    start_time = values["start_time"]
    end_time = values["end_time"]

    if (
        appointment_status
        in BLOCKING_APPOINTMENT_STATUSES
    ):
        _assert_future_slot(
            appointment_date,
            start_time,
        )

    try:
        if (
            appointment_status
            in BLOCKING_APPOINTMENT_STATUSES
            and therapist_profile_id
            is not None
        ):
            acquire_booking_schedule_lock(
                db,
                therapist_profile_id=str(
                    therapist_profile_id
                ),
                schedule_date=appointment_date,
            )

            expire_stale_holds(
                db,
                commit=False,
            )

            if _appointment_slot_has_conflict(
                db,
                appointment_date=(
                    appointment_date
                ),
                start_time=start_time,
                end_time=end_time,
                therapist_profile_id=str(
                    therapist_profile_id
                ),
            ):
                raise ValueError(
                    "This therapist already has an "
                    "overlapping appointment or "
                    "active booking hold."
                )

        appointment = Appointment(**values)
        db.add(appointment)
        db.commit()
        db.refresh(appointment)

        if (
            appointment.therapist_profile_id
            and appointment.status
            in {"requested", "confirmed"}
        ):
            notify_therapist_appointment(
                db,
                appointment=appointment,
                event="assigned",
            )

        return appointment
    except Exception:
        db.rollback()
        raise


def update_scheduled_appointment(
    db: Session,
    *,
    appointment_id: str,
    values: dict,
) -> Appointment | None:
    try:
        appointment = db.scalar(
            select(Appointment)
            .where(
                Appointment.id
                == appointment_id
            )
            .with_for_update()
        )

        if appointment is None:
            return None

        notification_before = (
            therapist_notification_snapshot(
                appointment
            )
        )

        current_status = appointment.status
        next_status = str(
            values.get(
                "status",
                current_status,
            )
        )

        if next_status != current_status:
            assert_appointment_status_transition(
                current_status,
                next_status,
            )

        next_date = values.get(
            "appointment_date",
            appointment.appointment_date,
        )
        next_start = values.get(
            "start_time",
            appointment.start_time,
        )
        next_end = values.get(
            "end_time",
            appointment.end_time,
        )
        next_therapist_id = values.get(
            "therapist_profile_id",
            appointment.therapist_profile_id,
        )

        if next_end <= next_start:
            raise ValueError(
                "end_time must be after "
                "start_time."
            )

        schedule_changed = any(
            key in values
            for key in (
                "appointment_date",
                "start_time",
                "end_time",
            )
        )
        activating_booking = (
            current_status
            not in BLOCKING_APPOINTMENT_STATUSES
            and next_status
            in BLOCKING_APPOINTMENT_STATUSES
        )

        if (
            next_status
            in BLOCKING_APPOINTMENT_STATUSES
            and (
                schedule_changed
                or activating_booking
            )
        ):
            _assert_future_slot(
                next_date,
                next_start,
            )

        schedule_keys: set[
            tuple[str, date]
        ] = set()

        if (
            appointment.status
            in BLOCKING_APPOINTMENT_STATUSES
            and appointment.therapist_profile_id
            is not None
        ):
            schedule_keys.add(
                (
                    appointment
                    .therapist_profile_id,
                    appointment
                    .appointment_date,
                )
            )

        if (
            next_status
            in BLOCKING_APPOINTMENT_STATUSES
            and next_therapist_id
            is not None
        ):
            schedule_keys.add(
                (
                    str(next_therapist_id),
                    next_date,
                )
            )

        _acquire_schedule_keys(
            db,
            schedule_keys,
        )

        expire_stale_holds(
            db,
            commit=False,
        )

        if (
            next_status
            in BLOCKING_APPOINTMENT_STATUSES
            and next_therapist_id
            is not None
            and _appointment_slot_has_conflict(
                db,
                appointment_date=next_date,
                start_time=next_start,
                end_time=next_end,
                therapist_profile_id=str(
                    next_therapist_id
                ),
                exclude_appointment_id=(
                    appointment.id
                ),
            )
        ):
            raise ValueError(
                "This therapist already has an "
                "overlapping appointment or "
                "active booking hold."
            )

        for key, value in values.items():
            setattr(
                appointment,
                key,
                value,
            )

        db.add(appointment)
        db.commit()
        db.refresh(appointment)

        notification_event = (
            therapist_notification_event(
                notification_before,
                appointment,
            )
        )

        if notification_event is not None:
            notify_therapist_appointment(
                db,
                appointment=appointment,
                event=notification_event,
            )

        return appointment
    except Exception:
        db.rollback()
        raise


def delete_scheduled_appointment(
    db: Session,
    *,
    appointment_id: str,
) -> bool:
    try:
        appointment = db.scalar(
            select(Appointment)
            .where(
                Appointment.id
                == appointment_id
            )
            .with_for_update()
        )

        if appointment is None:
            return False

        if (
            appointment.status
            in BLOCKING_APPOINTMENT_STATUSES
            and appointment.therapist_profile_id
            is not None
        ):
            acquire_booking_schedule_lock(
                db,
                therapist_profile_id=(
                    appointment
                    .therapist_profile_id
                ),
                schedule_date=(
                    appointment
                    .appointment_date
                ),
            )

        db.delete(appointment)
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise


def _service_slot_duration_minutes(
    db: Session,
    service_id: str | None,
) -> int | None:
    if service_id is None:
        return None

    service = db.get(
        Service,
        service_id,
    )

    if (
        service is None
        or service.duration_minutes is None
    ):
        return None

    duration = int(
        service.duration_minutes
    )

    return duration if duration > 0 else None


def list_bookable_slots(
    db: Session,
    *,
    slot_date: date,
    service_id: str | None = None,
    therapist_profile_id: str | None = None,
    session_format: str | None = None,
    location: str | None = None,
    manage_expiry: bool = True,
) -> list[BookableSlotRead]:
    if manage_expiry:
        expire_stale_holds(db)

    service_duration_minutes = (
        _service_slot_duration_minutes(
            db,
            service_id,
        )
    )

    rules = db.scalars(
        select(AvailabilityRule)
        .where(
            AvailabilityRule.is_active.is_(True),
            AvailabilityRule.is_public.is_(True),
            AvailabilityRule.day_of_week == slot_date.weekday(),
        )
        .order_by(AvailabilityRule.sort_order, AvailabilityRule.start_time)
    ).all()
    exceptions = db.scalars(
        select(AvailabilityException).where(
            AvailabilityException.is_active.is_(True),
            AvailabilityException.is_public.is_(True),
            AvailabilityException.date == slot_date,
        )
    ).all()
    appointments = db.scalars(
        select(Appointment).where(Appointment.appointment_date == slot_date)
    ).all()
    holds = db.scalars(
        select(BookingHold).where(
            BookingHold.hold_date == slot_date,
            BookingHold.status.in_(
                BLOCKING_HOLD_STATUSES
            ),
        )
    ).all()

    slots: list[BookableSlotRead] = []
    for rule in rules:
        if service_id is not None and rule.service_id not in (None, service_id):
            continue
        if therapist_profile_id is not None and rule.therapist_profile_id not in (
            None,
            therapist_profile_id,
        ):
            continue
        if not _matches_text_filter(rule.session_format, session_format):
            continue
        if not _matches_text_filter(rule.location, location):
            continue

        slot_duration_minutes = (
            service_duration_minutes
            or rule.slot_duration_minutes
        )

        slot_start = rule.start_time
        step_minutes = (
            slot_duration_minutes
            + rule.buffer_minutes
        )

        while True:
            slot_end = add_minutes(
                slot_start,
                slot_duration_minutes,
            )
            if slot_end > rule.end_time or slot_end <= slot_start:
                break
            blocked = (
                _matching_blocked_exception(
                    exceptions,
                    start_time=slot_start,
                    end_time=slot_end,
                    service_id=rule.service_id,
                    therapist_profile_id=rule.therapist_profile_id,
                )
                or _matching_appointment(
                    appointments,
                    start_time=slot_start,
                    end_time=slot_end,
                    service_id=rule.service_id,
                    therapist_profile_id=rule.therapist_profile_id,
                )
                or _matching_hold(
                    holds,
                    start_time=slot_start,
                    end_time=slot_end,
                    service_id=rule.service_id,
                    therapist_profile_id=rule.therapist_profile_id,
                )
            )
            if (
                not blocked
                and not _slot_has_started(
                    slot_date,
                    slot_start,
                )
            ):
                slots.append(
                    BookableSlotRead(
                        date=slot_date,
                        start_time=slot_start,
                        end_time=slot_end,
                        service_id=rule.service_id,
                        therapist_profile_id=rule.therapist_profile_id,
                        session_format=rule.session_format,
                        location=rule.location,
                        source="availability_rule",
                    )
                )
            next_start = add_minutes(slot_start, step_minutes)
            if next_start <= slot_start:
                break
            slot_start = next_start

    for exception in exceptions:
        if exception.exception_type != "available":
            continue
        if exception.start_time is None or exception.end_time is None:
            continue
        if service_id is not None and exception.service_id not in (None, service_id):
            continue
        if therapist_profile_id is not None and exception.therapist_profile_id not in (
            None,
            therapist_profile_id,
        ):
            continue
        blocked = _matching_appointment(
            appointments,
            start_time=exception.start_time,
            end_time=exception.end_time,
            service_id=exception.service_id,
            therapist_profile_id=exception.therapist_profile_id,
        ) or _matching_hold(
            holds,
            start_time=exception.start_time,
            end_time=exception.end_time,
            service_id=exception.service_id,
            therapist_profile_id=exception.therapist_profile_id,
        )
        if (
            not blocked
            and not _slot_has_started(
                slot_date,
                exception.start_time,
            )
        ):
            slots.append(
                BookableSlotRead(
                    date=slot_date,
                    start_time=exception.start_time,
                    end_time=exception.end_time,
                    service_id=exception.service_id,
                    therapist_profile_id=exception.therapist_profile_id,
                    session_format=session_format,
                    location=location,
                    source="availability_exception",
                )
            )

    return sorted(
        slots, key=lambda slot: (slot.start_time, slot.end_time, slot.therapist_profile_id or "")
    )


def _validate_public_booking_date(slot_date: date) -> None:
    today = _booking_local_now().date()
    if slot_date < today:
        raise ValueError("Booking date cannot be in the past.")
    if slot_date > today + timedelta(days=booking_window_days()):
        raise ValueError("Booking date is outside the configured booking window.")


def _published_service(db: Session, service_id: str, session_format: str) -> Service:
    service = db.scalar(
        select(Service).where(Service.id == service_id, Service.is_published.is_(True))
    )
    if service is None:
        raise ValueError("Selected service is not available.")
    if not _supports_format(service.service_format, session_format):
        raise ValueError("Selected service does not support this session format.")
    return service


def _published_therapists(db: Session, session_format: str) -> list[TherapistProfile]:
    profiles = db.scalars(
        select(TherapistProfile)
        .where(TherapistProfile.is_published.is_(True))
        .order_by(TherapistProfile.id)
    ).all()
    return [
        profile for profile in profiles if _supports_format(profile.session_formats, session_format)
    ]


def list_public_bookable_slots(
    db: Session,
    *,
    slot_date: date,
    service_id: str,
    session_format: str,
    location: str | None = None,
    preferred_therapist_profile_id: str | None = None,
) -> list[PublicBookableSlotRead]:
    _validate_public_booking_date(slot_date)
    format_item = _format_policy_item(session_format)
    format_label = str(format_item["label"])
    resolved_location = _resolve_location(
        location, requires_location=bool(format_item.get("requires_location"))
    )
    _published_service(db, service_id, format_label)

    raw_slots = list_bookable_slots(
        db,
        slot_date=slot_date,
        service_id=service_id,
        therapist_profile_id=preferred_therapist_profile_id,
        session_format=format_label,
        location=resolved_location,
    )
    published_ids = {item.id for item in _published_therapists(db, format_label)}
    if preferred_therapist_profile_id and preferred_therapist_profile_id not in published_ids:
        raise ValueError("Selected therapist is not available for this session format.")

    unique: dict[tuple, PublicBookableSlotRead] = {}
    for slot in raw_slots:
        if slot.therapist_profile_id is not None and slot.therapist_profile_id not in published_ids:
            continue
        key = (
            slot.date,
            slot.start_time,
            slot.end_time,
            normalize_key(format_label),
            resolved_location,
        )
        unique[key] = PublicBookableSlotRead(
            date=slot.date,
            start_time=slot.start_time,
            end_time=slot.end_time,
            session_format=format_label,
            location=resolved_location,
        )
    return sorted(unique.values(), key=lambda slot: (slot.start_time, slot.end_time))


def list_public_available_dates(
    db: Session,
    *,
    service_id: str,
    session_format: str,
    location: str | None = None,
    preferred_therapist_profile_id: str | None = None,
) -> list[PublicAvailableDateRead]:
    today = _booking_local_now().date()
    window_end = today + timedelta(days=booking_window_days())
    available_dates: list[PublicAvailableDateRead] = []

    current_date = today
    while current_date <= window_end:
        slots = list_public_bookable_slots(
            db,
            slot_date=current_date,
            service_id=service_id,
            session_format=session_format,
            location=location,
            preferred_therapist_profile_id=preferred_therapist_profile_id,
        )

        if slots:
            available_dates.append(
                PublicAvailableDateRead(
                    date=current_date,
                    available_slot_count=len(slots),
                    first_start_time=slots[0].start_time,
                )
            )

        current_date += timedelta(days=1)

    return available_dates


def is_slot_bookable(
    db: Session,
    *,
    slot_date: date,
    start_time: time,
    end_time: time,
    service_id: str | None,
    therapist_profile_id: str | None,
    session_format: str | None = None,
    location: str | None = None,
    manage_expiry: bool = True,
) -> bool:
    slots = list_bookable_slots(
        db,
        slot_date=slot_date,
        service_id=service_id,
        therapist_profile_id=(
            therapist_profile_id
        ),
        session_format=session_format,
        location=location,
        manage_expiry=manage_expiry,
    )

    return any(
        slot.start_time == start_time
        and slot.end_time == end_time
        and _matches_filter(
            slot.service_id,
            service_id,
        )
        and _matches_filter(
            slot.therapist_profile_id,
            therapist_profile_id,
        )
        for slot in slots
    )


def _candidate_therapists(
    db: Session,
    *,
    slot_date: date,
    start_time: time,
    end_time: time,
    service_id: str,
    session_format: str,
    location: str | None,
    preferred_therapist_profile_id: str | None,
) -> list[TherapistProfile]:
    profiles = _published_therapists(db, session_format)
    by_id = {profile.id: profile for profile in profiles}
    raw_slots = list_bookable_slots(
        db,
        slot_date=slot_date,
        service_id=service_id,
        therapist_profile_id=preferred_therapist_profile_id,
        session_format=session_format,
        location=location,
    )
    exact = [
        slot for slot in raw_slots if slot.start_time == start_time and slot.end_time == end_time
    ]
    candidate_ids: set[str] = set()
    for slot in exact:
        if slot.therapist_profile_id is None:
            candidate_ids.update(by_id)
        elif slot.therapist_profile_id in by_id:
            candidate_ids.add(slot.therapist_profile_id)

    if preferred_therapist_profile_id:
        if preferred_therapist_profile_id not in candidate_ids:
            raise ValueError("Selected therapist is not available for this slot.")
        return [by_id[preferred_therapist_profile_id]]
    return [by_id[item_id] for item_id in sorted(candidate_ids)]


def allocate_therapist(
    db: Session,
    *,
    slot_date: date,
    start_time: time,
    end_time: time,
    service_id: str,
    session_format: str,
    location: str | None,
    preferred_therapist_profile_id: str | None,
) -> TherapistProfile:
    candidates = _candidate_therapists(
        db,
        slot_date=slot_date,
        start_time=start_time,
        end_time=end_time,
        service_id=service_id,
        session_format=session_format,
        location=location,
        preferred_therapist_profile_id=preferred_therapist_profile_id,
    )
    if not candidates:
        raise ValueError("Selected slot is no longer available.")
    if preferred_therapist_profile_id:
        return candidates[0]

    window_end = slot_date + timedelta(days=allocation_window_days())
    appointments = db.scalars(
        select(Appointment).where(
            Appointment.therapist_profile_id.in_([item.id for item in candidates]),
            Appointment.status.in_(BLOCKING_APPOINTMENT_STATUSES),
            Appointment.appointment_date >= slot_date,
            Appointment.appointment_date <= window_end,
        )
    ).all()
    workload: dict[str, int] = defaultdict(int)
    for appointment in appointments:
        if appointment.therapist_profile_id:
            workload[appointment.therapist_profile_id] += 1
    return min(candidates, key=lambda item: (workload[item.id], item.id))


def create_hold(
    db: Session,
    *,
    hold_date: date,
    start_time: time,
    end_time: time,
    service_id: str | None,
    therapist_profile_id: str | None,
    session_format: str | None,
    location: str | None,
    client_name: str | None,
    client_email: str | None,
    client_phone: str | None,
    payment_policy_snapshot: str | None = None,
    confirmation_mode_snapshot: str | None = None,
    quoted_price_amount: Decimal | None = None,
    advance_payment_amount: Decimal | None = None,
    payment_currency: str | None = None,
    deposit_percentage_snapshot: int | None = None,
    hold_minutes: int = DEFAULT_HOLD_MINUTES,
    commit: bool = True,
) -> BookingHold:
    try:
        _assert_future_slot(
            hold_date,
            start_time,
        )

        if therapist_profile_id is not None:
            acquire_booking_schedule_lock(
                db,
                therapist_profile_id=(
                    therapist_profile_id
                ),
                schedule_date=hold_date,
            )

        expire_stale_holds(
            db,
            commit=False,
        )

        db.expire_all()

        if not is_slot_bookable(
            db,
            slot_date=hold_date,
            start_time=start_time,
            end_time=end_time,
            service_id=service_id,
            therapist_profile_id=(
                therapist_profile_id
            ),
            session_format=session_format,
            location=location,
            manage_expiry=False,
        ):
            raise ValueError(
                "Selected slot is not bookable."
            )

        hold = BookingHold(
            hold_date=hold_date,
            start_time=start_time,
            end_time=end_time,
            service_id=service_id,
            therapist_profile_id=(
                therapist_profile_id
            ),
            session_format=session_format,
            location=location,
            client_name=client_name,
            client_email=client_email,
            client_phone=client_phone,
            payment_policy_snapshot=(
                payment_policy_snapshot
            ),
            confirmation_mode_snapshot=(
                confirmation_mode_snapshot
            ),
            quoted_price_amount=(
                quoted_price_amount
            ),
            advance_payment_amount=(
                advance_payment_amount
            ),
            payment_currency=payment_currency,
            deposit_percentage_snapshot=(
                deposit_percentage_snapshot
            ),
            status=initial_hold_status(
                payment_policy_snapshot
                or payment_policy()
            ),
            expires_at=(
                utc_now()
                + timedelta(minutes=hold_minutes)
            ),
        )

        db.add(hold)

        if commit:
            db.commit()
            db.refresh(hold)
        else:
            db.flush()

        return hold
    except Exception:
        if commit:
            db.rollback()
        raise


def create_public_hold(
    db: Session,
    *,
    hold_date: date,
    start_time: time,
    end_time: time,
    service_id: str,
    preferred_therapist_profile_id: str | None,
    session_format: str,
    location: str | None,
    client_name: str,
    client_email: str,
    client_phone: str | None,
    commit: bool = True,
) -> BookingHold:
    _validate_public_booking_date(hold_date)

    format_item = _format_policy_item(
        session_format
    )
    format_label = str(format_item["label"])

    resolved_location = _resolve_location(
        location,
        requires_location=bool(
            format_item.get(
                "requires_location"
            )
        ),
    )

    service_record = _published_service(
        db,
        service_id,
        format_label,
    )

    (
        current_payment_policy,
        current_confirmation_mode,
        quoted_price_amount,
        advance_payment_amount,
        payment_currency,
        deposit_percentage_snapshot,
    ) = resolve_booking_payment_terms(
        db,
        service_record,
    )

    attempted_therapist_ids: set[str] = set()

    while True:
        therapist = allocate_therapist(
            db,
            slot_date=hold_date,
            start_time=start_time,
            end_time=end_time,
            service_id=service_id,
            session_format=format_label,
            location=resolved_location,
            preferred_therapist_profile_id=(
                preferred_therapist_profile_id
            ),
        )

        if therapist.id in attempted_therapist_ids:
            raise ValueError(
                "Selected slot is no longer "
                "available."
            )

        attempted_therapist_ids.add(
            therapist.id
        )

        try:
            return create_hold(
                db,
                hold_date=hold_date,
                start_time=start_time,
                end_time=end_time,
                service_id=service_id,
                therapist_profile_id=(
                    therapist.id
                ),
                session_format=format_label,
                location=resolved_location,
                client_name=client_name,
                client_email=client_email,
                client_phone=client_phone,
                payment_policy_snapshot=(
                    current_payment_policy
                ),
                confirmation_mode_snapshot=(
                    current_confirmation_mode
                ),
                quoted_price_amount=(
                    quoted_price_amount
                ),
                advance_payment_amount=(
                    advance_payment_amount
                ),
                payment_currency=payment_currency,
                deposit_percentage_snapshot=(
                    deposit_percentage_snapshot
                ),
                hold_minutes=(
                    configured_hold_minutes()
                ),
                commit=commit,
            )
        except ValueError as exc:
            if (
                preferred_therapist_profile_id
                is not None
            ):
                raise

            if (
                str(exc)
                != "Selected slot is not bookable."
            ):
                raise

            # Another request may have won this
            # therapist while other therapists
            # remain available. Recalculate.
            continue



def create_public_hold_payment_request(
    db: Session,
    *,
    hold_id: str,
    customer_email: str,
) -> PaymentRequest:
    normalized_email = (
        customer_email.strip().lower()
    )

    hold = db.scalar(
        select(BookingHold).where(
            BookingHold.id == hold_id
        )
    )

    if (
        hold is None
        or hold.client_email is None
        or (
            hold.client_email.strip().lower()
            != normalized_email
        )
    ):
        raise LookupError(
            "Booking hold not found."
        )

    if hold.therapist_profile_id is None:
        raise ValueError(
            "Booking hold is missing its "
            "therapist allocation."
        )

    try:
        acquire_booking_schedule_lock(
            db,
            therapist_profile_id=(
                hold.therapist_profile_id
            ),
            schedule_date=hold.hold_date,
        )

        hold = db.scalar(
            select(BookingHold)
            .where(BookingHold.id == hold_id)
            .execution_options(
                populate_existing=True
            )
        )

        if (
            hold is None
            or hold.client_email is None
            or (
                hold.client_email.strip().lower()
                != normalized_email
            )
        ):
            raise LookupError(
                "Booking hold not found."
            )

        now = utc_now()

        if hold.expires_at <= now:
            if hold.status in {
                "active",
                "payment_pending",
            }:
                hold.status = "expired"
                db.add(hold)
                db.commit()

            raise ValueError(
                "Booking hold has expired."
            )

        if hold.status != "payment_pending":
            raise ValueError(
                "Booking hold is not awaiting "
                "payment."
            )

        if hold.payment_policy_snapshot not in {
            "deposit",
            "full_upfront",
        }:
            raise ValueError(
                "Booking hold does not require "
                "advance payment."
            )

        amount = hold.advance_payment_amount
        currency = hold.payment_currency

        if amount is None or amount <= 0:
            raise ValueError(
                "Booking hold is missing a valid "
                "advance-payment amount."
            )

        if (
            currency is None
            or len(currency.strip()) != 3
            or not currency.strip().isalpha()
        ):
            raise ValueError(
                "Booking hold is missing a valid "
                "payment currency."
            )

        normalized_currency = (
            currency.strip().upper()
        )

        if normalized_currency != "KES":
            raise ValueError(
                "M-Pesa booking payments "
                "require KES."
            )

        settlement_amount = amount.quantize(
            Decimal("1"),
            rounding=ROUND_HALF_UP,
        ).quantize(
            Decimal("0.01")
        )

        if settlement_amount <= 0:
            raise ValueError(
                "The M-Pesa settlement amount "
                "must be at least KES 1."
            )

        creation_event_notes = (
            "Payment request created from "
            "booking hold."
        )

        if settlement_amount != amount:
            creation_event_notes += (
                f" Frozen amount {amount:.2f} KES "
                f"was rounded to "
                f"{settlement_amount:.2f} KES "
                "for M-Pesa settlement."
            )

        if (
            hold.client_name is None
            or not hold.client_name.strip()
        ):
            raise ValueError(
                "Booking hold is missing the "
                "customer name."
            )

        returnable_statuses = tuple(
            sorted(
                ACTIVE_PAYMENT_REQUEST_STATUSES
                | {"paid"}
            )
        )

        existing = db.scalar(
            select(PaymentRequest)
            .where(
                PaymentRequest.target_type
                == "booking_hold",
                PaymentRequest.target_id
                == hold.id,
                PaymentRequest.status.in_(
                    returnable_statuses
                ),
            )
            .order_by(
                PaymentRequest.created_at.desc()
            )
        )

        if existing is not None:
            db.commit()
            db.refresh(existing)

            return attach_events(
                existing,
                get_payment_request_events(
                    db,
                    existing.id,
                ),
            )

        payment_request = PaymentRequest(
            request_number=(
                generate_payment_request_number()
            ),
            commerce_order_id=None,
            target_type="booking_hold",
            target_id=hold.id,
            customer_name=hold.client_name.strip(),
            customer_email=(
                hold.client_email.strip()
            ),
            customer_phone=hold.client_phone,
            amount=settlement_amount,
            currency=normalized_currency,
            provider="mpesa",
            provider_reference=None,
            settlement_account_label=None,
            status="pending",
            description=(
                "Advance payment for booking hold."
            ),
            admin_notes=None,
            expires_at=hold.expires_at,
            paid_at=None,
            cancelled_at=None,
            created_by_user_id=None,
        )

        db.add(payment_request)
        db.flush()

        create_payment_request_event(
            db,
            payment_request=payment_request,
            event_type=(
                "payment_request.created"
            ),
            from_status=None,
            to_status="pending",
            actor_user_id=None,
            notes=creation_event_notes,
        )

        db.add(payment_request)
        db.commit()
        db.refresh(payment_request)

        return attach_events(
            payment_request,
            get_payment_request_events(
                db,
                payment_request.id,
            ),
        )
    except Exception:
        db.rollback()
        raise

def create_public_booking(
    db: Session,
    *,
    hold_date: date,
    start_time: time,
    end_time: time,
    service_id: str,
    preferred_therapist_profile_id: str | None,
    session_format: str,
    location: str | None,
    client_name: str,
    client_email: str,
    client_phone: str | None,
    client_message: str | None,
) -> PublicBookingConfirmationRead:
    try:
        hold = create_public_hold(
            db,
            hold_date=hold_date,
            start_time=start_time,
            end_time=end_time,
            service_id=service_id,
            preferred_therapist_profile_id=(
                preferred_therapist_profile_id
            ),
            session_format=session_format,
            location=location,
            client_name=client_name,
            client_email=client_email,
            client_phone=client_phone,
            commit=False,
        )

        frozen_payment_policy = (
            hold.payment_policy_snapshot
        )

        if frozen_payment_policy is None:
            raise ValueError(
                "Booking hold is missing its "
                "payment policy snapshot."
            )

        if requires_advance_payment(
            frozen_payment_policy
        ):
            raise ValueError(
                "Advance payment is required before "
                "this booking can be confirmed."
            )

        confirmation = confirm_public_hold(
            db,
            hold_id=hold.id,
            client_message=client_message,
            commit=False,
        )

        db.commit()
        _notify_therapist_for_confirmation(
            db,
            confirmation,
        )
        return confirmation
    except Exception:
        db.rollback()
        raise




BOOKING_SETTLEMENT_REVIEW_EVENT_TYPE = (
    "payment_request."
    "booking_settlement_review_required"
)


def record_booking_payment_settlement_review(
    db: Session,
    *,
    payment_request_id: str,
    reason: str,
) -> PaymentRequestEvent:
    payment_request = db.scalar(
        select(PaymentRequest)
        .where(
            PaymentRequest.id
            == payment_request_id
        )
        .with_for_update()
    )

    if (
        payment_request is None
        or payment_request.target_type
        != "booking_hold"
    ):
        raise LookupError(
            "Booking payment request not found."
        )

    if payment_request.status != "paid":
        raise ValueError(
            "Only paid booking payment requests "
            "can require settlement review."
        )

    existing = db.scalar(
        select(PaymentRequestEvent)
        .where(
            PaymentRequestEvent.payment_request_id
            == payment_request.id,
            PaymentRequestEvent.event_type
            == BOOKING_SETTLEMENT_REVIEW_EVENT_TYPE,
        )
        .order_by(
            PaymentRequestEvent.created_at.desc()
        )
    )

    if existing is not None:
        db.commit()
        db.refresh(existing)
        return existing

    normalized_reason = (
        reason.strip()
        or (
            "Automatic booking conversion could "
            "not be completed."
        )
    )

    review_notes = (
        "Payment was verified, but automatic "
        "booking conversion could not be "
        "completed. "
        f"Reason: {normalized_reason} "
        "Review the hold and appointment "
        "schedule, then complete the booking "
        "manually or issue a refund."
    )

    hold = db.scalar(
        select(BookingHold).where(
            BookingHold.id
            == payment_request.target_id
        )
    )

    if (
        hold is not None
        and hold.status == "payment_pending"
        and hold.expires_at <= utc_now()
    ):
        assert_hold_status_transition(
            hold.status,
            "expired",
        )
        hold.status = "expired"
        db.add(hold)

    admin_marker = (
        "Verified M-Pesa payment requires "
        "booking settlement review."
    )

    current_admin_notes = (
        payment_request.admin_notes or ""
    ).strip()

    if admin_marker not in current_admin_notes:
        payment_request.admin_notes = (
            (
                current_admin_notes
                + "\n\n"
            )
            if current_admin_notes
            else ""
        ) + (
            f"{admin_marker} "
            f"{normalized_reason} "
            "Resolve manually or issue a refund."
        )

    event = create_payment_request_event(
        db,
        payment_request=payment_request,
        event_type=(
            BOOKING_SETTLEMENT_REVIEW_EVENT_TYPE
        ),
        from_status=payment_request.status,
        to_status=payment_request.status,
        actor_user_id=None,
        notes=review_notes,
    )

    db.add(payment_request)
    db.commit()
    db.refresh(event)

    return event

def settle_paid_booking_payment_request(
    db: Session,
    *,
    payment_request_id: str,
) -> PublicBookingConfirmationRead:
    """
    Convert a verified paid booking payment request.

    Payment-provider verification remains outside the
    booking engine. This handler accepts only a request
    already marked paid by the generic payment layer.
    """
    payment_request = db.scalar(
        select(PaymentRequest).where(
            PaymentRequest.id
            == payment_request_id
        )
    )

    if (
        payment_request is None
        or payment_request.target_type
        != "booking_hold"
    ):
        raise LookupError(
            "Booking payment request not found."
        )

    if payment_request.status != "paid":
        raise ValueError(
            "Booking payment request is not paid."
        )

    hold = db.scalar(
        select(BookingHold).where(
            BookingHold.id
            == payment_request.target_id
        )
    )

    if hold is None:
        raise LookupError(
            "Booking hold not found."
        )

    if hold.therapist_profile_id is None:
        raise ValueError(
            "Paid booking hold is missing its "
            "therapist allocation and requires "
            "review."
        )

    try:
        acquire_booking_schedule_lock(
            db,
            therapist_profile_id=(
                hold.therapist_profile_id
            ),
            schedule_date=hold.hold_date,
        )

        db.expire_all()

        payment_request = db.scalar(
            select(PaymentRequest)
            .where(
                PaymentRequest.id
                == payment_request_id
            )
            .with_for_update()
        )

        if (
            payment_request is None
            or payment_request.target_type
            != "booking_hold"
        ):
            raise LookupError(
                "Booking payment request not found."
            )

        if payment_request.status != "paid":
            raise ValueError(
                "Booking payment request is not paid."
            )

        hold = db.scalar(
            select(BookingHold)
            .where(
                BookingHold.id
                == payment_request.target_id
            )
            .with_for_update()
        )

        if hold is None:
            raise LookupError(
                "Booking hold not found."
            )

        if (
            hold.status == HOLD_STATUS_CONVERTED
            and hold.appointment_id
        ):
            appointment = db.scalar(
                select(Appointment).where(
                    Appointment.id
                    == hold.appointment_id
                )
            )

            if appointment is None:
                raise ValueError(
                    "Converted paid booking hold is "
                    "missing its appointment and "
                    "requires review."
                )

            db.commit()
            return _confirmation(appointment)

        if hold.status == "payment_pending":
            if hold.expires_at <= utc_now():
                raise ValueError(
                    "Paid booking hold has expired "
                    "and requires review."
                )

            assert_hold_status_transition(
                hold.status,
                "payment_verified",
            )

            hold.status = "payment_verified"
            db.add(hold)
            db.flush()

        elif hold.status != "payment_verified":
            raise ValueError(
                "Paid booking hold is not eligible "
                "for automatic conversion and "
                "requires review."
            )

        confirmation = confirm_public_hold(
            db,
            hold_id=hold.id,
            client_message=None,
            commit=False,
        )

        db.commit()
        _notify_therapist_for_confirmation(
            db,
            confirmation,
        )
        return confirmation

    except Exception:
        db.rollback()
        raise

def confirm_public_hold(
    db: Session,
    *,
    hold_id: str,
    client_message: str | None,
    commit: bool = True,
) -> PublicBookingConfirmationRead:
    expire_stale_holds(
        db,
        commit=False,
    )
    hold = db.scalar(select(BookingHold).where(BookingHold.id == hold_id))
    if hold is None:
        raise ValueError("Booking hold not found.")

    if hold.therapist_profile_id is not None:
        acquire_booking_schedule_lock(
            db,
            therapist_profile_id=(
                hold.therapist_profile_id
            ),
            schedule_date=hold.hold_date,
        )

        db.expire_all()

        hold = db.scalar(
            select(BookingHold).where(
                BookingHold.id == hold_id
            )
        )

        if hold is None:
            raise ValueError(
                "Booking hold not found."
            )
    if hold.status == HOLD_STATUS_CONVERTED and hold.appointment_id:
        appointment = db.scalar(select(Appointment).where(Appointment.id == hold.appointment_id))
        if appointment is not None:
            return _confirmation(appointment)
    _assert_future_slot(
        hold.hold_date,
        hold.start_time,
    )

    current_payment_policy = (
        hold.payment_policy_snapshot
        or payment_policy()
    )
    current_confirmation_mode = (
        hold.confirmation_mode_snapshot
        or confirmation_mode()
    )

    if (
        hold.status not in BLOCKING_HOLD_STATUSES
        or hold.expires_at <= utc_now()
    ):
        raise ValueError(
            "Booking hold has expired or is no longer active."
        )

    if not hold_can_confirm(
        hold.status,
        current_payment_policy,
    ):
        if requires_advance_payment(
            current_payment_policy
        ):
            raise ValueError(
                "Payment must be verified before "
                "booking confirmation."
            )

        raise ValueError(
            "Booking hold is not ready for confirmation."
        )
    if not all([hold.client_name, hold.client_email, hold.service_id, hold.therapist_profile_id]):
        raise ValueError("Booking hold is incomplete.")

    existing = db.scalars(
        select(Appointment).where(Appointment.appointment_date == hold.hold_date)
    ).all()
    if _matching_appointment(
        existing,
        start_time=hold.start_time,
        end_time=hold.end_time,
        service_id=hold.service_id,
        therapist_profile_id=hold.therapist_profile_id,
    ):
        raise ValueError("Selected slot is no longer available.")

    appointment = Appointment(
        appointment_date=hold.hold_date,
        start_time=hold.start_time,
        end_time=hold.end_time,
        client_name=hold.client_name,
        client_email=hold.client_email,
        client_phone=hold.client_phone,
        service_id=hold.service_id,
        therapist_profile_id=hold.therapist_profile_id,
        status=appointment_status_for_confirmation_mode(
            current_confirmation_mode
        ),
        session_format=hold.session_format,
        location=hold.location,
        client_message=client_message,
        admin_notes=None,
        source="public_request",
        sort_order=0,
    )
    db.add(appointment)
    db.flush()
    hold.status = HOLD_STATUS_CONVERTED
    hold.appointment_id = appointment.id
    db.add(hold)

    if commit:
        db.commit()
        db.refresh(appointment)

        notify_therapist_appointment(
            db,
            appointment=appointment,
            event="assigned",
        )
    else:
        db.flush()

    return _confirmation(appointment)


def _confirmation(appointment: Appointment) -> PublicBookingConfirmationRead:
    return PublicBookingConfirmationRead(
        appointment_id=appointment.id,
        appointment_date=appointment.appointment_date,
        start_time=appointment.start_time,
        end_time=appointment.end_time,
        status=appointment.status,
        session_format=appointment.session_format,
        location=appointment.location,
        therapist_profile_id=appointment.therapist_profile_id,
    )
