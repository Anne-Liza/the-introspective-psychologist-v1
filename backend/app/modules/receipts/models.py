from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utc_now


class ReceiptRecord(Base):
    __tablename__ = "receipt_records"
    __table_args__ = (
        UniqueConstraint(
            "payment_request_id",
            name=(
                "uq_receipt_records_"
                "payment_request_id"
            ),
        ),
        CheckConstraint(
            "("
            "(target_type = 'commerce_order' "
            "AND commerce_order_id IS NOT NULL "
            "AND target_id = commerce_order_id)"
            " OR "
            "(target_type = 'booking_hold' "
            "AND commerce_order_id IS NULL)"
            ")",
            name=(
                "ck_receipt_records_target_shape"
            ),
        ),
        CheckConstraint(
            "("
            "appointment_id IS NULL "
            "OR target_type = 'booking_hold'"
            ")",
            name=(
                "ck_receipt_records_"
                "appointment_target"
            ),
        ),
        Index(
            "ix_receipt_records_target",
            "target_type",
            "target_id",
        ),
    )

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    receipt_number: Mapped[str] = mapped_column(
        String(80),
        unique=True,
        index=True,
        nullable=False,
    )

    payment_request_id: Mapped[str] = mapped_column(
        String,
        ForeignKey(
            "payment_requests.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )
    payment_reference: Mapped[str] = mapped_column(
        String(80),
        unique=True,
        index=True,
        nullable=False,
    )

    target_type: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
    )
    target_id: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    commerce_order_id: Mapped[str | None] = (
        mapped_column(
            String,
            ForeignKey(
                "commerce_orders.id",
                ondelete="CASCADE",
            ),
            nullable=True,
            index=True,
        )
    )
    appointment_id: Mapped[str | None] = (
        mapped_column(
            String,
            nullable=True,
            index=True,
        )
    )

    customer_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    customer_email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    customer_phone: Mapped[str | None] = (
        mapped_column(
            String(80),
            nullable=True,
        )
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
    )

    provider: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
    )
    provider_reference: Mapped[str | None] = (
        mapped_column(
            String(255),
            nullable=True,
        )
    )
    provider_transaction_reference: Mapped[
        str | None
    ] = mapped_column(
        String(255),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(80),
        default="issued",
        nullable=False,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    issued_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
        nullable=False,
    )
    voided_at: Mapped[datetime | None] = (
        mapped_column(
            DateTime,
            nullable=True,
        )
    )
    created_by_user_id: Mapped[str | None] = (
        mapped_column(
            String,
            nullable=True,
        )
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )


class ReceiptEvent(Base):
    __tablename__ = "receipt_events"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid4()),
    )

    receipt_id: Mapped[str] = mapped_column(
        String,
        ForeignKey(
            "receipt_records.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    event_type: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )
    from_status: Mapped[str | None] = (
        mapped_column(
            String(80),
            nullable=True,
        )
    )
    to_status: Mapped[str | None] = mapped_column(
        String(80),
        nullable=True,
    )
    actor_user_id: Mapped[str | None] = (
        mapped_column(
            String,
            nullable=True,
        )
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
        nullable=False,
    )
