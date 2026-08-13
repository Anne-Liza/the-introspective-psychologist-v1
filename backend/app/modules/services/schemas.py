from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, field_validator, model_validator

from app.core.url_safety import validate_public_url_or_path

PaymentPolicyOverride = Literal[
    "none",
    "pay_later",
    "deposit",
    "full_upfront",
]

ConfirmationModeOverride = Literal[
    "instant",
    "staff_approval",
]


class ServiceBase(BaseModel):
    name: str
    slug: str
    summary: str | None = None
    description: str | None = None
    category: str | None = None
    service_format: str | None = None
    duration_minutes: int | None = None
    price_amount: Decimal | None = None
    currency: str | None = None
    payment_policy_override: PaymentPolicyOverride | None = None
    deposit_percentage_override: int | None = None
    confirmation_mode_override: ConfirmationModeOverride | None = None
    cta_label: str | None = None
    cta_url: str | None = None
    sort_order: int = 0
    is_featured: bool = False
    is_published: bool = True

    @field_validator("duration_minutes")
    @classmethod
    def validate_duration_minutes(
        cls,
        value: int | None,
    ) -> int | None:
        if value is not None and value <= 0:
            raise ValueError("duration_minutes must be " "greater than zero.")

        return value

    @field_validator("price_amount")
    @classmethod
    def validate_price_amount(
        cls,
        value: Decimal | None,
    ) -> Decimal | None:
        if value is not None and value < 0:
            raise ValueError("price_amount cannot be negative.")

        return value

    @field_validator("deposit_percentage_override")
    @classmethod
    def validate_deposit_percentage_override(
        cls,
        value: int | None,
    ) -> int | None:
        if value is not None and not 1 <= value <= 99:
            raise ValueError("deposit_percentage_override must " "be between 1 and 99.")

        return value

    @field_validator("currency")
    @classmethod
    def validate_currency(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None or value.strip() == "":
            return None

        normalized = value.strip().upper()

        if len(normalized) != 3 or not normalized.isalpha():
            raise ValueError("currency must be a 3-letter code.")

        return normalized

    @field_validator("cta_url")
    @classmethod
    def validate_cta_url(
        cls,
        value: str | None,
    ) -> str | None:
        return validate_public_url_or_path(
            value,
            field_name="cta_url",
        )

    @model_validator(mode="after")
    def validate_payment_override_shape(
        self,
    ) -> "ServiceBase":
        if self.payment_policy_override == "deposit" and self.deposit_percentage_override is None:
            raise ValueError(
                "deposit_percentage_override is "
                "required when the service payment "
                "rule is deposit."
            )

        if (
            self.payment_policy_override != "deposit"
            and self.deposit_percentage_override is not None
        ):
            raise ValueError(
                "deposit_percentage_override may "
                "only be set when the service "
                "payment rule is deposit."
            )

        return self


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    summary: str | None = None
    description: str | None = None
    category: str | None = None
    service_format: str | None = None
    duration_minutes: int | None = None
    price_amount: Decimal | None = None
    currency: str | None = None
    payment_policy_override: PaymentPolicyOverride | None = None
    deposit_percentage_override: int | None = None
    confirmation_mode_override: ConfirmationModeOverride | None = None
    cta_label: str | None = None
    cta_url: str | None = None
    sort_order: int | None = None
    is_featured: bool | None = None
    is_published: bool | None = None

    @field_validator("duration_minutes")
    @classmethod
    def validate_update_duration_minutes(
        cls,
        value: int | None,
    ) -> int | None:
        if value is not None and value <= 0:
            raise ValueError("duration_minutes must be " "greater than zero.")

        return value

    @field_validator("price_amount")
    @classmethod
    def validate_update_price_amount(
        cls,
        value: Decimal | None,
    ) -> Decimal | None:
        if value is not None and value < 0:
            raise ValueError("price_amount cannot be negative.")

        return value

    @field_validator("deposit_percentage_override")
    @classmethod
    def validate_update_deposit_percentage_override(
        cls,
        value: int | None,
    ) -> int | None:
        if value is not None and not 1 <= value <= 99:
            raise ValueError("deposit_percentage_override must " "be between 1 and 99.")

        return value

    @field_validator("currency")
    @classmethod
    def validate_update_currency(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None or value.strip() == "":
            return None

        normalized = value.strip().upper()

        if len(normalized) != 3 or not normalized.isalpha():
            raise ValueError("currency must be a 3-letter code.")

        return normalized

    @field_validator("cta_url")
    @classmethod
    def validate_update_cta_url(
        cls,
        value: str | None,
    ) -> str | None:
        return validate_public_url_or_path(
            value,
            field_name="cta_url",
        )


class ServiceRead(ServiceBase):
    id: str

    model_config = {"from_attributes": True}
