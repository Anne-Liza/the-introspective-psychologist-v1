from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, field_validator

from app.core.url_safety import validate_external_url

VALID_PAYMENT_PROVIDERS = {"manual", "mpesa", "stripe", "paystack", "bank_transfer"}
VALID_ATTEMPT_STATUSES = {"created", "processing", "succeeded", "failed", "cancelled", "needs_review"}
VALID_VERIFICATION_STATUSES = {"unverified", "verified", "rejected", "duplicate", "needs_review"}
VALID_RECONCILIATION_STATUSES = {
    "idle",
    "pending",
    "retrying",
    "completed",
    "exhausted",
}
VALID_EVENT_STATUSES = {"received", "pending", "processing", "succeeded", "failed", "cancelled", "unknown"}


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


def normalize_provider(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in VALID_PAYMENT_PROVIDERS:
        raise ValueError("provider must be manual, mpesa, stripe, paystack, or bank_transfer.")
    return normalized


def normalize_status(value: str, *, allowed: set[str], field_name: str) -> str:
    normalized = value.strip().lower()
    if normalized not in allowed:
        raise ValueError(f"{field_name} is invalid.")
    return normalized


class PaymentAttemptCreate(BaseModel):
    payment_request_id: str
    provider: str | None = None
    provider_reference: str | None = None
    provider_transaction_reference: str | None = None
    provider_session_id: str | None = None
    idempotency_key: str | None = None
    checkout_url: str | None = None

    @field_validator("payment_request_id")
    @classmethod
    def validate_payment_request_id(cls, value: str) -> str:
        return validate_required_text(value, "payment_request_id")

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return normalize_provider(value)

    @field_validator(
        "provider_reference",
        "provider_transaction_reference",
        "provider_session_id",
        "idempotency_key",
    )
    @classmethod
    def validate_optional_text_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @field_validator("checkout_url")
    @classmethod
    def validate_checkout_url(cls, value: str | None) -> str | None:
        return validate_external_url(value, field_name="checkout_url")


class PaymentProviderEventVerify(BaseModel):
    notes: str | None = None

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)


class PaymentProviderEventCreate(BaseModel):
    payment_attempt_id: str | None = None
    provider: str
    provider_reference: str | None = None
    provider_transaction_reference: str | None = None
    external_event_id: str | None = None
    event_type: str = "provider.callback"
    event_status: str = "received"
    verification_status: str = "unverified"
    amount: Decimal | None = None
    currency: str | None = None
    raw_payload: dict[str, Any] | None = None
    notes: str | None = None

    @field_validator(
        "payment_attempt_id",
        "provider_reference",
        "provider_transaction_reference",
        "external_event_id",
        "event_type",
        "currency",
        "notes",
    )
    @classmethod
    def validate_optional_text_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, value: str) -> str:
        return normalize_provider(value)

    @field_validator("event_status")
    @classmethod
    def validate_event_status(cls, value: str) -> str:
        return normalize_status(value, allowed=VALID_EVENT_STATUSES, field_name="event_status")

    @field_validator("verification_status")
    @classmethod
    def validate_verification_status(cls, value: str) -> str:
        return normalize_status(value, allowed=VALID_VERIFICATION_STATUSES, field_name="verification_status")

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and value <= 0:
            raise ValueError("amount must be greater than zero.")
        return value

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().upper()
        if len(normalized) != 3:
            raise ValueError("currency must be a 3-letter code.")
        return normalized


class PaymentProviderEventRead(BaseModel):
    id: str
    payment_attempt_id: str | None = None
    payment_request_id: str | None = None
    provider: str
    provider_reference: str | None = None
    provider_transaction_reference: str | None = None
    external_event_id: str | None = None
    event_type: str
    event_status: str
    verification_status: str
    amount: Decimal | None = None
    currency: str | None = None
    event_fingerprint: str
    payload_hash: str
    payload_json: str | None = None
    is_duplicate: bool
    original_event_id: str | None = None
    notes: str | None = None
    received_at: datetime
    processed_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaymentAttemptRead(BaseModel):
    id: str
    attempt_number: str
    payment_request_id: str
    provider: str
    provider_reference: str | None = None
    provider_transaction_reference: str | None = None
    provider_session_id: str | None = None
    idempotency_key: str | None = None
    amount: Decimal
    currency: str
    status: str
    verification_status: str

    reconciliation_status: str
    reconciliation_retry_count: int
    reconciliation_last_attempt_at: datetime | None = None
    reconciliation_next_attempt_at: datetime | None = None
    reconciliation_completed_at: datetime | None = None
    reconciliation_last_error_code: str | None = None
    reconciliation_last_error_message: str | None = None

    checkout_url: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    initiated_by_user_id: str | None = None
    verified_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    provider_events: list[PaymentProviderEventRead] = []

    model_config = {"from_attributes": True}
