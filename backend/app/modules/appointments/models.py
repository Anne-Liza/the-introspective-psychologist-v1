from datetime import date, datetime, time
from uuid import uuid4

from sqlalchemy import Date, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utc_now


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    appointment_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(nullable=False)
    end_time: Mapped[time] = mapped_column(nullable=False)

    client_name: Mapped[str] = mapped_column(String(220), nullable=False)
    client_email: Mapped[str] = mapped_column(String(320), nullable=False)
    client_phone: Mapped[str | None] = mapped_column(String(80), nullable=True)

    service_id: Mapped[str | None] = mapped_column(String, nullable=True)
    therapist_profile_id: Mapped[str | None] = mapped_column(String, nullable=True)

    status: Mapped[str] = mapped_column(String(40), default="requested", nullable=False)
    session_format: Mapped[str | None] = mapped_column(String(220), nullable=True)
    location: Mapped[str | None] = mapped_column(String(500), nullable=True)

    client_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    source: Mapped[str] = mapped_column(String(80), default="public_request", nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
