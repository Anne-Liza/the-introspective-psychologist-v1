from pydantic import BaseModel, Field


class PermissionRead(BaseModel):
    id: str
    code: str
    description: str | None = None

    model_config = {"from_attributes": True}


class RoleRead(BaseModel):
    id: str
    name: str
    description: str | None = None
    permissions: list[PermissionRead] = Field(default_factory=list)

    model_config = {"from_attributes": True}
