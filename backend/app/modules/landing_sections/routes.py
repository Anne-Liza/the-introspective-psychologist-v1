from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.dependencies import (
    require_permission,
)
from app.modules.files.models import (
    FILE_PURPOSE_LANDING_SECTION_IMAGE,
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
from app.modules.landing_sections.models import (
    LandingSection,
)
from app.modules.landing_sections.schemas import (
    LandingSectionCreate,
    LandingSectionRead,
    LandingSectionUpdate,
)
from app.modules.users.models import User


router = APIRouter()


LANDING_IMAGE_USAGE_TYPE = "landing_section"
LANDING_IMAGE_USAGE_FIELD = "image"


def _validated_landing_image_asset(
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
            detail="Landing section image asset not found.",
        )

    if (
        asset.purpose
        != FILE_PURPOSE_LANDING_SECTION_IMAGE
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "The selected asset is not "
                "a landing section image."
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
                "A landing section image asset "
                "must be an image file."
            ),
        )

    if (
        asset.visibility
        == FILE_VISIBILITY_PRIVATE
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Private assets cannot be used "
                "as landing section images."
            ),
        )

    return asset


def _landing_image_public_url(
    db: Session,
    *,
    section: LandingSection,
) -> str | None:
    if not section.image_asset_id:
        return section.image_url

    asset = db.scalar(
        select(FileAsset).where(
            FileAsset.id
            == section.image_asset_id
        )
    )

    if (
        asset is None
        or asset.visibility
        != FILE_VISIBILITY_PUBLIC
        or asset.purpose
        != FILE_PURPOSE_LANDING_SECTION_IMAGE
        or not asset.content_type
        or not asset.content_type.startswith(
            "image/"
        )
    ):
        return None

    return (
        f"/files/public/{asset.id}"
    )


def _public_landing_section_response(
    db: Session,
    section: LandingSection,
) -> LandingSectionRead:
    response = (
        LandingSectionRead.model_validate(
            section
        )
    )

    return response.model_copy(
        update={
            "image_url":
                _landing_image_public_url(
                    db,
                    section=section,
                )
        }
    )


def _sync_landing_image_visibility(
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
        != FILE_PURPOSE_LANDING_SECTION_IMAGE
    ):
        return

    usages = list_file_usage(
        db,
        file_id=asset_id,
    )

    section_ids = [
        usage.entity_id
        for usage in usages
        if (
            usage.entity_type
            == LANDING_IMAGE_USAGE_TYPE
            and usage.field_name
            == LANDING_IMAGE_USAGE_FIELD
        )
    ]

    has_visible_usage = False

    if section_ids:
        has_visible_usage = (
            db.scalar(
                select(
                    LandingSection.id
                )
                .where(
                    LandingSection.id.in_(
                        section_ids
                    ),
                    LandingSection
                    .is_visible
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
            if has_visible_usage
            else FILE_VISIBILITY_INTERNAL
        ),
    )


def _sync_landing_image_usage(
    db: Session,
    *,
    section: LandingSection,
    previous_asset_id: str | None,
) -> None:
    current_asset_id = (
        section.image_asset_id
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
                LANDING_IMAGE_USAGE_TYPE
            ),
            entity_id=section.id,
            field_name=(
                LANDING_IMAGE_USAGE_FIELD
            ),
        )

    if current_asset_id:
        register_file_usage(
            db,
            file_id=current_asset_id,
            entity_type=(
                LANDING_IMAGE_USAGE_TYPE
            ),
            entity_id=section.id,
            field_name=(
                LANDING_IMAGE_USAGE_FIELD
            ),
        )

    db.flush()

    if previous_asset_id:
        _sync_landing_image_visibility(
            db,
            asset_id=previous_asset_id,
        )

    if current_asset_id:
        _sync_landing_image_visibility(
            db,
            asset_id=current_asset_id,
        )


@router.get(
    "",
    response_model=list[LandingSectionRead],
)
def list_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "landing_sections.read"
        )
    ),
):
    return db.scalars(
        select(LandingSection).order_by(
            LandingSection.sort_order
        )
    ).all()


@router.get(
    "/public/{page}",
    response_model=list[LandingSectionRead],
)
def public_page_sections(
    page: str,
    db: Session = Depends(get_db),
):
    allowed_pages = {
        "home",
        "about",
        "contact",
    }

    if page not in allowed_pages:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Page not found.",
        )

    prefix = f"{page}."

    sections = db.scalars(
        select(LandingSection)
        .where(
            LandingSection.key.startswith(
                prefix
            )
        )
        .where(
            LandingSection
            .is_visible
            .is_(True)
        )
        .order_by(
            LandingSection.sort_order
        )
    ).all()

    return [
        _public_landing_section_response(
            db,
            section,
        )
        for section in sections
    ]


@router.post(
    "",
    response_model=LandingSectionRead,
)
def create_item(
    payload: LandingSectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "landing_sections.create"
        )
    ),
):
    values = payload.model_dump()

    selected_asset_id = (
        values.get("image_asset_id")
    )

    if selected_asset_id:
        _validated_landing_image_asset(
            db,
            asset_id=selected_asset_id,
        )

        values["image_url"] = None

    item = LandingSection(**values)

    db.add(item)
    db.flush()

    _sync_landing_image_usage(
        db,
        section=item,
        previous_asset_id=None,
    )

    db.commit()
    db.refresh(item)

    return item


@router.patch(
    "/{item_id}",
    response_model=LandingSectionRead,
)
def update_item(
    item_id: str,
    payload: LandingSectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "landing_sections.update"
        )
    ),
):
    item = db.scalar(
        select(LandingSection).where(
            LandingSection.id == item_id
        )
    )

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found.",
        )

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
            _validated_landing_image_asset(
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

    _sync_landing_image_usage(
        db,
        section=item,
        previous_asset_id=(
            previous_asset_id
        ),
    )

    db.commit()
    db.refresh(item)

    return item
