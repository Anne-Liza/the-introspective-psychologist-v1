from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.booking_policy import public_booking_policy
from app.core.database import get_db
from app.core.rate_limit import enforce_public_action_rate_limit
from app.modules.auth.dependencies import require_permission
from app.modules.booking_engine.models import (
    BookingHold,
    BookingSetting,
)
from app.modules.booking_engine.schemas import (
    BookingHoldRead,
    BookingHoldUpdate,
    BookingSettingsRead,
    BookingSettingsUpdate,
    PublicAvailableDateRead,
    PublicBookableSlotRead,
    PublicBookingConfigRead,
    PublicBookingConfirm,
    PublicBookingConfirmationRead,
    PublicBookingCreate,
    PublicBookingHoldCreate,
    PublicBookingHoldRead,
    PublicBookingPaymentRequestCreate,
)
from app.modules.booking_engine.service import (
    confirm_public_hold,
    create_public_booking,
    create_public_hold,
    create_public_hold_payment_request,
    expire_stale_holds,
    list_public_available_dates,
    list_public_bookable_slots,
)
from app.modules.payment_requests.schemas import PaymentRequestRead
from app.modules.users.models import User

router = APIRouter()


def serialize_booking_settings(
    setting: BookingSetting | None,
) -> BookingSettingsRead:
    if setting is None:
        policy = public_booking_policy()

        return BookingSettingsRead(
            payment_policy=policy["payment_policy"],
            deposit_percentage=policy[
                "deposit_percentage"
            ],
            confirmation_mode=policy[
                "confirmation_mode"
            ],
            recommended_payment_provider=policy.get(
                "recommended_payment_provider"
            ),
            source="profile",
        )

    return BookingSettingsRead(
        payment_policy=setting.payment_policy,
        deposit_percentage=setting.deposit_percentage,
        confirmation_mode=setting.confirmation_mode,
        recommended_payment_provider=(
            setting.recommended_payment_provider
        ),
        source="database",
    )


@router.get(
    "/settings",
    response_model=BookingSettingsRead,
)
def get_booking_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("booking_engine.read")
    ),
):
    return serialize_booking_settings(
        db.get(
            BookingSetting,
            "practice-default",
        )
    )


@router.put(
    "/settings",
    response_model=BookingSettingsRead,
)
def update_booking_settings(
    payload: BookingSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("booking_engine.update")
    ),
):
    setting = db.get(
        BookingSetting,
        "practice-default",
    )
    values = payload.model_dump()

    if setting is None:
        setting = BookingSetting(
            id="practice-default",
            **values,
        )
    else:
        for key, value in values.items():
            setattr(setting, key, value)

    db.add(setting)
    db.commit()
    db.refresh(setting)

    return serialize_booking_settings(setting)


@router.get("/public/config", response_model=PublicBookingConfigRead)
def get_public_booking_config(db: Session = Depends(get_db)):
    policy = public_booking_policy()
    setting = db.get(
        BookingSetting,
        "practice-default",
    )

    if setting is None:
        return policy

    policy.update(
        payment_policy=setting.payment_policy,
        deposit_percentage=setting.deposit_percentage,
        confirmation_mode=setting.confirmation_mode,
        recommended_payment_provider=(
            setting.recommended_payment_provider
        ),
        payment_before_booking=(
            setting.payment_policy
            in {"deposit", "full_upfront"}
        ),
    )

    return policy


@router.get(
    "/public/available-dates",
    response_model=list[PublicAvailableDateRead],
)
def get_public_available_dates(
    service_id: str = Query(...),
    session_format: str = Query(...),
    location: str | None = None,
    preferred_therapist_profile_id: str | None = None,
    db: Session = Depends(get_db),
):
    try:
        return list_public_available_dates(
            db,
            service_id=service_id,
            session_format=session_format,
            location=location,
            preferred_therapist_profile_id=preferred_therapist_profile_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.get("/public/slots", response_model=list[PublicBookableSlotRead])
def get_public_bookable_slots(
    date: date = Query(...),
    service_id: str = Query(...),
    session_format: str = Query(...),
    location: str | None = None,
    preferred_therapist_profile_id: str | None = None,
    db: Session = Depends(get_db),
):
    try:
        return list_public_bookable_slots(
            db,
            slot_date=date,
            service_id=service_id,
            session_format=session_format,
            location=location,
            preferred_therapist_profile_id=preferred_therapist_profile_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc


@router.post(
    "/public/bookings",
    response_model=PublicBookingConfirmationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_public_booking_request(
    payload: PublicBookingCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_public_action_rate_limit(
        request,
        scope="appointment_request",
    )

    try:
        return create_public_booking(
            db,
            **payload.model_dump(),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.post(
    "/public/holds", response_model=PublicBookingHoldRead, status_code=status.HTTP_201_CREATED
)
def create_public_booking_hold(
    payload: PublicBookingHoldCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_public_action_rate_limit(request, scope="booking_hold")
    try:
        return create_public_hold(db, **payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post(
    "/public/holds/{hold_id}/payment-request",
    response_model=PaymentRequestRead,
    status_code=status.HTTP_201_CREATED,
)
def create_public_booking_hold_payment_request(
    hold_id: str,
    payload: PublicBookingPaymentRequestCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_public_action_rate_limit(
        request,
        scope="checkout_payment",
    )

    try:
        return create_public_hold_payment_request(
            db,
            hold_id=hold_id,
            customer_email=payload.customer_email,
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking hold not found.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.post(
    "/public/holds/{hold_id}/confirm",
    response_model=PublicBookingConfirmationRead,
    status_code=status.HTTP_201_CREATED,
)
def confirm_public_booking_hold(
    hold_id: str,
    payload: PublicBookingConfirm,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_public_action_rate_limit(request, scope="appointment_request")
    try:
        return confirm_public_hold(db, hold_id=hold_id, client_message=payload.client_message)
    except ValueError as exc:
        message = str(exc)
        code = (
            status.HTTP_404_NOT_FOUND
            if message == "Booking hold not found."
            else status.HTTP_409_CONFLICT
        )
        raise HTTPException(status_code=code, detail=message) from exc


@router.get("/holds", response_model=list[BookingHoldRead])
def list_booking_holds(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("booking_engine.read")),
):
    expire_stale_holds(db)
    return db.scalars(
        select(BookingHold).order_by(
            BookingHold.hold_date.desc(),
            BookingHold.start_time,
            BookingHold.created_at.desc(),
        )
    ).all()


@router.patch("/holds/{hold_id}", response_model=BookingHoldRead)
def update_booking_hold(
    hold_id: str,
    payload: BookingHoldUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("booking_engine.update")),
):
    hold = db.scalar(select(BookingHold).where(BookingHold.id == hold_id))
    if hold is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking hold not found.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(hold, key, value)
    db.add(hold)
    db.commit()
    db.refresh(hold)
    return hold


@router.delete("/holds/{hold_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_booking_hold(
    hold_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("booking_engine.delete")),
):
    hold = db.scalar(select(BookingHold).where(BookingHold.id == hold_id))
    if hold is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking hold not found.")
    db.delete(hold)
    db.commit()
    return None
