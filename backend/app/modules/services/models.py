from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utc_now


class Service(Base):
    __tablename__ = "services"
    __table_args__ = (
        CheckConstraint(
            "payment_policy_override IS NULL OR "
            "payment_policy_override IN "
            "('none', 'pay_later', 'deposit', "
            "'full_upfront')",
            name=("ck_services_" "payment_policy_override"),
        ),
        CheckConstraint(
            "confirmation_mode_override IS NULL OR "
            "confirmation_mode_override IN "
            "('instant', 'staff_approval')",
            name=("ck_services_" "confirmation_mode_override"),
        ),
        CheckConstraint(
            "deposit_percentage_override IS NULL OR "
            "(deposit_percentage_override >= 1 AND "
            "deposit_percentage_override <= 99)",
            name=("ck_services_" "deposit_percentage_override"),
        ),
        CheckConstraint(
            "("
            "payment_policy_override = 'deposit' "
            "AND deposit_percentage_override "
            "IS NOT NULL"
            ") OR ("
            "("
            "payment_policy_override IS NULL OR "
            "payment_policy_override != 'deposit'"
            ") AND deposit_percentage_override "
            "IS NULL"
            ")",
            name=("ck_services_" "deposit_override_policy"),
        ),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(220), nullable=False)
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(160), nullable=True)
    service_format: Mapped[str | None] = mapped_column(String(220), nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(
        String(3),
        nullable=True,
    )
    payment_policy_override: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )
    deposit_percentage_override: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    confirmation_mode_override: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )
    cta_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    cta_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)
