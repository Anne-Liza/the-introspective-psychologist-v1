from datetime import date as date_type
from datetime import datetime
from datetime import time as time_type
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, field_validator, model_validator

from app.core.booking_state import VALID_HOLD_STATUSES


def normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def validate_email(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if not normalized:
        return None
    if "@" not in normalized or "." not in normalized.rsplit("@", 1)[-1]:
        raise ValueError("client_email must be a valid email address.")
    return normalized


class BookingFormatRead(BaseModel):
    key: str
    label: str
    requires_location: bool = False


class BookingLocationRead(BaseModel):
    key: str
    label: str


class PublicBookingConfigRead(BaseModel):
    booking_mode: str
    client_accounts_required: bool
    session_formats: list[BookingFormatRead]
    locations: list[BookingLocationRead]
    therapist_selection: str
    allocation_mode: str
    hold_minutes: int
    booking_window_days: int
    payment_policy: Literal[
        "none",
        "pay_later",
        "deposit",
        "full_upfront",
    ]
    deposit_percentage: int | None = None
    confirmation_mode: Literal[
        "instant",
        "staff_approval",
    ]
    payment_before_booking: bool
    recommended_payment_provider: str | None = None


class BookableSlotRead(BaseModel):
    date: date_type
    start_time: time_type
    end_time: time_type
    service_id: str | None = None
    therapist_profile_id: str | None = None
    session_format: str | None = None
    location: str | None = None
    source: str = "availability_rule"


class PublicBookableSlotRead(BaseModel):
    date: date_type
    start_time: time_type
    end_time: time_type
    session_format: str
    location: str | None = None


class PublicAvailableDateRead(BaseModel):
    date: date_type
    available_slot_count: int
    first_start_time: time_type


class BookingHoldCreate(BaseModel):
    hold_date: date_type
    start_time: time_type
    end_time: time_type
    service_id: str | None = None
    therapist_profile_id: str | None = None
    session_format: str | None = None
    location: str | None = None
    client_name: str | None = None
    client_email: str | None = None
    client_phone: str | None = None

    @field_validator(
        "service_id",
        "therapist_profile_id",
        "session_format",
        "location",
        "client_name",
        "client_phone",
    )
    @classmethod
    def validate_optional_text_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @field_validator("client_email")
    @classmethod
    def validate_client_email(cls, value: str | None) -> str | None:
        return validate_email(value)

    @model_validator(mode="after")
    def validate_time_window(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time.")
        return self


class PublicBookingHoldCreate(BaseModel):
    hold_date: date_type
    start_time: time_type
    end_time: time_type
    service_id: str
    preferred_therapist_profile_id: str | None = None
    session_format: str
    location: str | None = None
    client_name: str
    client_email: str
    client_phone: str | None = None

    @field_validator(
        "service_id",
        "preferred_therapist_profile_id",
        "session_format",
        "location",
        "client_name",
        "client_phone",
    )
    @classmethod
    def validate_text_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @field_validator("client_email")
    @classmethod
    def validate_public_client_email(cls, value: str) -> str:
        normalized = validate_email(value)
        if normalized is None:
            raise ValueError("client_email is required.")
        return normalized

    @model_validator(mode="after")
    def validate_public_hold(self):
        if not self.service_id or not self.session_format or not self.client_name:
            raise ValueError("service_id, session_format, and client_name are required.")
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time.")
        return self


class PublicBookingCreate(PublicBookingHoldCreate):
    client_message: str | None = None

    @field_validator("client_message")
    @classmethod
    def validate_client_message(
        cls,
        value: str | None,
    ) -> str | None:
        return normalize_optional_text(value)


class PublicBookingPaymentRequestCreate(BaseModel):
    customer_email: str

    @field_validator("customer_email")
    @classmethod
    def validate_customer_email(
        cls,
        value: str,
    ) -> str:
        normalized = validate_email(value)

        if normalized is None:
            raise ValueError("customer_email is required.")

        return normalized


class PublicBookingHoldRead(BaseModel):
    id: str
    hold_date: date_type
    start_time: time_type
    end_time: time_type
    session_format: str | None = None
    location: str | None = None
    status: str
    expires_at: datetime
    payment_policy_snapshot: (
        Literal[
            "none",
            "pay_later",
            "deposit",
            "full_upfront",
        ]
        | None
    ) = None
    confirmation_mode_snapshot: (
        Literal[
            "instant",
            "staff_approval",
        ]
        | None
    ) = None
    quoted_price_amount: Decimal | None = None
    advance_payment_amount: Decimal | None = None
    payment_currency: str | None = None
    deposit_percentage_snapshot: int | None = None

    model_config = {"from_attributes": True}


class PublicBookingConfirm(BaseModel):
    client_message: str | None = None

    @field_validator("client_message")
    @classmethod
    def validate_client_message(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)


class PublicBookingConfirmationRead(BaseModel):
    appointment_id: str
    appointment_date: date_type
    start_time: time_type
    end_time: time_type
    status: str
    session_format: str | None = None
    location: str | None = None
    therapist_profile_id: str | None = None


class BookingHoldUpdate(BaseModel):
    status: str | None = None
    appointment_id: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in VALID_HOLD_STATUSES:
            raise ValueError(
                "status must be active, payment_pending, "
                "payment_verified, converted, expired, "
                "or cancelled."
            )
        return normalized

    @field_validator("appointment_id")
    @classmethod
    def validate_appointment_id(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)


class BookingHoldRead(BaseModel):
    id: str
    hold_date: date_type
    start_time: time_type
    end_time: time_type
    service_id: str | None = None
    therapist_profile_id: str | None = None
    session_format: str | None = None
    location: str | None = None
    client_name: str | None = None
    client_email: str | None = None
    client_phone: str | None = None
    status: str
    expires_at: datetime
    appointment_id: str | None = None
    payment_policy_snapshot: (
        Literal[
            "none",
            "pay_later",
            "deposit",
            "full_upfront",
        ]
        | None
    ) = None
    confirmation_mode_snapshot: (
        Literal[
            "instant",
            "staff_approval",
        ]
        | None
    ) = None
    quoted_price_amount: Decimal | None = None
    advance_payment_amount: Decimal | None = None
    payment_currency: str | None = None
    deposit_percentage_snapshot: int | None = None
    sort_order: int

    model_config = {"from_attributes": True}


BookingPaymentPolicy = Literal[
    "none",
    "pay_later",
    "deposit",
    "full_upfront",
]

BookingConfirmationMode = Literal[
    "instant",
    "staff_approval",
]


class BookingSettingsRead(BaseModel):
    payment_policy: BookingPaymentPolicy
    deposit_percentage: int | None = None
    confirmation_mode: BookingConfirmationMode
    recommended_payment_provider: str | None = None
    source: Literal["profile", "database"]


class BookingSettingsUpdate(BaseModel):
    payment_policy: BookingPaymentPolicy
    deposit_percentage: int | None = None
    confirmation_mode: BookingConfirmationMode
    recommended_payment_provider: str | None = None

    @field_validator("deposit_percentage")
    @classmethod
    def validate_deposit_percentage(
        cls,
        value: int | None,
    ) -> int | None:
        if value is not None and not 1 <= value <= 99:
            raise ValueError("deposit_percentage must be " "between 1 and 99.")

        return value

    @field_validator("recommended_payment_provider")
    @classmethod
    def normalize_payment_provider(
        cls,
        value: str | None,
    ) -> str | None:
        return normalize_optional_text(value)

    @model_validator(mode="after")
    def validate_payment_policy_shape(
        self,
    ) -> "BookingSettingsUpdate":
        if self.payment_policy == "deposit" and self.deposit_percentage is None:
            raise ValueError("deposit_percentage is required " "when payment_policy is deposit.")

        if self.payment_policy != "deposit" and self.deposit_percentage is not None:
            raise ValueError(
                "deposit_percentage may only be " "set when payment_policy is deposit."
            )

        return self
