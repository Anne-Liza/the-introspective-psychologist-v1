from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utc_now


class TherapistProfile(Base):
    __tablename__ = "therapist_profiles"
    __table_args__ = (
        CheckConstraint(
            "review_status IN " "('draft', 'pending_review', " "'changes_requested', 'approved')",
            name="ck_therapist_profiles_review_status",
        ),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        unique=True,
        index=True,
        nullable=True,
    )
    full_name: Mapped[str] = mapped_column(String(220), nullable=False)
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    title: Mapped[str | None] = mapped_column(String(220), nullable=True)
    short_bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    specialties: Mapped[str | None] = mapped_column(Text, nullable=True)
    approaches: Mapped[str | None] = mapped_column(Text, nullable=True)
    languages: Mapped[str | None] = mapped_column(String(500), nullable=True)
    location: Mapped[str | None] = mapped_column(String(220), nullable=True)
    session_formats: Mapped[str | None] = mapped_column(String(500), nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    booking_cta_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    booking_cta_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    review_status: Mapped[str] = mapped_column(
        String(32),
        default="draft",
        server_default="draft",
        index=True,
        nullable=False,
    )
    reviewed_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )
    review_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)


class TherapistProfileRevision(Base):
    """Versioned professional content awaiting review or already published."""

    __tablename__ = "therapist_profile_revisions"
    __table_args__ = (
        CheckConstraint(
            "review_status IN " "('draft', 'pending_review', " "'changes_requested', 'approved')",
            name="ck_therapist_profile_revisions_review_status",
        ),
        UniqueConstraint(
            "therapist_profile_id",
            "version_number",
            name="uq_therapist_profile_revision_version",
        ),
    )

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    therapist_profile_id: Mapped[str] = mapped_column(
        ForeignKey("therapist_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # Versioned public professional content.
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    short_bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    specialties: Mapped[str | None] = mapped_column(Text, nullable=True)
    approaches: Mapped[str | None] = mapped_column(Text, nullable=True)
    languages: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(Text, nullable=True)
    session_formats: Mapped[str | None] = mapped_column(Text, nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # Review lifecycle belongs to the content version, not the live identity.
    review_status: Mapped[str] = mapped_column(
        String(32),
        default="draft",
        server_default="draft",
        nullable=False,
        index=True,
    )
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )
    reviewed_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )
    review_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Editing provenance.
    created_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Publication provenance. Existing migrated publications may have no
    # historical timestamp/actor because that information did not exist.
    is_current_publication: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )
    published_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
        onupdate=utc_now,
    )
