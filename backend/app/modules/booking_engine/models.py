from datetime import date, datetime, time
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utc_now


class BookingScheduleLock(Base):
    __tablename__ = "booking_schedule_locks"
    __table_args__ = (
        UniqueConstraint(
            "therapist_profile_id",
            "schedule_date",
            name=("uq_booking_schedule_locks_" "therapist_date"),
        ),
    )

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    therapist_profile_id: Mapped[str] = mapped_column(
        String,
        ForeignKey(
            "therapist_profiles.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    schedule_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
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


class BookingHold(Base):
    __tablename__ = "booking_holds"
    __table_args__ = (
        CheckConstraint(
            "quoted_price_amount IS NULL " "OR quoted_price_amount >= 0",
            name=("ck_booking_holds_" "quoted_price_non_negative"),
        ),
        CheckConstraint(
            "advance_payment_amount IS NULL " "OR advance_payment_amount > 0",
            name=("ck_booking_holds_" "advance_payment_positive"),
        ),
        CheckConstraint(
            "deposit_percentage_snapshot IS NULL "
            "OR (deposit_percentage_snapshot >= 1 "
            "AND deposit_percentage_snapshot <= 99)",
            name=("ck_booking_holds_" "deposit_percentage_range"),
        ),
    )

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    hold_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    start_time: Mapped[time] = mapped_column(
        nullable=False,
    )
    end_time: Mapped[time] = mapped_column(
        nullable=False,
    )

    service_id: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )
    therapist_profile_id: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )
    session_format: Mapped[str | None] = mapped_column(
        String(220),
        nullable=True,
    )
    location: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    client_name: Mapped[str | None] = mapped_column(
        String(220),
        nullable=True,
    )
    client_email: Mapped[str | None] = mapped_column(
        String(320),
        nullable=True,
    )
    client_phone: Mapped[str | None] = mapped_column(
        String(80),
        nullable=True,
    )

    payment_policy_snapshot: Mapped[str | None] = mapped_column(
        String(40),
        nullable=True,
    )
    confirmation_mode_snapshot: Mapped[str | None] = mapped_column(
        String(40),
        nullable=True,
    )
    quoted_price_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )
    advance_payment_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )
    payment_currency: Mapped[str | None] = mapped_column(
        String(3),
        nullable=True,
    )
    deposit_percentage_snapshot: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(40),
        default="active",
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
    )
    appointment_id: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    sort_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
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


class BookingSetting(Base):
    __tablename__ = "booking_settings"
    __table_args__ = (
        CheckConstraint(
            "payment_policy IN " "('none', 'pay_later', 'deposit', " "'full_upfront')",
            name=("ck_booking_settings_" "payment_policy"),
        ),
        CheckConstraint(
            "confirmation_mode IN " "('instant', 'staff_approval')",
            name=("ck_booking_settings_" "confirmation_mode"),
        ),
        CheckConstraint(
            "deposit_percentage IS NULL OR "
            "(deposit_percentage >= 1 AND "
            "deposit_percentage <= 99)",
            name=("ck_booking_settings_" "deposit_percentage"),
        ),
        CheckConstraint(
            "(payment_policy = 'deposit' AND "
            "deposit_percentage IS NOT NULL) OR "
            "(payment_policy != 'deposit' AND "
            "deposit_percentage IS NULL)",
            name=("ck_booking_settings_" "deposit_policy"),
        ),
    )

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default="practice-default",
    )
    payment_policy: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )
    deposit_percentage: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    confirmation_mode: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )
    recommended_payment_provider: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
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
