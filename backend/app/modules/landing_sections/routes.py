from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.dependencies import require_permission
from app.modules.landing_sections.models import LandingSection
from app.modules.landing_sections.schemas import LandingSectionCreate, LandingSectionRead, LandingSectionUpdate
from app.modules.users.models import User

router = APIRouter()


@router.get("", response_model=list[LandingSectionRead])
def list_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("landing_sections.read")),
):
    return db.scalars(select(LandingSection).order_by(LandingSection.sort_order)).all()



@router.get("/public/{page}", response_model=list[LandingSectionRead])
def public_page_sections(
    page: str,
    db: Session = Depends(get_db),
):
    allowed_pages = {"home", "about", "contact"}
    if page not in allowed_pages:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found.")

    prefix = f"{page}."
    return db.scalars(
        select(LandingSection)
        .where(LandingSection.key.startswith(prefix))
        .where(LandingSection.is_visible.is_(True))
        .order_by(LandingSection.sort_order)
    ).all()


@router.post("", response_model=LandingSectionRead)
def create_item(
    payload: LandingSectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("landing_sections.create")),
):
    item = LandingSection(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=LandingSectionRead)
def update_item(
    item_id: str,
    payload: LandingSectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("landing_sections.update")),
):
    item = db.scalar(select(LandingSection).where(LandingSection.id == item_id))
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found.")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    db.add(item)
    db.commit()
    db.refresh(item)
    return item
