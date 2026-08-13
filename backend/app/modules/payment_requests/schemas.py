from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator

VALID_PAYMENT_PROVIDERS = {"manual", "mpesa", "stripe", "paystack", "bank_transfer"}
VALID_PAYMENT_REQUEST_STATUSES = {
    "pending",
    "processing",
    "paid",
    "failed",
    "expired",
    "cancelled",
    "needs_review",
}


def normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def validate_required_text(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} is required.")
    return normalized


def validate_email(value: str) -> str:
    normalized = value.strip().lower()
    if not normalized or "@" not in normalized or "." not in normalized.rsplit("@", 1)[-1]:
        raise ValueError("customer_email must be a valid email address.")
    return normalized


def validate_provider(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in VALID_PAYMENT_PROVIDERS:
        raise ValueError("provider must be manual, mpesa, stripe, paystack, or bank_transfer.")
    return normalized


def validate_status(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in VALID_PAYMENT_REQUEST_STATUSES:
        raise ValueError("status must be pending, processing, paid, failed, expired, cancelled, or needs_review.")
    return normalized


class PaymentRequestFromOrderCreate(BaseModel):
    commerce_order_id: str
    customer_email: str
    provider: str = "manual"
    expires_in_minutes: int = 60
    description: str | None = None
    settlement_account_label: str | None = None

    @field_validator("commerce_order_id")
    @classmethod
    def validate_order_id(cls, value: str) -> str:
        return validate_required_text(value, "commerce_order_id")

    @field_validator("customer_email")
    @classmethod
    def validate_customer_email(cls, value: str) -> str:
        return validate_email(value)

    @field_validator("provider")
    @classmethod
    def validate_payment_provider(cls, value: str) -> str:
        return validate_provider(value)

    @field_validator("expires_in_minutes")
    @classmethod
    def validate_expiry_window(cls, value: int) -> int:
        if value <= 0 or value > 10080:
            raise ValueError("expires_in_minutes must be between 1 minute and 7 days.")
        return value

    @field_validator("description", "settlement_account_label")
    @classmethod
    def validate_optional_text_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)


class PublicPaymentRequestFromOrderCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    commerce_order_id: str
    customer_email: str
    provider: Literal["manual"] = "manual"
    description: str | None = None

    @field_validator("commerce_order_id")
    @classmethod
    def validate_order_id(cls, value: str) -> str:
        return validate_required_text(value, "commerce_order_id")

    @field_validator("customer_email")
    @classmethod
    def validate_customer_email(cls, value: str) -> str:
        return validate_email(value)

    @field_validator("description")
    @classmethod
    def validate_optional_description(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @property
    def expires_in_minutes(self) -> int:
        return 60

    @property
    def settlement_account_label(self) -> None:
        return None


class PaymentRequestCreate(BaseModel):
    commerce_order_id: str
    provider: str = "manual"
    expires_in_minutes: int = 60
    description: str | None = None
    settlement_account_label: str | None = None

    @field_validator("commerce_order_id")
    @classmethod
    def validate_order_id(cls, value: str) -> str:
        return validate_required_text(value, "commerce_order_id")

    @field_validator("provider")
    @classmethod
    def validate_payment_provider(cls, value: str) -> str:
        return validate_provider(value)

    @field_validator("expires_in_minutes")
    @classmethod
    def validate_expiry_window(cls, value: int) -> int:
        if value <= 0 or value > 10080:
            raise ValueError("expires_in_minutes must be between 1 minute and 7 days.")
        return value

    @field_validator("description", "settlement_account_label")
    @classmethod
    def validate_optional_text_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)


class PaymentRequestUpdate(BaseModel):
    status: str | None = None
    provider_reference: str | None = None
    provider_transaction_reference: str | None = None
    admin_notes: str | None = None
    event_notes: str | None = None

    @field_validator("status")
    @classmethod
    def validate_update_status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_status(value)

    @field_validator(
        "provider_reference",
        "provider_transaction_reference",
        "admin_notes",
        "event_notes",
    )
    @classmethod
    def validate_optional_text_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)


class PaymentRequestEventRead(BaseModel):
    id: str
    payment_request_id: str
    event_type: str
    from_status: str | None = None
    to_status: str | None = None
    provider: str | None = None
    provider_reference: str | None = None
    provider_transaction_reference: str | None = None
    amount: Decimal | None = None
    currency: str | None = None
    actor_user_id: str | None = None
    notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaymentRequestRead(BaseModel):
    id: str
    request_number: str
    commerce_order_id: str | None
    target_type: Literal[
        "commerce_order",
        "booking_hold",
    ]
    target_id: str
    customer_name: str
    customer_email: str
    customer_phone: str | None = None
    amount: Decimal
    currency: str
    provider: str
    provider_reference: str | None = None
    provider_transaction_reference: str | None = None
    settlement_account_label: str | None = None
    status: str
    description: str | None = None
    admin_notes: str | None = None
    expires_at: datetime | None = None
    paid_at: datetime | None = None
    cancelled_at: datetime | None = None
    created_by_user_id: str | None = None
    created_at: datetime
    updated_at: datetime
    events: list[PaymentRequestEventRead] = []

    model_config = {"from_attributes": True}
