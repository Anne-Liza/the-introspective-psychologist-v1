from datetime import datetime
from pydantic import BaseModel
class FileAssetRead(BaseModel):
    id: str; original_filename: str; stored_filename: str; content_type: str | None = None; size_bytes: int; storage_provider: str; storage_path: str; public_url: str | None = None; created_at: datetime
    model_config = {"from_attributes": True}
class FileAssetCreate(BaseModel):
    original_filename: str; stored_filename: str; content_type: str | None = None; size_bytes: int = 0; storage_provider: str = "local"; storage_path: str
