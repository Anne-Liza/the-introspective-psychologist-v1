from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.dependencies import require_permission
from app.modules.email_templates.models import EmailTemplate
from app.modules.email_templates.schemas import EmailTemplateCreate, EmailTemplateRead, EmailTemplateUpdate
from app.modules.users.models import User

router = APIRouter()


@router.get("", response_model=list[EmailTemplateRead])
def list_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("email_templates.read")),
):
    return db.scalars(select(EmailTemplate).order_by(EmailTemplate.key)).all()


@router.post("", response_model=EmailTemplateRead)
def create_item(
    payload: EmailTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("email_templates.create")),
):
    item = EmailTemplate(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=EmailTemplateRead)
def update_item(
    item_id: str,
    payload: EmailTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("email_templates.update")),
):
    item = db.scalar(select(EmailTemplate).where(EmailTemplate.id == item_id))
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found.")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    db.add(item)
    db.commit()
    db.refresh(item)
    return item
