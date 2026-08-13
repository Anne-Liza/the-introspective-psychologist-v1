from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, field_validator

VALID_CLIENT_STATUSES = {"lead", "active", "inactive", "archived"}
VALID_CLIENT_SOURCES = {
    "manual",
    "appointment",
    "commerce_order",
    "contact_message",
    "payment_request",
    "receipt",
    "fulfillment",
}
VALID_CONTACT_METHODS = {"email", "phone", "whatsapp", "none"}
VALID_LINK_TYPES = {
    "appointment",
    "commerce_order",
    "contact_message",
    "payment_request",
    "receipt",
    "fulfillment",
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
        raise ValueError("email must be a valid email address.")
    return normalized


def validate_status_value(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in VALID_CLIENT_STATUSES:
        raise ValueError("status must be lead, active, inactive, or archived.")
    return normalized


def validate_source_value(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in VALID_CLIENT_SOURCES:
        raise ValueError("source must be manual, appointment, commerce_order, contact_message, payment_request, receipt, or fulfillment.")
    return normalized


def validate_contact_method_value(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in VALID_CONTACT_METHODS:
        raise ValueError("preferred_contact_method must be email, phone, whatsapp, or none.")
    return normalized


class ClientRecordCreate(BaseModel):
    full_name: str
    email: str
    phone: str | None = None
    status: str = "lead"
    source: str = "manual"
    preferred_contact_method: str = "email"
    admin_notes: str | None = None

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        return validate_required_text(value, "full_name")

    @field_validator("email")
    @classmethod
    def validate_client_email(cls, value: str) -> str:
        return validate_email(value)

    @field_validator("phone", "admin_notes")
    @classmethod
    def validate_optional_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        return validate_status_value(value)

    @field_validator("source")
    @classmethod
    def validate_source(cls, value: str) -> str:
        return validate_source_value(value)

    @field_validator("preferred_contact_method")
    @classmethod
    def validate_contact_method(cls, value: str) -> str:
        return validate_contact_method_value(value)


class ClientRecordUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    status: str | None = None
    preferred_contact_method: str | None = None
    admin_notes: str | None = None

    @field_validator("full_name")
    @classmethod
    def validate_update_full_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_required_text(value, "full_name")

    @field_validator("email")
    @classmethod
    def validate_update_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_email(value)

    @field_validator("phone", "admin_notes")
    @classmethod
    def validate_update_optional_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @field_validator("status")
    @classmethod
    def validate_update_status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_status_value(value)

    @field_validator("preferred_contact_method")
    @classmethod
    def validate_update_contact_method(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_contact_method_value(value)


class ClientRecordFromAppointment(BaseModel):
    appointment_id: str
    admin_notes: str | None = None

    @field_validator("appointment_id")
    @classmethod
    def validate_appointment_id(cls, value: str) -> str:
        return validate_required_text(value, "appointment_id")

    @field_validator("admin_notes")
    @classmethod
    def validate_notes(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)


class ClientRecordFromCommerceOrder(BaseModel):
    commerce_order_id: str
    admin_notes: str | None = None

    @field_validator("commerce_order_id")
    @classmethod
    def validate_commerce_order_id(cls, value: str) -> str:
        return validate_required_text(value, "commerce_order_id")

    @field_validator("admin_notes")
    @classmethod
    def validate_notes(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)


class ClientRecordLinkRead(BaseModel):
    id: str
    client_record_id: str
    link_type: str
    linked_record_id: str
    label: str | None = None
    notes: str | None = None
    created_by_user_id: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ClientRecordRead(BaseModel):
    id: str
    client_number: str
    full_name: str
    email: str
    phone: str | None = None
    status: str
    source: str
    preferred_contact_method: str
    admin_notes: str | None = None
    created_by_user_id: str | None = None
    created_at: datetime
    updated_at: datetime
    links: list[ClientRecordLinkRead] = []

    model_config = {"from_attributes": True}
