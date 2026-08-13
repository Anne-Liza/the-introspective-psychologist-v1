from datetime import datetime

from pydantic import BaseModel, EmailStr


class EmailLogRead(BaseModel):
    id: str
    to_email: EmailStr
    subject: str
    provider: str
    status: str
    error_message: str | None = None
    created_at: datetime
    sent_at: datetime | None = None

    model_config = {"from_attributes": True}
