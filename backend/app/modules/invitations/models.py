from datetime import datetime
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utc_now


class Invitation(Base):
    __tablename__ = "invitations"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'accepted', 'revoked', 'expired')",
            name="ck_invitations_status",
        ),
        CheckConstraint(
            "delivery_status IN ('queued', 'sent', 'failed')",
            name="ck_invitations_delivery_status",
        ),
        CheckConstraint(
            "(status = 'pending' AND token_hash IS NOT NULL AND pending_email_key IS NOT NULL) "
            "OR (status <> 'pending' AND token_hash IS NULL AND pending_email_key IS NULL)",
            name="ck_invitations_pending_secrets",
        ),
        CheckConstraint(
            "(status = 'accepted' AND accepted_at IS NOT NULL AND accepted_by_user_id IS NOT NULL) "
            "OR (status <> 'accepted' AND accepted_at IS NULL AND accepted_by_user_id IS NULL)",
            name="ck_invitations_accepted_state",
        ),
        CheckConstraint(
            "(status = 'revoked' AND revoked_at IS NOT NULL AND revoked_by_user_id IS NOT NULL) "
            "OR (status <> 'revoked' AND revoked_at IS NULL AND revoked_by_user_id IS NULL)",
            name="ck_invitations_revoked_state",
        ),
        CheckConstraint(
            "(status = 'expired' AND expired_at IS NOT NULL) "
            "OR (status <> 'expired' AND expired_at IS NULL)",
            name="ck_invitations_expired_state",
        ),
        UniqueConstraint("token_hash", name="uq_invitations_token_hash"),
        UniqueConstraint("pending_email_key", name="uq_invitations_pending_email_key"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    pending_email_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role_name: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="pending", index=True, nullable=False)
    delivery_status: Mapped[str] = mapped_column(
        String(40),
        default="queued",
        index=True,
        nullable=False,
    )
    invited_by_user_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    accepted_by_user_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )
    revoked_by_user_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expired_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_sent_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    send_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )
