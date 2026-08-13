from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utc_now


class ClientRecord(Base):
    __tablename__ = "client_records"
    __table_args__ = (
        UniqueConstraint("email", name="uq_client_records_email"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    client_number: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)

    full_name: Mapped[str] = mapped_column(String(220), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(80), nullable=True)

    status: Mapped[str] = mapped_column(String(80), default="lead", nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(80), default="manual", nullable=False, index=True)
    preferred_contact_method: Mapped[str] = mapped_column(String(80), default="email", nullable=False)

    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class ClientRecordLink(Base):
    __tablename__ = "client_record_links"
    __table_args__ = (
        UniqueConstraint(
            "client_record_id",
            "link_type",
            "linked_record_id",
            name="uq_client_record_links_record",
        ),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))

    client_record_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("client_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    link_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    linked_record_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    label: Mapped[str | None] = mapped_column(String(220), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
