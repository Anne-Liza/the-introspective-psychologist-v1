from datetime import date as date_type
from datetime import time as time_type

from pydantic import BaseModel, field_validator, model_validator

from app.core.booking_state import VALID_APPOINTMENT_STATUSES

VALID_APPOINTMENT_SOURCES = {
    "public_request",
    "admin_created",
    "presentation_seed",
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
        raise ValueError("client_email must be a valid email address.")
    return normalized


class AppointmentBase(BaseModel):
    appointment_date: date_type
    start_time: time_type
    end_time: time_type
    client_name: str
    client_email: str
    client_phone: str | None = None
    service_id: str | None = None
    therapist_profile_id: str | None = None
    status: str = "requested"
    session_format: str | None = None
    location: str | None = None
    client_message: str | None = None
    admin_notes: str | None = None
    source: str = "public_request"
    sort_order: int = 0

    @field_validator("client_name")
    @classmethod
    def validate_client_name(cls, value: str) -> str:
        return validate_required_text(value, "client_name")

    @field_validator("client_email")
    @classmethod
    def validate_client_email(cls, value: str) -> str:
        return validate_email(value)

    @field_validator("client_phone", "service_id", "therapist_profile_id", "session_format", "location", "client_message", "admin_notes")
    @classmethod
    def validate_optional_text_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in VALID_APPOINTMENT_STATUSES:
            raise ValueError("status must be requested, confirmed, declined, cancelled, completed, or no_show.")
        return normalized

    @field_validator("source")
    @classmethod
    def validate_source(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in VALID_APPOINTMENT_SOURCES:
            raise ValueError("source must be public_request, admin_created, or presentation_seed.")
        return normalized

    @model_validator(mode="after")
    def validate_time_window(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time.")
        return self


class AppointmentCreate(AppointmentBase):
    pass


class PublicAppointmentCreate(BaseModel):
    appointment_date: date_type
    start_time: time_type
    end_time: time_type
    client_name: str
    client_email: str
    client_phone: str | None = None
    service_id: str | None = None
    therapist_profile_id: str | None = None
    session_format: str | None = None
    location: str | None = None
    client_message: str | None = None

    @field_validator("client_name")
    @classmethod
    def validate_client_name(cls, value: str) -> str:
        return validate_required_text(value, "client_name")

    @field_validator("client_email")
    @classmethod
    def validate_client_email(cls, value: str) -> str:
        return validate_email(value)

    @field_validator("client_phone", "service_id", "therapist_profile_id", "session_format", "location", "client_message")
    @classmethod
    def validate_optional_text_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @model_validator(mode="after")
    def validate_time_window(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time.")
        return self


class AppointmentUpdate(BaseModel):
    appointment_date: date_type | None = None
    start_time: time_type | None = None
    end_time: time_type | None = None
    client_name: str | None = None
    client_email: str | None = None
    client_phone: str | None = None
    service_id: str | None = None
    therapist_profile_id: str | None = None
    status: str | None = None
    session_format: str | None = None
    location: str | None = None
    client_message: str | None = None
    admin_notes: str | None = None
    source: str | None = None
    sort_order: int | None = None

    @field_validator("client_name")
    @classmethod
    def validate_update_client_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_required_text(value, "client_name")

    @field_validator("client_email")
    @classmethod
    def validate_update_client_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_email(value)

    @field_validator("client_phone", "service_id", "therapist_profile_id", "session_format", "location", "client_message", "admin_notes")
    @classmethod
    def validate_update_optional_text_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @field_validator("status")
    @classmethod
    def validate_update_status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in VALID_APPOINTMENT_STATUSES:
            raise ValueError("status must be requested, confirmed, declined, cancelled, completed, or no_show.")
        return normalized

    @field_validator("source")
    @classmethod
    def validate_update_source(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in VALID_APPOINTMENT_SOURCES:
            raise ValueError("source must be public_request, admin_created, or presentation_seed.")
        return normalized

    @model_validator(mode="after")
    def validate_update_time_window(self):
        if self.start_time is not None and self.end_time is not None and self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time.")
        return self


class AppointmentRead(AppointmentBase):
    id: str

    model_config = {"from_attributes": True}


class TherapistAppointmentRead(BaseModel):
    id: str
    appointment_date: date_type
    start_time: time_type
    end_time: time_type
    client_name: str
    service_id: str | None = None
    therapist_profile_id: str | None = None
    status: str
    session_format: str | None = None
    location: str | None = None

    model_config = {"from_attributes": True}


class PublicAppointmentRead(BaseModel):
    id: str
    appointment_date: date_type
    start_time: time_type
    end_time: time_type
    service_id: str | None = None
    therapist_profile_id: str | None = None
    status: str
    session_format: str | None = None

    model_config = {"from_attributes": True}
