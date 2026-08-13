from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utc_now


class AppSetting(Base):
    __tablename__ = "app_settings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    key: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_type: Mapped[str] = mapped_column(String(50), default="string")
    group: Mapped[str] = mapped_column(String(80), default="general")
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_secret: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)
