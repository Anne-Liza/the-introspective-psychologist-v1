from decimal import Decimal
from typing import Any

from pydantic import BaseModel, field_validator


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


def normalize_mpesa_phone(value: str) -> str:
    digits = "".join(character for character in value if character.isdigit())

    if digits.startswith("0") and len(digits) == 10:
        digits = "254" + digits[1:]

    if digits.startswith("7") and len(digits) == 9:
        digits = "254" + digits

    if digits.startswith("1") and len(digits) == 9:
        digits = "254" + digits

    if not digits.startswith("254") or len(digits) != 12:
        raise ValueError("phone_number must be a valid Kenyan M-Pesa phone number.")

    return digits


class MpesaStkPushPrepareRequest(BaseModel):
    payment_request_id: str
    phone_number: str
    account_reference: str | None = None
    transaction_desc: str | None = None
    idempotency_key: str | None = None

    @field_validator("payment_request_id")
    @classmethod
    def validate_payment_request_id(cls, value: str) -> str:
        return validate_required_text(value, "payment_request_id")

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: str) -> str:
        return normalize_mpesa_phone(value)

    @field_validator("account_reference", "transaction_desc", "idempotency_key")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)


class MpesaPublicStkPushPrepareRequest(BaseModel):
    phone_number: str

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(
        cls,
        value: str,
    ) -> str:
        return normalize_mpesa_phone(value)


class MpesaStkPushPrepareResponse(BaseModel):
    payment_attempt_id: str
    attempt_number: str
    payment_request_id: str
    provider: str
    provider_reference: str | None = None
    provider_session_id: str | None = None
    amount: Decimal
    currency: str
    status: str
    verification_status: str
    phone_number: str
    adapter_mode: str
    message: str


class MpesaCallbackParseResult(BaseModel):
    merchant_request_id: str | None = None
    checkout_request_id: str | None = None
    result_code: int | None = None
    result_desc: str | None = None
    amount: Decimal | None = None
    mpesa_receipt_number: str | None = None
    transaction_date: str | None = None
    phone_number: str | None = None
    raw_payload: dict[str, Any]


class MpesaCallbackRead(BaseModel):
    provider_event_id: str
    payment_attempt_id: str | None = None
    payment_request_id: str | None = None
    provider_reference: str | None = None
    event_status: str
    verification_status: str
    is_duplicate: bool



class MpesaCallbackVerifyRequest(BaseModel):
    notes: str | None = None
