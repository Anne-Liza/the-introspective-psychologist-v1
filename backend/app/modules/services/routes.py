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
from app.modules.services.models import Service
from app.modules.services.schemas import (
    ServiceCreate,
    ServiceRead,
    ServiceUpdate,
)
from app.modules.users.models import User

router = APIRouter()


def validate_service_payment_override(
    *,
    payment_policy: str | None,
    deposit_percentage: int | None,
) -> None:
    if payment_policy == "deposit":
        if deposit_percentage is None:
            raise HTTPException(
                status_code=(status.HTTP_422_UNPROCESSABLE_ENTITY),
                detail=(
                    "A deposit percentage is required "
                    "when the service payment rule is "
                    "deposit."
                ),
            )

        if not 1 <= deposit_percentage <= 99:
            raise HTTPException(
                status_code=(status.HTTP_422_UNPROCESSABLE_ENTITY),
                detail=("Deposit percentage must be " "between 1 and 99."),
            )

        return

    if deposit_percentage is not None:
        raise HTTPException(
            status_code=(status.HTTP_422_UNPROCESSABLE_ENTITY),
            detail=(
                "Deposit percentage may only be set " "when the service payment rule is " "deposit."
            ),
        )


@router.get(
    "/public",
    response_model=list[ServiceRead],
)
def list_public_services(
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(Service)
        .where(Service.is_published.is_(True))
        .order_by(
            Service.is_featured.desc(),
            Service.sort_order,
            Service.created_at.desc(),
        )
    ).all()


@router.get(
    "/public/{slug}",
    response_model=ServiceRead,
)
def get_public_service(
    slug: str,
    db: Session = Depends(get_db),
):
    service = db.scalar(
        select(Service).where(
            Service.slug == slug,
            Service.is_published.is_(True),
        )
    )

    if service is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found.",
        )

    return service


@router.get(
    "",
    response_model=list[ServiceRead],
)
def list_services(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("services.read")),
):
    return db.scalars(
        select(Service).order_by(
            Service.sort_order,
            Service.created_at.desc(),
        )
    ).all()


@router.post(
    "",
    response_model=ServiceRead,
)
def create_service(
    payload: ServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("services.create")),
):
    data = payload.model_dump()

    validate_service_payment_override(
        payment_policy=(data["payment_policy_override"]),
        deposit_percentage=(data["deposit_percentage_override"]),
    )

    service = Service(**data)
    db.add(service)
    db.commit()
    db.refresh(service)

    return service


@router.patch(
    "/{service_id}",
    response_model=ServiceRead,
)
def update_service(
    service_id: str,
    payload: ServiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("services.update")),
):
    service = db.scalar(select(Service).where(Service.id == service_id))

    if service is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found.",
        )

    changes = payload.model_dump(exclude_unset=True)

    effective_payment_policy = changes.get(
        "payment_policy_override",
        service.payment_policy_override,
    )
    effective_deposit_percentage = changes.get(
        "deposit_percentage_override",
        service.deposit_percentage_override,
    )

    validate_service_payment_override(
        payment_policy=effective_payment_policy,
        deposit_percentage=(effective_deposit_percentage),
    )

    for key, value in changes.items():
        setattr(service, key, value)

    db.add(service)
    db.commit()
    db.refresh(service)

    return service


@router.delete(
    "/{service_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_service(
    service_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("services.delete")),
):
    service = db.scalar(select(Service).where(Service.id == service_id))

    if service is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found.",
        )

    db.delete(service)
    db.commit()

    return None
