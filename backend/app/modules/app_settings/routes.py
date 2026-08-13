from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.encryption import encrypt_text
from app.modules.app_settings.models import AppSetting
from app.modules.app_settings.schemas import AppSettingCreate, AppSettingRead
from app.modules.auth.dependencies import require_permission
from app.modules.users.models import User

router = APIRouter()



def serialize_app_setting(
    setting: AppSetting,
) -> AppSettingRead:
    return AppSettingRead(
        id=setting.id,
        key=setting.key,
        value=(
            None
            if setting.is_secret
            else setting.value
        ),
        value_type=setting.value_type,
        group=setting.group,
        description=setting.description,
        is_secret=setting.is_secret,
        is_configured=setting.value is not None,
    )

@router.get("", response_model=list[AppSettingRead])
def list_app_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("settings.read")),
):
    settings = db.scalars(select(AppSetting).order_by(AppSetting.group, AppSetting.key)).all()
    return [serialize_app_setting(setting) for setting in settings]


@router.post("", response_model=AppSettingRead)
def create_app_setting(
    payload: AppSettingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("settings.manage")),
):
    data = payload.model_dump()

    if data["is_secret"] and data["value"] is not None:
        data["value"] = encrypt_text(data["value"])

    setting = AppSetting(**data)
    db.add(setting)
    db.commit()
    db.refresh(setting)

    return serialize_app_setting(setting)
