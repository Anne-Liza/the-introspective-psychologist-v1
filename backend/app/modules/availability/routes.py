from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.dependencies import require_permission
from app.modules.availability.models import AvailabilityException, AvailabilityRule
from app.modules.availability.schemas import (
    AvailabilityExceptionCreate,
    AvailabilityExceptionRead,
    AvailabilityExceptionUpdate,
    AvailabilityRuleCreate,
    AvailabilityRuleRead,
    AvailabilityRuleUpdate,
)
from app.modules.users.models import User

router = APIRouter()


def validate_rule_time_window(
    start_time,
    end_time,
) -> None:
    if end_time <= start_time:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_time must be after start_time.",
        )


def validate_exception_time_window(
    start_time,
    end_time,
) -> None:
    if (start_time is None) != (end_time is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "start_time and end_time must be "
                "provided together."
            ),
        )

    if (
        start_time is not None
        and end_time is not None
        and end_time <= start_time
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_time must be after start_time.",
        )


def resolve_assigned_therapist_profile_id(
    db: Session,
    current_user: User,
) -> str:
    try:
        from app.modules.therapist_profiles.models import (
            TherapistProfile,
        )
    except ModuleNotFoundError as exc:
        if (
            exc.name
            != "app.modules.therapist_profiles"
            and not str(exc.name).startswith(
                "app.modules.therapist_profiles."
            )
        ):
            raise

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Assigned-resource availability is not "
                "configured for this application."
            ),
        ) from exc

    profile = db.scalar(
        select(TherapistProfile).where(
            TherapistProfile.user_id == current_user.id
        )
    )

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Your account is not linked to a therapist "
                "profile. Ask a practice administrator to "
                "complete setup."
            ),
        )

    return profile.id


@router.get(
    "/my/rules",
    response_model=list[AvailabilityRuleRead],
)
def list_my_availability_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("availability.own.read")
    ),
):
    therapist_profile_id = (
        resolve_assigned_therapist_profile_id(
            db,
            current_user,
        )
    )

    return db.scalars(
        select(AvailabilityRule)
        .where(
            AvailabilityRule.therapist_profile_id
            == therapist_profile_id
        )
        .order_by(
            AvailabilityRule.day_of_week,
            AvailabilityRule.start_time,
            AvailabilityRule.sort_order,
        )
    ).all()


@router.post(
    "/my/rules",
    response_model=AvailabilityRuleRead,
)
def create_my_availability_rule(
    payload: AvailabilityRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("availability.own.create")
    ),
):
    therapist_profile_id = (
        resolve_assigned_therapist_profile_id(
            db,
            current_user,
        )
    )

    values = payload.model_dump()
    values["therapist_profile_id"] = (
        therapist_profile_id
    )

    rule = AvailabilityRule(**values)

    db.add(rule)
    db.commit()
    db.refresh(rule)

    return rule


@router.patch(
    "/my/rules/{rule_id}",
    response_model=AvailabilityRuleRead,
)
def update_my_availability_rule(
    rule_id: str,
    payload: AvailabilityRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("availability.own.update")
    ),
):
    therapist_profile_id = (
        resolve_assigned_therapist_profile_id(
            db,
            current_user,
        )
    )

    rule = db.scalar(
        select(AvailabilityRule).where(
            AvailabilityRule.id == rule_id,
            AvailabilityRule.therapist_profile_id
            == therapist_profile_id,
        )
    )

    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability rule not found.",
        )

    values = payload.model_dump(exclude_unset=True)
    values.pop("therapist_profile_id", None)

    validate_rule_time_window(
        values.get("start_time", rule.start_time),
        values.get("end_time", rule.end_time),
    )

    for key, value in values.items():
        setattr(rule, key, value)

    db.add(rule)
    db.commit()
    db.refresh(rule)

    return rule


@router.delete(
    "/my/rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_my_availability_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("availability.own.delete")
    ),
):
    therapist_profile_id = (
        resolve_assigned_therapist_profile_id(
            db,
            current_user,
        )
    )

    rule = db.scalar(
        select(AvailabilityRule).where(
            AvailabilityRule.id == rule_id,
            AvailabilityRule.therapist_profile_id
            == therapist_profile_id,
        )
    )

    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability rule not found.",
        )

    db.delete(rule)
    db.commit()

    return None


@router.get(
    "/my/exceptions",
    response_model=list[AvailabilityExceptionRead],
)
def list_my_availability_exceptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("availability.own.read")
    ),
):
    therapist_profile_id = (
        resolve_assigned_therapist_profile_id(
            db,
            current_user,
        )
    )

    return db.scalars(
        select(AvailabilityException)
        .where(
            AvailabilityException.therapist_profile_id
            == therapist_profile_id
        )
        .order_by(
            AvailabilityException.date,
            AvailabilityException.start_time,
        )
    ).all()


@router.post(
    "/my/exceptions",
    response_model=AvailabilityExceptionRead,
)
def create_my_availability_exception(
    payload: AvailabilityExceptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("availability.own.create")
    ),
):
    therapist_profile_id = (
        resolve_assigned_therapist_profile_id(
            db,
            current_user,
        )
    )

    values = payload.model_dump()
    values["therapist_profile_id"] = (
        therapist_profile_id
    )

    exception = AvailabilityException(**values)

    db.add(exception)
    db.commit()
    db.refresh(exception)

    return exception


@router.patch(
    "/my/exceptions/{exception_id}",
    response_model=AvailabilityExceptionRead,
)
def update_my_availability_exception(
    exception_id: str,
    payload: AvailabilityExceptionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("availability.own.update")
    ),
):
    therapist_profile_id = (
        resolve_assigned_therapist_profile_id(
            db,
            current_user,
        )
    )

    exception = db.scalar(
        select(AvailabilityException).where(
            AvailabilityException.id == exception_id,
            AvailabilityException.therapist_profile_id
            == therapist_profile_id,
        )
    )

    if exception is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability exception not found.",
        )

    values = payload.model_dump(exclude_unset=True)
    values.pop("therapist_profile_id", None)

    validate_exception_time_window(
        values.get("start_time", exception.start_time),
        values.get("end_time", exception.end_time),
    )

    for key, value in values.items():
        setattr(exception, key, value)

    db.add(exception)
    db.commit()
    db.refresh(exception)

    return exception


@router.delete(
    "/my/exceptions/{exception_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_my_availability_exception(
    exception_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("availability.own.delete")
    ),
):
    therapist_profile_id = (
        resolve_assigned_therapist_profile_id(
            db,
            current_user,
        )
    )

    exception = db.scalar(
        select(AvailabilityException).where(
            AvailabilityException.id == exception_id,
            AvailabilityException.therapist_profile_id
            == therapist_profile_id,
        )
    )

    if exception is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability exception not found.",
        )

    db.delete(exception)
    db.commit()

    return None


@router.get("/rules", response_model=list[AvailabilityRuleRead])
def list_availability_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("availability.read")),
):
    return db.scalars(
        select(AvailabilityRule).order_by(
            AvailabilityRule.day_of_week,
            AvailabilityRule.start_time,
            AvailabilityRule.sort_order,
        )
    ).all()


@router.post("/rules", response_model=AvailabilityRuleRead)
def create_availability_rule(
    payload: AvailabilityRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("availability.create")),
):
    rule = AvailabilityRule(**payload.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/rules/{rule_id}", response_model=AvailabilityRuleRead)
def update_availability_rule(
    rule_id: str,
    payload: AvailabilityRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("availability.update")),
):
    rule = db.scalar(select(AvailabilityRule).where(AvailabilityRule.id == rule_id))
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Availability rule not found.")

    values = payload.model_dump(exclude_unset=True)

    validate_rule_time_window(
        values.get("start_time", rule.start_time),
        values.get("end_time", rule.end_time),
    )

    for key, value in values.items():
        setattr(rule, key, value)

    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_availability_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("availability.delete")),
):
    rule = db.scalar(select(AvailabilityRule).where(AvailabilityRule.id == rule_id))
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Availability rule not found.")

    db.delete(rule)
    db.commit()
    return None


@router.get("/exceptions", response_model=list[AvailabilityExceptionRead])
def list_availability_exceptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("availability.read")),
):
    return db.scalars(
        select(AvailabilityException).order_by(
            AvailabilityException.date,
            AvailabilityException.start_time,
        )
    ).all()


@router.post("/exceptions", response_model=AvailabilityExceptionRead)
def create_availability_exception(
    payload: AvailabilityExceptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("availability.create")),
):
    exception = AvailabilityException(**payload.model_dump())
    db.add(exception)
    db.commit()
    db.refresh(exception)
    return exception


@router.patch("/exceptions/{exception_id}", response_model=AvailabilityExceptionRead)
def update_availability_exception(
    exception_id: str,
    payload: AvailabilityExceptionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("availability.update")),
):
    exception = db.scalar(select(AvailabilityException).where(AvailabilityException.id == exception_id))
    if exception is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Availability exception not found.")

    values = payload.model_dump(exclude_unset=True)

    validate_exception_time_window(
        values.get("start_time", exception.start_time),
        values.get("end_time", exception.end_time),
    )

    for key, value in values.items():
        setattr(exception, key, value)

    db.add(exception)
    db.commit()
    db.refresh(exception)
    return exception


@router.delete("/exceptions/{exception_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_availability_exception(
    exception_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("availability.delete")),
):
    exception = db.scalar(select(AvailabilityException).where(AvailabilityException.id == exception_id))
    if exception is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Availability exception not found.")

    db.delete(exception)
    db.commit()
    return None
