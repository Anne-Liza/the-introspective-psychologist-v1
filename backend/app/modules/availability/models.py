from datetime import date, datetime, time
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utc_now


class AvailabilityRule(Base):
    __tablename__ = "availability_rules"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    title: Mapped[str] = mapped_column(String(220), nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    timezone: Mapped[str] = mapped_column(String(80), default="Africa/Nairobi", nullable=False)
    slot_duration_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    buffer_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    service_id: Mapped[str | None] = mapped_column(String, nullable=True)
    therapist_profile_id: Mapped[str | None] = mapped_column(String, nullable=True)
    session_format: Mapped[str | None] = mapped_column(String(220), nullable=True)
    location: Mapped[str | None] = mapped_column(String(220), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class AvailabilityException(Base):
    __tablename__ = "availability_exceptions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    exception_type: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    service_id: Mapped[str | None] = mapped_column(String, nullable=True)
    therapist_profile_id: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
