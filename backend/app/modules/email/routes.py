from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.dependencies import require_permission
from app.modules.email.models import EmailLog
from app.modules.email.schemas import EmailLogRead
from app.modules.users.models import User

router = APIRouter()


@router.get("/logs", response_model=list[EmailLogRead])
def list_email_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("email_logs.read")),
):
    return db.scalars(select(EmailLog).order_by(EmailLog.created_at.desc()).limit(100)).all()
