from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.users.models import User


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
                "Assigned therapist resources are not "
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
