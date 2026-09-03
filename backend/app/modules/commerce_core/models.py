from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utc_now


class CommerceItem(Base):
    __tablename__ = "commerce_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(220), nullable=False)
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    item_type: Mapped[str] = mapped_column(String(80), default="product", nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(160), nullable=True)
    linked_service_id: Mapped[str | None] = mapped_column(String, nullable=True)

    price_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="KES", nullable=False)

    sku: Mapped[str | None] = mapped_column(String(120), nullable=True)
    stock_quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    session_credit_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    fulfillment_type: Mapped[str] = mapped_column(String(80), default="manual", nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    image_asset_id: Mapped[str | None] = mapped_column(
        ForeignKey(
            "files.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class CommerceOrder(Base):
    __tablename__ = "commerce_orders"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    order_number: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)

    customer_name: Mapped[str] = mapped_column(String(220), nullable=False)
    customer_email: Mapped[str] = mapped_column(String(320), nullable=False)
    customer_phone: Mapped[str | None] = mapped_column(String(80), nullable=True)

    status: Mapped[str] = mapped_column(String(80), default="draft", nullable=False)
    fulfillment_status: Mapped[str] = mapped_column(String(80), default="unfulfilled", nullable=False)

    subtotal_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="KES", nullable=False)

    source: Mapped[str] = mapped_column(String(80), default="public_checkout", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class CommerceOrderItem(Base):
    __tablename__ = "commerce_order_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    order_id: Mapped[str] = mapped_column(String, ForeignKey("commerce_orders.id", ondelete="CASCADE"), nullable=False)
    commerce_item_id: Mapped[str | None] = mapped_column(String, nullable=True)

    item_name: Mapped[str] = mapped_column(String(220), nullable=False)
    item_type: Mapped[str] = mapped_column(String(80), default="product", nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    unit_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    line_total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="KES", nullable=False)

    linked_service_id: Mapped[str | None] = mapped_column(String, nullable=True)
    session_credit_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
