from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy import CheckConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utc_now


class PaymentRequest(Base):
    __tablename__ = "payment_requests"

    __table_args__ = (
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
                "ck_payment_requests_"
                "target_shape"
            ),
        ),
        Index(
            "ix_payment_requests_target",
            "target_type",
            "target_id",
        ),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    request_number: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)

    commerce_order_id: Mapped[str | None] = (
        mapped_column(
            String,
            ForeignKey(
                "commerce_orders.id",
                ondelete="CASCADE",
            ),
            nullable=True,
        )
    )

    target_type: Mapped[str] = mapped_column(
        String(40),
        default="commerce_order",
        nullable=False,
    )
    target_id: Mapped[str] = mapped_column(
        String,
        default=lambda context: (
            context.get_current_parameters()
            .get("commerce_order_id")
        ),
        nullable=False,
    )

    customer_name: Mapped[str] = mapped_column(String(220), nullable=False)
    customer_email: Mapped[str] = mapped_column(String(320), nullable=False)
    customer_phone: Mapped[str | None] = mapped_column(String(80), nullable=True)

    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    provider: Mapped[str] = mapped_column(String(80), default="manual", nullable=False)
    provider_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_transaction_reference: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    settlement_account_label: Mapped[str | None] = mapped_column(String(160), nullable=True)

    status: Mapped[str] = mapped_column(String(80), default="pending", index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_by_user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class PaymentRequestEvent(Base):
    __tablename__ = "payment_request_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    payment_request_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("payment_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    event_type: Mapped[str] = mapped_column(String(120), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(80), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(80), nullable=True)

    provider: Mapped[str | None] = mapped_column(String(80), nullable=True)
    provider_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_transaction_reference: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)

    actor_user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
