from pydantic import BaseModel


class EmailTemplateBase(BaseModel):
    key: str
    name: str
    subject: str
    body: str
    description: str | None = None
    is_active: bool = True


class EmailTemplateCreate(EmailTemplateBase):
    pass


class EmailTemplateUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    body: str | None = None
    description: str | None = None
    is_active: bool | None = None


class EmailTemplateRead(EmailTemplateBase):
    id: str

    model_config = {"from_attributes": True}
