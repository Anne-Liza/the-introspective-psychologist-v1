from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rate_limit import enforce_public_action_rate_limit
from app.modules.auth.dependencies import require_permission
from app.modules.commerce_core.models import CommerceItem, CommerceOrder, CommerceOrderItem
from app.modules.commerce_core.schemas import (
    CommerceItemCreate,
    CommerceItemRead,
    CommerceItemUpdate,
    CommerceOrderCreate,
    CommerceOrderRead,
    CommerceOrderUpdate,
    PublicCommerceOrderCreate,
)
from app.modules.commerce_core.service import (
    attach_items,
    create_order_from_payload,
    create_public_order_from_payload,
    get_order_with_items,
)
from app.modules.users.models import User

router = APIRouter()


@router.get("/public/items", response_model=list[CommerceItemRead])
def list_public_commerce_items(db: Session = Depends(get_db)):
    return db.scalars(
        select(CommerceItem)
        .where(CommerceItem.is_published.is_(True))
        .order_by(CommerceItem.is_featured.desc(), CommerceItem.sort_order, CommerceItem.created_at.desc())
    ).all()


@router.get("/public/items/{slug}", response_model=CommerceItemRead)
def get_public_commerce_item(slug: str, db: Session = Depends(get_db)):
    item = db.scalar(
        select(CommerceItem).where(
            CommerceItem.slug == slug,
            CommerceItem.is_published.is_(True),
        )
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commerce item not found.")
    return item


@router.post("/public/orders", response_model=CommerceOrderRead, status_code=status.HTTP_201_CREATED)
def create_public_commerce_order(
    payload: PublicCommerceOrderCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_public_action_rate_limit(request, scope="checkout_order")

    try:
        order = create_public_order_from_payload(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    order, items = get_order_with_items(db, order.id)
    return attach_items(order, items)


@router.get("/items", response_model=list[CommerceItemRead])
def list_commerce_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("commerce_core.read")),
):
    return db.scalars(
        select(CommerceItem).order_by(CommerceItem.sort_order, CommerceItem.created_at.desc())
    ).all()


@router.post("/items", response_model=CommerceItemRead, status_code=status.HTTP_201_CREATED)
def create_commerce_item(
    payload: CommerceItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("commerce_core.create")),
):
    item = CommerceItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/items/{item_id}", response_model=CommerceItemRead)
def update_commerce_item(
    item_id: str,
    payload: CommerceItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("commerce_core.update")),
):
    item = db.scalar(select(CommerceItem).where(CommerceItem.id == item_id))
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commerce item not found.")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_commerce_item(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("commerce_core.delete")),
):
    item = db.scalar(select(CommerceItem).where(CommerceItem.id == item_id))
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commerce item not found.")

    db.delete(item)
    db.commit()
    return None


@router.get("/orders", response_model=list[CommerceOrderRead])
def list_commerce_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("commerce_core.read")),
):
    orders = db.scalars(select(CommerceOrder).order_by(CommerceOrder.created_at.desc())).all()
    results = []
    for order in orders:
        _order, items = get_order_with_items(db, order.id)
        results.append(attach_items(order, items))
    return results


@router.post("/orders", response_model=CommerceOrderRead, status_code=status.HTTP_201_CREATED)
def create_commerce_order(
    payload: CommerceOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("commerce_core.create")),
):
    payload.source = "admin_created"

    try:
        order = create_order_from_payload(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    order, items = get_order_with_items(db, order.id)
    return attach_items(order, items)


@router.get("/orders/{order_id}", response_model=CommerceOrderRead)
def get_commerce_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("commerce_core.read")),
):
    order, items = get_order_with_items(db, order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commerce order not found.")
    return attach_items(order, items)


@router.patch("/orders/{order_id}", response_model=CommerceOrderRead)
def update_commerce_order(
    order_id: str,
    payload: CommerceOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("commerce_core.update")),
):
    order, items = get_order_with_items(db, order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commerce order not found.")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(order, key, value)

    db.add(order)
    db.commit()
    db.refresh(order)

    order, items = get_order_with_items(db, order_id)
    return attach_items(order, items)


@router.delete("/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_commerce_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("commerce_core.delete")),
):
    order = db.scalar(select(CommerceOrder).where(CommerceOrder.id == order_id))
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commerce order not found.")

    db.execute(delete(CommerceOrderItem).where(CommerceOrderItem.order_id == order_id))
    db.delete(order)
    db.commit()
    return None
