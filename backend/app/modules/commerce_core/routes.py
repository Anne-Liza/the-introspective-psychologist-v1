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
from app.modules.files.models import (
    FILE_PURPOSE_PRODUCT_IMAGE,
    FILE_VISIBILITY_INTERNAL,
    FILE_VISIBILITY_PRIVATE,
    FILE_VISIBILITY_PUBLIC,
    FileAsset,
)
from app.modules.files.service import (
    list_file_usage,
    register_file_usage,
    set_file_visibility,
    unregister_file_usage,
)
from app.modules.users.models import User


router = APIRouter()


COMMERCE_IMAGE_USAGE_TYPE = "commerce_item"
COMMERCE_IMAGE_USAGE_FIELD = "image"


def _validated_commerce_image_asset(
    db: Session,
    *,
    asset_id: str | None,
) -> FileAsset | None:
    if asset_id is None:
        return None

    asset = db.scalar(
        select(FileAsset).where(
            FileAsset.id == asset_id
        )
    )

    if asset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product image asset not found.",
        )

    if (
        asset.purpose
        != FILE_PURPOSE_PRODUCT_IMAGE
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "The selected asset is not "
                "a product image."
            ),
        )

    if not (
        asset.content_type
        and asset.content_type.startswith(
            "image/"
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "A product image asset must "
                "be an image file."
            ),
        )

    if (
        asset.visibility
        == FILE_VISIBILITY_PRIVATE
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Private assets cannot be "
                "used as product images."
            ),
        )

    return asset


def _commerce_image_public_url(
    db: Session,
    *,
    item: CommerceItem,
) -> str | None:
    if not item.image_asset_id:
        return item.image_url

    asset = db.scalar(
        select(FileAsset).where(
            FileAsset.id
            == item.image_asset_id
        )
    )

    if (
        asset is None
        or asset.visibility
        != FILE_VISIBILITY_PUBLIC
        or asset.purpose
        != FILE_PURPOSE_PRODUCT_IMAGE
        or not asset.content_type
        or not asset.content_type.startswith(
            "image/"
        )
    ):
        return None

    return (
        f"/files/public/{asset.id}"
    )


def _public_commerce_item_response(
    db: Session,
    item: CommerceItem,
) -> CommerceItemRead:
    response = (
        CommerceItemRead.model_validate(
            item
        )
    )

    return response.model_copy(
        update={
            "image_url":
                _commerce_image_public_url(
                    db,
                    item=item,
                )
        }
    )


def _sync_commerce_image_visibility(
    db: Session,
    *,
    asset_id: str | None,
) -> None:
    if not asset_id:
        return

    asset = db.scalar(
        select(FileAsset).where(
            FileAsset.id == asset_id
        )
    )

    if (
        asset is None
        or asset.purpose
        != FILE_PURPOSE_PRODUCT_IMAGE
    ):
        return

    usages = list_file_usage(
        db,
        file_id=asset_id,
    )

    commerce_item_ids = [
        usage.entity_id
        for usage in usages
        if (
            usage.entity_type
            == COMMERCE_IMAGE_USAGE_TYPE
            and usage.field_name
            == COMMERCE_IMAGE_USAGE_FIELD
        )
    ]

    has_published_usage = False

    if commerce_item_ids:
        has_published_usage = (
            db.scalar(
                select(
                    CommerceItem.id
                )
                .where(
                    CommerceItem.id.in_(
                        commerce_item_ids
                    ),
                    CommerceItem
                    .is_published
                    .is_(True),
                )
                .limit(1)
            )
            is not None
        )

    set_file_visibility(
        asset,
        visibility=(
            FILE_VISIBILITY_PUBLIC
            if has_published_usage
            else FILE_VISIBILITY_INTERNAL
        ),
    )


def _sync_commerce_image_usage(
    db: Session,
    *,
    item: CommerceItem,
    previous_asset_id: str | None,
) -> None:
    current_asset_id = (
        item.image_asset_id
    )

    if (
        previous_asset_id
        and previous_asset_id
        != current_asset_id
    ):
        unregister_file_usage(
            db,
            file_id=previous_asset_id,
            entity_type=(
                COMMERCE_IMAGE_USAGE_TYPE
            ),
            entity_id=item.id,
            field_name=(
                COMMERCE_IMAGE_USAGE_FIELD
            ),
        )

    if current_asset_id:
        register_file_usage(
            db,
            file_id=current_asset_id,
            entity_type=(
                COMMERCE_IMAGE_USAGE_TYPE
            ),
            entity_id=item.id,
            field_name=(
                COMMERCE_IMAGE_USAGE_FIELD
            ),
        )

    db.flush()

    if previous_asset_id:
        _sync_commerce_image_visibility(
            db,
            asset_id=previous_asset_id,
        )

    if current_asset_id:
        _sync_commerce_image_visibility(
            db,
            asset_id=current_asset_id,
        )


@router.get("/public/items", response_model=list[CommerceItemRead])
def list_public_commerce_items(db: Session = Depends(get_db)):
    items = db.scalars(
        select(CommerceItem)
        .where(
            CommerceItem
            .is_published
            .is_(True)
        )
        .order_by(
            CommerceItem
            .is_featured
            .desc(),
            CommerceItem.sort_order,
            CommerceItem
            .created_at
            .desc(),
        )
    ).all()

    return [
        _public_commerce_item_response(
            db,
            item,
        )
        for item in items
    ]


@router.get("/public/items/{slug}", response_model=CommerceItemRead)
def get_public_commerce_item(slug: str, db: Session = Depends(get_db)):
    item = db.scalar(
        select(CommerceItem).where(
            CommerceItem.slug == slug,
            CommerceItem.is_published.is_(True),
        )
    )
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Commerce item not found.",
        )

    return _public_commerce_item_response(
        db,
        item,
    )


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
    values = payload.model_dump()

    selected_asset_id = (
        values.get("image_asset_id")
    )

    if selected_asset_id:
        _validated_commerce_image_asset(
            db,
            asset_id=selected_asset_id,
        )

        values["image_url"] = None

    item = CommerceItem(**values)

    db.add(item)
    db.flush()

    _sync_commerce_image_usage(
        db,
        item=item,
        previous_asset_id=None,
    )

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

    previous_asset_id = (
        item.image_asset_id
    )

    values = payload.model_dump(
        exclude_unset=True,
    )

    if "image_asset_id" in values:
        selected_asset_id = (
            values["image_asset_id"]
        )

        if selected_asset_id:
            _validated_commerce_image_asset(
                db,
                asset_id=selected_asset_id,
            )

            values["image_url"] = None

        elif "image_url" not in values:
            values["image_url"] = None

    elif (
        "image_url" in values
        and values["image_url"]
    ):
        values["image_asset_id"] = None

    for key, value in values.items():
        setattr(item, key, value)

    db.add(item)
    db.flush()

    _sync_commerce_image_usage(
        db,
        item=item,
        previous_asset_id=(
            previous_asset_id
        ),
    )

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

    previous_asset_id = (
        item.image_asset_id
    )

    if previous_asset_id:
        unregister_file_usage(
            db,
            file_id=previous_asset_id,
            entity_type=(
                COMMERCE_IMAGE_USAGE_TYPE
            ),
            entity_id=item.id,
            field_name=(
                COMMERCE_IMAGE_USAGE_FIELD
            ),
        )

    db.delete(item)
    db.flush()

    if previous_asset_id:
        _sync_commerce_image_visibility(
            db,
            asset_id=previous_asset_id,
        )

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
