from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utc_now


class PaymentAttempt(Base):
    __tablename__ = "payment_attempts"
    __table_args__ = (
        UniqueConstraint("provider", "provider_reference", name="uq_payment_attempts_provider_reference"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    attempt_number: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)

    payment_request_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("payment_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    provider: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    provider_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_transaction_reference: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    provider_session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)

    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    status: Mapped[str] = mapped_column(String(80), default="created", nullable=False, index=True)
    verification_status: Mapped[str] = mapped_column(String(80), default="unverified", nullable=False)

    checkout_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(120), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    initiated_by_user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class PaymentProviderEvent(Base):
    __tablename__ = "payment_provider_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))

    payment_attempt_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("payment_attempts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    payment_request_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("payment_requests.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    provider: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    provider_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_transaction_reference: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    external_event_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    event_type: Mapped[str] = mapped_column(String(120), nullable=False)
    event_status: Mapped[str] = mapped_column(String(80), default="received", nullable=False)
    verification_status: Mapped[str] = mapped_column(String(80), default="unverified", nullable=False)

    amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)

    event_fingerprint: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    payload_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_duplicate: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    original_event_id: Mapped[str | None] = mapped_column(String, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
