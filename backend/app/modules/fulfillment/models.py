from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utc_now


class FulfillmentRecord(Base):
    __tablename__ = "fulfillment_records"
    __table_args__ = (
        UniqueConstraint("receipt_id", name="uq_fulfillment_records_receipt_id"),
        UniqueConstraint("commerce_order_id", name="uq_fulfillment_records_commerce_order_id"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    fulfillment_number: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)

    receipt_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("receipt_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    payment_request_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("payment_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    commerce_order_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("commerce_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    order_number: Mapped[str] = mapped_column(String(80), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    customer_phone: Mapped[str | None] = mapped_column(String(80), nullable=True)

    fulfillment_type: Mapped[str] = mapped_column(String(80), default="manual", nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(80), default="pending", nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    fulfilled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_by_user_id: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class FulfillmentEvent(Base):
    __tablename__ = "fulfillment_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))

    fulfillment_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("fulfillment_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    event_type: Mapped[str] = mapped_column(String(120), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(80), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(80), nullable=True)
    actor_user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
