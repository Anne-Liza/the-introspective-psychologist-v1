from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator, model_validator

from app.core.url_safety import validate_public_url_or_path

VALID_ITEM_TYPES = {"product", "package", "service", "digital", "physical", "custom"}
VALID_FULFILLMENT_TYPES = {"manual", "digital", "physical", "service", "session_package"}
VALID_ORDER_STATUSES = {"draft", "pending_payment", "paid", "cancelled", "refunded"}
VALID_FULFILLMENT_STATUSES = {"unfulfilled", "partial", "fulfilled", "cancelled"}
VALID_ORDER_SOURCES = {"public_checkout", "admin_created"}
MAX_PUBLIC_ITEM_QUANTITY = 100


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


def validate_currency_code(value: str) -> str:
    normalized = value.strip().upper()
    if len(normalized) != 3 or not normalized.isalpha():
        raise ValueError("currency must be a 3-letter code.")
    return normalized


def validate_non_negative_decimal(value: Decimal, field_name: str) -> Decimal:
    if value < 0:
        raise ValueError(f"{field_name} cannot be negative.")
    return value


class CommerceItemBase(BaseModel):
    name: str
    slug: str
    item_type: str = "product"
    summary: str | None = None
    description: str | None = None
    category: str | None = None
    linked_service_id: str | None = None
    price_amount: Decimal = Decimal("0")
    currency: str = "KES"
    sku: str | None = None
    stock_quantity: int | None = None
    session_credit_count: int | None = None
    fulfillment_type: str = "manual"
    image_url: str | None = None
    image_asset_id: str | None = None
    sort_order: int = 0
    is_featured: bool = False
    is_published: bool = True

    @field_validator("name", "slug")
    @classmethod
    def validate_required_fields(cls, value: str, info) -> str:
        return validate_required_text(value, info.field_name)

    @field_validator("item_type")
    @classmethod
    def validate_item_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in VALID_ITEM_TYPES:
            raise ValueError("item_type must be product, package, service, digital, physical, or custom.")
        return normalized

    @field_validator("summary", "description", "category", "linked_service_id", "sku")
    @classmethod
    def validate_optional_text_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @field_validator("price_amount")
    @classmethod
    def validate_price_amount(cls, value: Decimal) -> Decimal:
        return validate_non_negative_decimal(value, "price_amount")

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return validate_currency_code(value)

    @field_validator("stock_quantity", "session_credit_count")
    @classmethod
    def validate_optional_non_negative_int(cls, value: int | None) -> int | None:
        if value is not None and value < 0:
            raise ValueError("value cannot be negative.")
        return value

    @field_validator("fulfillment_type")
    @classmethod
    def validate_fulfillment_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in VALID_FULFILLMENT_TYPES:
            raise ValueError("fulfillment_type must be manual, digital, physical, service, or session_package.")
        return normalized

    @field_validator("image_url")
    @classmethod
    def validate_image_url(cls, value: str | None) -> str | None:
        return validate_public_url_or_path(value, field_name="image_url")


class CommerceItemCreate(CommerceItemBase):
    pass


class CommerceItemUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    item_type: str | None = None
    summary: str | None = None
    description: str | None = None
    category: str | None = None
    linked_service_id: str | None = None
    price_amount: Decimal | None = None
    currency: str | None = None
    sku: str | None = None
    stock_quantity: int | None = None
    session_credit_count: int | None = None
    fulfillment_type: str | None = None
    image_url: str | None = None
    image_asset_id: str | None = None
    sort_order: int | None = None
    is_featured: bool | None = None
    is_published: bool | None = None

    @field_validator("name", "slug")
    @classmethod
    def validate_update_required_text(cls, value: str | None, info) -> str | None:
        if value is None:
            return None
        return validate_required_text(value, info.field_name)

    @field_validator("item_type")
    @classmethod
    def validate_update_item_type(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in VALID_ITEM_TYPES:
            raise ValueError("item_type must be product, package, service, digital, physical, or custom.")
        return normalized

    @field_validator("summary", "description", "category", "linked_service_id", "sku")
    @classmethod
    def validate_update_optional_text_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @field_validator("price_amount")
    @classmethod
    def validate_update_price_amount(cls, value: Decimal | None) -> Decimal | None:
        if value is None:
            return None
        return validate_non_negative_decimal(value, "price_amount")

    @field_validator("currency")
    @classmethod
    def validate_update_currency(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_currency_code(value)

    @field_validator("stock_quantity", "session_credit_count")
    @classmethod
    def validate_update_optional_non_negative_int(cls, value: int | None) -> int | None:
        if value is not None and value < 0:
            raise ValueError("value cannot be negative.")
        return value

    @field_validator("fulfillment_type")
    @classmethod
    def validate_update_fulfillment_type(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in VALID_FULFILLMENT_TYPES:
            raise ValueError("fulfillment_type must be manual, digital, physical, service, or session_package.")
        return normalized

    @field_validator("image_url")
    @classmethod
    def validate_update_image_url(cls, value: str | None) -> str | None:
        return validate_public_url_or_path(value, field_name="image_url")


class CommerceItemRead(CommerceItemBase):
    id: str

    model_config = {"from_attributes": True}


class CommerceOrderItemCreate(BaseModel):
    commerce_item_id: str | None = None
    item_name: str
    item_type: str = "product"
    quantity: int = 1
    unit_amount: Decimal
    currency: str = "KES"
    linked_service_id: str | None = None
    session_credit_count: int | None = None
    sort_order: int = 0

    @field_validator("commerce_item_id", "linked_service_id")
    @classmethod
    def validate_optional_text_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @field_validator("item_name")
    @classmethod
    def validate_item_name(cls, value: str) -> str:
        return validate_required_text(value, "item_name")

    @field_validator("item_type")
    @classmethod
    def validate_item_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in VALID_ITEM_TYPES:
            raise ValueError("item_type must be product, package, service, digital, physical, or custom.")
        return normalized

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("quantity must be greater than zero.")
        if value > MAX_PUBLIC_ITEM_QUANTITY:
            raise ValueError(f"quantity cannot exceed {MAX_PUBLIC_ITEM_QUANTITY}.")
        return value

    @field_validator("unit_amount")
    @classmethod
    def validate_unit_amount(cls, value: Decimal) -> Decimal:
        return validate_non_negative_decimal(value, "unit_amount")

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return validate_currency_code(value)

    @field_validator("session_credit_count")
    @classmethod
    def validate_session_credit_count(cls, value: int | None) -> int | None:
        if value is not None and value < 0:
            raise ValueError("session_credit_count cannot be negative.")
        return value


class CommerceOrderItemRead(BaseModel):
    id: str
    order_id: str
    commerce_item_id: str | None = None
    item_name: str
    item_type: str
    quantity: int
    unit_amount: Decimal
    line_total_amount: Decimal
    currency: str
    linked_service_id: str | None = None
    session_credit_count: int | None = None
    sort_order: int

    model_config = {"from_attributes": True}


class PublicCommerceOrderItemCreate(BaseModel):
    commerce_item_id: str
    quantity: int = 1

    model_config = {"extra": "forbid"}

    @field_validator("commerce_item_id")
    @classmethod
    def validate_commerce_item_id(cls, value: str) -> str:
        return validate_required_text(value, "commerce_item_id")

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("quantity must be greater than zero.")
        if value > MAX_PUBLIC_ITEM_QUANTITY:
            raise ValueError(f"quantity cannot exceed {MAX_PUBLIC_ITEM_QUANTITY}.")
        return value


class PublicCommerceOrderCreate(BaseModel):
    customer_name: str
    customer_email: str
    customer_phone: str | None = None
    notes: str | None = None
    items: list[PublicCommerceOrderItemCreate]

    model_config = {"extra": "forbid"}

    @field_validator("customer_name")
    @classmethod
    def validate_customer_name(cls, value: str) -> str:
        return validate_required_text(value, "customer_name")

    @field_validator("customer_email")
    @classmethod
    def validate_customer_email(cls, value: str) -> str:
        return validate_email(value)

    @field_validator("customer_phone", "notes")
    @classmethod
    def validate_optional_text_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @model_validator(mode="after")
    def validate_items(self):
        if not self.items:
            raise ValueError("items are required.")

        item_ids = [item.commerce_item_id for item in self.items]
        if len(set(item_ids)) != len(item_ids):
            raise ValueError("cart items must be unique; update quantity instead of repeating an item.")
        return self


class CommerceOrderCreate(BaseModel):
    customer_name: str
    customer_email: str
    customer_phone: str | None = None
    status: str = "pending_payment"
    fulfillment_status: str = "unfulfilled"
    discount_amount: Decimal = Decimal("0")
    tax_amount: Decimal = Decimal("0")
    currency: str = "KES"
    source: str = "public_checkout"
    notes: str | None = None
    items: list[CommerceOrderItemCreate]

    @field_validator("customer_name")
    @classmethod
    def validate_customer_name(cls, value: str) -> str:
        return validate_required_text(value, "customer_name")

    @field_validator("customer_email")
    @classmethod
    def validate_customer_email(cls, value: str) -> str:
        return validate_email(value)

    @field_validator("customer_phone", "notes")
    @classmethod
    def validate_optional_text_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in VALID_ORDER_STATUSES:
            raise ValueError("status must be draft, pending_payment, paid, cancelled, or refunded.")
        return normalized

    @field_validator("fulfillment_status")
    @classmethod
    def validate_fulfillment_status(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in VALID_FULFILLMENT_STATUSES:
            raise ValueError("fulfillment_status must be unfulfilled, partial, fulfilled, or cancelled.")
        return normalized

    @field_validator("discount_amount")
    @classmethod
    def validate_discount_amount(cls, value: Decimal) -> Decimal:
        return validate_non_negative_decimal(value, "discount_amount")

    @field_validator("tax_amount")
    @classmethod
    def validate_tax_amount(cls, value: Decimal) -> Decimal:
        return validate_non_negative_decimal(value, "tax_amount")

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return validate_currency_code(value)

    @field_validator("source")
    @classmethod
    def validate_source(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in VALID_ORDER_SOURCES:
            raise ValueError("source must be public_checkout or admin_created.")
        return normalized

    @model_validator(mode="after")
    def validate_items(self):
        if not self.items:
            raise ValueError("items are required.")
        currencies = {item.currency for item in self.items}
        if len(currencies) > 1 or self.currency not in currencies:
            raise ValueError("all order items must use the order currency.")
        return self


class CommerceOrderUpdate(BaseModel):
    customer_name: str | None = None
    customer_email: str | None = None
    customer_phone: str | None = None
    status: str | None = None
    fulfillment_status: str | None = None
    notes: str | None = None

    @field_validator("customer_name")
    @classmethod
    def validate_update_customer_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_required_text(value, "customer_name")

    @field_validator("customer_email")
    @classmethod
    def validate_update_customer_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_email(value)

    @field_validator("customer_phone", "notes")
    @classmethod
    def validate_update_optional_text_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @field_validator("status")
    @classmethod
    def validate_update_status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in VALID_ORDER_STATUSES:
            raise ValueError("status must be draft, pending_payment, paid, cancelled, or refunded.")
        return normalized

    @field_validator("fulfillment_status")
    @classmethod
    def validate_update_fulfillment_status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in VALID_FULFILLMENT_STATUSES:
            raise ValueError("fulfillment_status must be unfulfilled, partial, fulfilled, or cancelled.")
        return normalized


class CommerceOrderRead(BaseModel):
    id: str
    order_number: str
    customer_name: str
    customer_email: str
    customer_phone: str | None = None
    status: str
    fulfillment_status: str
    subtotal_amount: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    currency: str
    source: str
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    items: list[CommerceOrderItemRead] = []

    model_config = {"from_attributes": True}
