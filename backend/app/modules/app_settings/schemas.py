from pydantic import BaseModel


class AppSettingRead(BaseModel):
    id: str
    key: str
    value: str | None = None
    value_type: str
    group: str
    description: str | None = None
    is_secret: bool = False
    is_configured: bool = False

    model_config = {"from_attributes": True}


class AppSettingCreate(BaseModel):
    key: str
    value: str | None = None
    value_type: str = "string"
    group: str = "general"
    description: str | None = None
    is_secret: bool = False
