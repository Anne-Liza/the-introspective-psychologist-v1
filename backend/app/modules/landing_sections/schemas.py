from pydantic import BaseModel, field_validator

from app.core.url_safety import validate_public_url_or_path


class LandingSectionBase(BaseModel):
    key: str
    title: str
    eyebrow: str | None = None
    body: str | None = None
    cta_label: str | None = None
    cta_url: str | None = None
    image_url: str | None = None
    sort_order: int = 0
    is_visible: bool = True


    @field_validator("cta_url", "image_url")
    @classmethod
    def validate_public_urls(cls, value: str | None) -> str | None:
        return validate_public_url_or_path(value)


class LandingSectionCreate(LandingSectionBase):
    pass


class LandingSectionUpdate(BaseModel):
    title: str | None = None
    eyebrow: str | None = None
    body: str | None = None
    cta_label: str | None = None
    cta_url: str | None = None
    image_url: str | None = None
    sort_order: int | None = None
    is_visible: bool | None = None


    @field_validator("cta_url", "image_url")
    @classmethod
    def validate_update_public_urls(cls, value: str | None) -> str | None:
        return validate_public_url_or_path(value)


class LandingSectionRead(LandingSectionBase):
    id: str

    model_config = {"from_attributes": True}
