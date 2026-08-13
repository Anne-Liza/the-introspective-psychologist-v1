from datetime import date as date_type
from datetime import time as time_type

from pydantic import BaseModel, field_validator, model_validator

VALID_EXCEPTION_TYPES = {"available", "blocked"}


class AvailabilityRuleBase(BaseModel):
    title: str
    day_of_week: int
    start_time: time_type
    end_time: time_type
    timezone: str = "Africa/Nairobi"
    slot_duration_minutes: int = 60
    buffer_minutes: int = 0
    capacity: int = 1
    service_id: str | None = None
    therapist_profile_id: str | None = None
    session_format: str | None = None
    location: str | None = None
    is_active: bool = True
    is_public: bool = True
    sort_order: int = 0

    @field_validator("day_of_week")
    @classmethod
    def validate_day_of_week(cls, value: int) -> int:
        if value < 0 or value > 6:
            raise ValueError("day_of_week must be between 0 and 6.")
        return value

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("timezone is required.")
        return normalized

    @field_validator("slot_duration_minutes")
    @classmethod
    def validate_slot_duration_minutes(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("slot_duration_minutes must be greater than zero.")
        return value

    @field_validator("buffer_minutes")
    @classmethod
    def validate_buffer_minutes(cls, value: int) -> int:
        if value < 0:
            raise ValueError("buffer_minutes cannot be negative.")
        return value

    @field_validator("capacity")
    @classmethod
    def validate_capacity(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("capacity must be greater than zero.")
        return value

    @model_validator(mode="after")
    def validate_time_window(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time.")
        return self


class AvailabilityRuleCreate(AvailabilityRuleBase):
    pass


class AvailabilityRuleUpdate(BaseModel):
    title: str | None = None
    day_of_week: int | None = None
    start_time: time_type | None = None
    end_time: time_type | None = None
    timezone: str | None = None
    slot_duration_minutes: int | None = None
    buffer_minutes: int | None = None
    capacity: int | None = None
    service_id: str | None = None
    therapist_profile_id: str | None = None
    session_format: str | None = None
    location: str | None = None
    is_active: bool | None = None
    is_public: bool | None = None
    sort_order: int | None = None

    @field_validator("day_of_week")
    @classmethod
    def validate_update_day_of_week(cls, value: int | None) -> int | None:
        if value is not None and (value < 0 or value > 6):
            raise ValueError("day_of_week must be between 0 and 6.")
        return value

    @field_validator("timezone")
    @classmethod
    def validate_update_timezone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("timezone is required.")
        return normalized

    @field_validator("slot_duration_minutes")
    @classmethod
    def validate_update_slot_duration_minutes(cls, value: int | None) -> int | None:
        if value is not None and value <= 0:
            raise ValueError("slot_duration_minutes must be greater than zero.")
        return value

    @field_validator("buffer_minutes")
    @classmethod
    def validate_update_buffer_minutes(cls, value: int | None) -> int | None:
        if value is not None and value < 0:
            raise ValueError("buffer_minutes cannot be negative.")
        return value

    @field_validator("capacity")
    @classmethod
    def validate_update_capacity(cls, value: int | None) -> int | None:
        if value is not None and value <= 0:
            raise ValueError("capacity must be greater than zero.")
        return value

    @model_validator(mode="after")
    def validate_update_time_window(self):
        if self.start_time is not None and self.end_time is not None and self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time.")
        return self


class AvailabilityRuleRead(AvailabilityRuleBase):
    id: str

    model_config = {"from_attributes": True}


class AvailabilityExceptionBase(BaseModel):
    date: date_type
    start_time: time_type | None = None
    end_time: time_type | None = None
    exception_type: str
    reason: str | None = None
    service_id: str | None = None
    therapist_profile_id: str | None = None
    is_active: bool = True
    is_public: bool = True

    @field_validator("exception_type")
    @classmethod
    def validate_exception_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in VALID_EXCEPTION_TYPES:
            raise ValueError("exception_type must be available or blocked.")
        return normalized

    @model_validator(mode="after")
    def validate_exception_time_window(self):
        if (self.start_time is None) != (self.end_time is None):
            raise ValueError(
                "start_time and end_time must be provided together."
            )

        if (
            self.start_time is not None
            and self.end_time is not None
            and self.end_time <= self.start_time
        ):
            raise ValueError("end_time must be after start_time.")

        return self


class AvailabilityExceptionCreate(AvailabilityExceptionBase):
    pass


class AvailabilityExceptionUpdate(BaseModel):
    date: date_type | None = None
    start_time: time_type | None = None
    end_time: time_type | None = None
    exception_type: str | None = None
    reason: str | None = None
    service_id: str | None = None
    therapist_profile_id: str | None = None
    is_active: bool | None = None
    is_public: bool | None = None

    @field_validator("exception_type")
    @classmethod
    def validate_update_exception_type(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in VALID_EXCEPTION_TYPES:
            raise ValueError("exception_type must be available or blocked.")
        return normalized

    @model_validator(mode="after")
    def validate_update_exception_time_window(self):
        if self.start_time is not None and self.end_time is not None and self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time.")
        return self


class AvailabilityExceptionRead(AvailabilityExceptionBase):
    id: str

    model_config = {"from_attributes": True}


class AvailabilityPublicRead(BaseModel):
    rules: list[AvailabilityRuleRead]
    exceptions: list[AvailabilityExceptionRead]
