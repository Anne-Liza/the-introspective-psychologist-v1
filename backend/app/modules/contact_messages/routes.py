from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rate_limit import enforce_public_action_rate_limit
from app.modules.auth.dependencies import require_permission
from app.modules.contact_messages.models import ContactMessage
from app.modules.contact_messages.schemas import (
    ContactMessageCreate,
    ContactMessageRead,
    ContactMessageUpdate,
)
from app.modules.users.models import User

router = APIRouter()


@router.post("", response_model=ContactMessageRead)
def create_contact_message(
    payload: ContactMessageCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_public_action_rate_limit(request, scope="contact_submission")
    message = ContactMessage(**payload.model_dump())
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


@router.get("", response_model=list[ContactMessageRead])
def list_contact_messages(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("contact_messages.read")),
):
    return db.scalars(select(ContactMessage).order_by(ContactMessage.created_at.desc())).all()


@router.patch("/{message_id}", response_model=ContactMessageRead)
def update_contact_message(
    message_id: str,
    payload: ContactMessageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("contact_messages.update")),
):
    message = db.scalar(select(ContactMessage).where(ContactMessage.id == message_id))
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found.")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(message, key, value)

    db.add(message)
    db.commit()
    db.refresh(message)
    return message


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact_message(
    message_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("contact_messages.delete")),
):
    message = db.scalar(select(ContactMessage).where(ContactMessage.id == message_id))
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found.")

    db.delete(message)
    db.commit()
    return None
