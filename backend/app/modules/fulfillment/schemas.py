from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, field_validator

VALID_FULFILLMENT_TYPES = {"manual", "digital", "physical", "service", "session_package", "mixed"}
VALID_FULFILLMENT_STATUSES = {"pending", "in_progress", "fulfilled", "cancelled"}


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


def validate_fulfillment_type(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in VALID_FULFILLMENT_TYPES:
        raise ValueError("fulfillment_type must be manual, digital, physical, service, session_package, or mixed.")
    return normalized


def validate_fulfillment_status(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in VALID_FULFILLMENT_STATUSES:
        raise ValueError("status must be pending, in_progress, fulfilled, or cancelled.")
    return normalized


class FulfillmentCreateFromReceipt(BaseModel):
    receipt_id: str
    fulfillment_type: str = "manual"
    notes: str | None = None

    @field_validator("receipt_id")
    @classmethod
    def validate_receipt_id(cls, value: str) -> str:
        return validate_required_text(value, "receipt_id")

    @field_validator("fulfillment_type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        return validate_fulfillment_type(value)

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)


class FulfillmentUpdate(BaseModel):
    status: str | None = None
    fulfillment_type: str | None = None
    notes: str | None = None
    event_notes: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_fulfillment_status(value)

    @field_validator("fulfillment_type")
    @classmethod
    def validate_update_type(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_fulfillment_type(value)

    @field_validator("notes", "event_notes")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)


class FulfillmentEventRead(BaseModel):
    id: str
    fulfillment_id: str
    event_type: str
    from_status: str | None = None
    to_status: str | None = None
    actor_user_id: str | None = None
    notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class FulfillmentRead(BaseModel):
    id: str
    fulfillment_number: str
    receipt_id: str
    payment_request_id: str
    commerce_order_id: str
    order_number: str
    customer_name: str
    customer_email: str
    customer_phone: str | None = None
    fulfillment_type: str
    status: str
    notes: str | None = None
    started_at: datetime | None = None
    fulfilled_at: datetime | None = None
    cancelled_at: datetime | None = None
    created_by_user_id: str | None = None
    created_at: datetime
    updated_at: datetime
    events: list[FulfillmentEventRead] = []

    model_config = {"from_attributes": True}
