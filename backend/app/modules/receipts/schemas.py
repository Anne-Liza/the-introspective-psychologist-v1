from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, field_validator

VALID_RECEIPT_STATUSES = {"issued", "voided"}


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


def validate_receipt_status(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in VALID_RECEIPT_STATUSES:
        raise ValueError("status must be issued or voided.")
    return normalized


class ReceiptCreateFromPaymentRequest(BaseModel):
    payment_request_id: str
    notes: str | None = None

    @field_validator("payment_request_id")
    @classmethod
    def validate_payment_request_id(cls, value: str) -> str:
        return validate_required_text(value, "payment_request_id")

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)


class ReceiptUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None
    event_notes: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_receipt_status(value)

    @field_validator("notes", "event_notes")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)


class ReceiptEventRead(BaseModel):
    id: str
    receipt_id: str
    event_type: str
    from_status: str | None = None
    to_status: str | None = None
    actor_user_id: str | None = None
    notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReceiptRead(BaseModel):
    id: str
    receipt_number: str
    payment_request_id: str
    payment_reference: str
    target_type: Literal[
        "commerce_order",
        "booking_hold",
    ]
    target_id: str
    commerce_order_id: str | None = None
    appointment_id: str | None = None
    customer_name: str
    customer_email: str
    customer_phone: str | None = None
    amount: Decimal
    currency: str
    provider: str
    provider_reference: str | None = None
    provider_transaction_reference: (
        str | None
    ) = None
    status: str
    notes: str | None = None
    issued_at: datetime
    voided_at: datetime | None = None
    created_by_user_id: str | None = None
    created_at: datetime
    updated_at: datetime
    events: list[ReceiptEventRead] = []

    model_config = {"from_attributes": True}


class PublicReceiptOrderItemRead(BaseModel):
    item_name: str
    quantity: int
    unit_amount: Decimal
    line_total_amount: Decimal
    currency: str

    model_config = {"from_attributes": True}


class PublicReceiptRead(BaseModel):
    receipt_number: str
    status: str
    issued_at: datetime
    amount: Decimal
    currency: str
    provider: str
    provider_transaction_reference: str | None = None
    order_number: str
    order_created_at: datetime
    customer_name: str
    items: list[PublicReceiptOrderItemRead] = []

