from pydantic import BaseModel, EmailStr


class ContactMessageCreate(BaseModel):
    name: str
    email: EmailStr
    subject: str | None = None
    message: str
    source: str | None = None


class ContactMessageUpdate(BaseModel):
    is_read: bool | None = None


class ContactMessageRead(BaseModel):
    id: str
    name: str
    email: EmailStr
    subject: str | None = None
    message: str
    source: str | None = None
    is_read: bool
    created_at: object

    model_config = {"from_attributes": True}
