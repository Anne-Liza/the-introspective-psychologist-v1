import re
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.database import get_db
from app.modules.auth.dependencies import require_permission
from app.modules.booking_engine.service import (
    public_therapist_bookable_service_ids,
)
from app.modules.email.service import send_email
from app.modules.roles.models import Role
from app.modules.therapist_profiles.models import (
    TherapistProfile,
    TherapistProfileRevision,
)
from app.modules.therapist_profiles.schemas import (
    TherapistProfileAccountLink,
    TherapistProfileAccountOptionRead,
    TherapistProfileAdminReviewRead,
    TherapistProfileCreate,
    TherapistProfilePublicRead,
    TherapistProfileRead,
    TherapistProfileReviewRequest,
    TherapistProfileRevisionAdminUpdate,
    TherapistProfileRevisionRead,
    TherapistProfileSelfCreate,
    TherapistProfileSelfRead,
    TherapistProfileSelfUpdate,
    TherapistProfileUpdate,
)
from app.modules.therapist_profiles.service import (
    REVIEW_APPROVED,
    REVIEW_CHANGES_REQUESTED,
    REVIEW_DRAFT,
    REVIEW_PENDING,
    build_revision_from_profile,
    publish_profile_revision,
    review_profile,
    submit_profile_for_review,
)
from app.modules.users.models import User

router = APIRouter()


def _active_practice_admins(db: Session) -> list[User]:
    return list(
        db.scalars(
            select(User)
            .join(User.roles)
            .where(
                Role.name == "Practice Admin",
                User.is_active.is_(True),
            )
        )
        .unique()
        .all()
    )


def _notify_practice_admins_profile_submitted(
    db: Session,
    *,
    profile: TherapistProfile,
    revision_id: str,
) -> None:
    review_url = (
        f"{settings.FRONTEND_BASE_URL}"
        f"/dashboard/therapist-profiles/reviews/{revision_id}"
    )

    for admin in _active_practice_admins(db):
        send_email(
            db,
            to_email=admin.email,
            subject=(
                f"Therapist profile awaiting review: "
                f"{profile.full_name}"
            ),
            body=(
                f"{profile.full_name} submitted a therapist "
                "profile for review.\n\n"
                f"Review therapist profiles: {review_url}"
            ),
        )


def _notify_therapist_review_result(
    db: Session,
    *,
    profile: TherapistProfile,
    decision: str,
) -> None:
    if not profile.user_id:
        return

    therapist = db.scalar(
        select(User).where(User.id == profile.user_id)
    )
    if therapist is None or not therapist.is_active:
        return

    profile_url = (
        f"{settings.FRONTEND_BASE_URL}/dashboard/my-profile"
    )

    if decision == REVIEW_CHANGES_REQUESTED:
        subject = "Changes requested for your therapist profile"
        message = (
            "Your therapist profile has been reviewed and "
            "changes were requested."
        )
    else:
        subject = "Your therapist profile has been approved"
        message = (
            "Your therapist profile has been approved and is "
            "awaiting publication."
        )

    send_email(
        db,
        to_email=therapist.email,
        subject=subject,
        body=f"{message}\n\nView your profile: {profile_url}",
    )


def _notify_therapist_profile_published(
    db: Session,
    *,
    profile: TherapistProfile,
) -> None:
    if not profile.user_id:
        return

    therapist = db.scalar(
        select(User).where(User.id == profile.user_id)
    )
    if therapist is None or not therapist.is_active:
        return

    public_url = (
        f"{settings.FRONTEND_BASE_URL}/therapists/{profile.slug}"
    )

    send_email(
        db,
        to_email=therapist.email,
        subject="Your therapist profile is now published",
        body=(
            "Your therapist profile has been published and is "
            f"now visible on the website.\n\n{public_url}"
        ),
    )


def _slugify_therapist_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(
        r"[^a-z0-9]+",
        "-",
        ascii_value.lower(),
    ).strip("-")

    return slug[:160] or "therapist"


def _allocate_therapist_slug(
    db: Session,
    *,
    full_name: str,
) -> str:
    base = _slugify_therapist_name(full_name)
    candidate = base
    suffix = 2

    while (
        db.scalar(select(TherapistProfile.id).where(TherapistProfile.slug == candidate)) is not None
    ):
        candidate = f"{base}-{suffix}"
        suffix += 1

    return candidate


def _get_current_user_profile(
    db: Session,
    current_user: User,
) -> TherapistProfile:
    profile = db.scalar(select(TherapistProfile).where(TherapistProfile.user_id == current_user.id))

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=("No therapist profile is linked to this account."),
        )

    return profile


def _latest_profile_revision(
    db: Session,
    *,
    profile_id: str,
) -> TherapistProfileRevision | None:
    return db.scalar(
        select(TherapistProfileRevision)
        .where(TherapistProfileRevision.therapist_profile_id == profile_id)
        .order_by(TherapistProfileRevision.version_number.desc())
        .limit(1)
    )


def _current_profile_publications(
    db: Session,
    *,
    profile_id: str,
) -> list[TherapistProfileRevision]:
    return list(
        db.scalars(
            select(TherapistProfileRevision).where(
                TherapistProfileRevision.therapist_profile_id == profile_id,
                TherapistProfileRevision.is_current_publication.is_(True),
            )
        ).all()
    )


def _self_profile_response(
    db: Session,
    profile: TherapistProfile,
) -> TherapistProfileSelfRead:
    latest = _latest_profile_revision(
        db,
        profile_id=profile.id,
    )

    published_profile = (
        TherapistProfilePublicRead.model_validate(profile) if profile.is_published else None
    )

    working_revision = (
        TherapistProfileRevisionRead.model_validate(latest)
        if latest is not None and not latest.is_current_publication
        else None
    )

    return TherapistProfileSelfRead(
        id=profile.id,
        slug=profile.slug,
        is_published=profile.is_published,
        published_profile=published_profile,
        working_revision=working_revision,
    )


def _editable_working_revision(
    db: Session,
    *,
    profile: TherapistProfile,
    current_user: User,
) -> TherapistProfileRevision:
    latest = _latest_profile_revision(
        db,
        profile_id=profile.id,
    )

    if latest is None:
        revision = build_revision_from_profile(
            profile,
            version_number=1,
            created_by_user_id=current_user.id,
        )
        db.add(revision)
        return revision

    if latest.is_current_publication:
        revision = build_revision_from_profile(
            profile,
            version_number=latest.version_number + 1,
            created_by_user_id=current_user.id,
        )
        db.add(revision)
        return revision

    if latest.review_status in {
        REVIEW_DRAFT,
        REVIEW_CHANGES_REQUESTED,
    }:
        return latest

    if latest.review_status == REVIEW_PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=("This profile revision is pending review " "and cannot be edited."),
        )

    if latest.review_status == REVIEW_APPROVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=("This profile revision is approved and " "awaiting publication."),
        )

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="This profile revision cannot currently be edited.",
    )


ADMIN_REVIEW_STATUSES = {
    REVIEW_PENDING,
    REVIEW_CHANGES_REQUESTED,
    REVIEW_APPROVED,
}


def _get_admin_review_revision(
    db: Session,
    *,
    revision_id: str,
    require_pending: bool = False,
) -> TherapistProfileRevision:
    revision = db.scalar(
        select(TherapistProfileRevision).where(
            TherapistProfileRevision.id == revision_id
        )
    )

    if revision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Therapist profile revision not found.",
        )

    if revision.is_current_publication:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The current published revision is not part of the review workflow.",
        )

    if require_pending:
        if revision.review_status != REVIEW_PENDING:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only pending-review revisions can be changed or reviewed by the Practice Admin.",
            )
    elif revision.review_status not in ADMIN_REVIEW_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This revision has not been submitted to the Practice Admin review workflow.",
        )

    return revision


def _admin_review_response(
    db: Session,
    revision: TherapistProfileRevision,
) -> TherapistProfileAdminReviewRead:
    profile = db.scalar(
        select(TherapistProfile).where(
            TherapistProfile.id == revision.therapist_profile_id
        )
    )

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Therapist profile not found.",
        )

    published_profile = (
        TherapistProfilePublicRead.model_validate(profile)
        if profile.is_published
        else None
    )

    return TherapistProfileAdminReviewRead(
        profile_id=profile.id,
        slug=profile.slug,
        is_published=profile.is_published,
        published_profile=published_profile,
        revision=TherapistProfileRevisionRead.model_validate(revision),
    )


def _public_profile_response(
    db: Session,
    profile: TherapistProfile,
) -> TherapistProfilePublicRead:
    response = (
        TherapistProfilePublicRead
        .model_validate(profile)
    )

    return response.model_copy(
        update={
            "bookable_service_ids": (
                public_therapist_bookable_service_ids(
                    db,
                    therapist_profile_id=(
                        profile.id
                    ),
                )
            )
        }
    )


@router.get(
    "/public",
    response_model=list[
        TherapistProfilePublicRead
    ],
)
def list_public_therapist_profiles(
    db: Session = Depends(get_db),
):
    profiles = db.scalars(
        select(TherapistProfile)
        .where(
            TherapistProfile.is_published.is_(True),
            select(
                TherapistProfileRevision.id
            )
            .where(
                TherapistProfileRevision
                .therapist_profile_id
                == TherapistProfile.id,
                TherapistProfileRevision
                .is_current_publication
                .is_(True),
            )
            .exists(),
        )
        .order_by(
            TherapistProfile.sort_order,
            TherapistProfile
            .created_at.desc(),
        )
    ).all()

    return [
        _public_profile_response(
            db,
            profile,
        )
        for profile in profiles
    ]


@router.get("/public/{slug}", response_model=TherapistProfilePublicRead)
def get_public_therapist_profile(slug: str, db: Session = Depends(get_db)):
    profile = db.scalar(
        select(TherapistProfile).where(
            TherapistProfile.slug == slug,
            TherapistProfile.is_published.is_(True),
            select(TherapistProfileRevision.id)
            .where(
                TherapistProfileRevision.therapist_profile_id == TherapistProfile.id,
                TherapistProfileRevision.is_current_publication.is_(True),
            )
            .exists(),
        )
    )

    if profile is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=(
                "Therapist profile not found."
            ),
        )

    return _public_profile_response(
        db,
        profile,
    )


@router.get("", response_model=list[TherapistProfileRead])
def list_therapist_profiles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("therapist_profiles.read")),
):
    return db.scalars(
        select(TherapistProfile).order_by(TherapistProfile.sort_order, TherapistProfile.created_at.desc())
    ).all()


@router.post("", response_model=TherapistProfileRead)
def create_therapist_profile(
    payload: TherapistProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("therapist_profiles.create")),
):
    profile = TherapistProfile(
        **payload.model_dump(),
        is_published=False,
        review_status=REVIEW_DRAFT,
    )
    db.add(profile)
    db.flush()

    revision = build_revision_from_profile(
        profile,
        version_number=1,
        created_by_user_id=current_user.id,
    )
    submit_profile_for_review(revision)
    db.add(revision)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The therapist profile could not be created.",
        ) from exc

    db.refresh(profile)
    return profile


@router.get(
    "/me",
    response_model=TherapistProfileSelfRead,
)
def get_my_therapist_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("therapist_profiles.own.read")),
):
    profile = _get_current_user_profile(
        db,
        current_user,
    )
    return _self_profile_response(db, profile)


@router.post(
    "/me",
    response_model=TherapistProfileSelfRead,
    status_code=status.HTTP_201_CREATED,
)
def create_my_therapist_profile(
    payload: TherapistProfileSelfCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("therapist_profiles.own.create")),
):
    existing = db.scalar(
        select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
    )

    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=("This account already has a therapist profile."),
        )

    content = payload.model_dump()

    profile = TherapistProfile(
        user_id=current_user.id,
        slug=_allocate_therapist_slug(
            db,
            full_name=payload.full_name,
        ),
        sort_order=0,
        review_status=REVIEW_DRAFT,
        is_published=False,
        **content,
    )

    db.add(profile)

    try:
        db.flush()

        revision = build_revision_from_profile(
            profile,
            version_number=1,
            created_by_user_id=current_user.id,
        )
        db.add(revision)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "The therapist profile could not be created "
                "because its account or public slug conflicts "
                "with an existing profile."
            ),
        ) from exc

    db.refresh(profile)
    return _self_profile_response(db, profile)


@router.patch(
    "/me",
    response_model=TherapistProfileSelfRead,
)
def update_my_therapist_profile(
    payload: TherapistProfileSelfUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("therapist_profiles.own.update")),
):
    profile = _get_current_user_profile(
        db,
        current_user,
    )

    revision = _editable_working_revision(
        db,
        profile=profile,
        current_user=current_user,
    )

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(revision, key, value)

    revision.updated_by_user_id = current_user.id
    db.add(revision)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=("The profile changed concurrently. " "Reload it and try again."),
        ) from exc

    return _self_profile_response(db, profile)


@router.post(
    "/me/submit",
    response_model=TherapistProfileSelfRead,
)
def submit_my_therapist_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("therapist_profiles.own.submit")),
):
    profile = _get_current_user_profile(
        db,
        current_user,
    )

    revision = _latest_profile_revision(
        db,
        profile_id=profile.id,
    )

    if revision is None or revision.is_current_publication:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="There is no working draft to submit.",
        )

    try:
        submit_profile_for_review(revision)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    revision.updated_by_user_id = current_user.id
    db.add(revision)
    db.commit()

    _notify_practice_admins_profile_submitted(
        db,
        profile=profile,
        revision_id=revision.id,
    )

    return _self_profile_response(db, profile)


@router.get(
    "/review-queue",
    response_model=list[TherapistProfileAdminReviewRead],
)
def list_therapist_profile_review_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("therapist_profiles.review")),
):
    revisions = db.scalars(
        select(TherapistProfileRevision)
        .where(
            TherapistProfileRevision.review_status == REVIEW_PENDING,
            TherapistProfileRevision.is_current_publication.is_(False),
        )
        .order_by(
            TherapistProfileRevision.submitted_at.asc(),
            TherapistProfileRevision.created_at.asc(),
        )
    ).all()

    return [
        _admin_review_response(db, revision)
        for revision in revisions
    ]


@router.get(
    "/revisions/{revision_id}",
    response_model=TherapistProfileAdminReviewRead,
)
def get_therapist_profile_revision_for_review(
    revision_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("therapist_profiles.review")),
):
    revision = _get_admin_review_revision(
        db,
        revision_id=revision_id,
    )
    return _admin_review_response(db, revision)


@router.patch(
    "/revisions/{revision_id}",
    response_model=TherapistProfileAdminReviewRead,
)
def update_therapist_profile_revision_for_review(
    revision_id: str,
    payload: TherapistProfileRevisionAdminUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("therapist_profiles.review")),
):
    revision = _get_admin_review_revision(
        db,
        revision_id=revision_id,
        require_pending=True,
    )

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(revision, key, value)

    revision.updated_by_user_id = current_user.id
    db.add(revision)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The submitted profile revision could not be updated.",
        ) from exc

    db.refresh(revision)
    return _admin_review_response(db, revision)


@router.post(
    "/revisions/{revision_id}/review",
    response_model=TherapistProfileAdminReviewRead,
)
def review_therapist_profile_revision(
    revision_id: str,
    payload: TherapistProfileReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("therapist_profiles.review")),
):
    revision = _get_admin_review_revision(
        db,
        revision_id=revision_id,
        require_pending=True,
    )

    try:
        review_profile(
            revision,
            decision=payload.decision,
            reviewer_user_id=current_user.id,
            notes=payload.notes,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    db.add(revision)
    db.commit()
    db.refresh(revision)

    profile = db.scalar(
        select(TherapistProfile).where(
            TherapistProfile.id
            == revision.therapist_profile_id
        )
    )

    if profile is not None:
        _notify_therapist_review_result(
            db,
            profile=profile,
            decision=payload.decision,
        )

    return _admin_review_response(db, revision)


@router.post(
    "/{profile_id}/revisions",
    response_model=TherapistProfileAdminReviewRead,
)
def start_therapist_profile_revision_for_review(
    profile_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("therapist_profiles.review")),
):
    profile = db.scalar(
        select(TherapistProfile).where(TherapistProfile.id == profile_id)
    )
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Therapist profile not found.",
        )

    latest = _latest_profile_revision(db, profile_id=profile.id)
    if latest is not None and not latest.is_current_publication:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This therapist profile already has an unpublished working revision.",
        )

    version_number = latest.version_number + 1 if latest is not None else 1
    revision = build_revision_from_profile(
        profile,
        version_number=version_number,
        created_by_user_id=current_user.id,
    )
    submit_profile_for_review(revision)
    db.add(revision)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A new therapist profile revision could not be started.",
        ) from exc

    db.refresh(revision)
    return _admin_review_response(db, revision)


@router.get(
    "/publication-queue",
    response_model=list[TherapistProfileAdminReviewRead],
)
def list_therapist_profile_publication_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("therapist_profiles.publish")),
):
    revisions = db.scalars(
        select(TherapistProfileRevision)
        .join(
            TherapistProfile,
            TherapistProfile.id
            == TherapistProfileRevision.therapist_profile_id,
        )
        .where(
            or_(
                and_(
                    TherapistProfileRevision.review_status == REVIEW_APPROVED,
                    TherapistProfileRevision.is_current_publication.is_(False),
                ),
                and_(
                    TherapistProfileRevision.is_current_publication.is_(True),
                    TherapistProfile.is_published.is_(False),
                ),
            )
        )
        .order_by(
            TherapistProfileRevision.reviewed_at,
            TherapistProfileRevision.created_at,
        )
    ).all()

    return [_admin_review_response(db, revision) for revision in revisions]


@router.post(
    "/revisions/{revision_id}/publish",
    response_model=TherapistProfileAdminReviewRead,
)
def publish_therapist_profile_revision(
    revision_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("therapist_profiles.publish")),
):
    revision = db.scalar(
        select(TherapistProfileRevision).where(
            TherapistProfileRevision.id == revision_id
        )
    )
    if revision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Therapist profile revision not found.",
        )

    profile = db.scalar(
        select(TherapistProfile).where(
            TherapistProfile.id == revision.therapist_profile_id
        )
    )
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Therapist profile not found.",
        )

    previous_publications = _current_profile_publications(
        db,
        profile_id=profile.id,
    )

    try:
        publish_profile_revision(
            profile,
            revision,
            publisher_user_id=current_user.id,
            previous_publications=previous_publications,
        )
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The therapist profile revision could not be published.",
        ) from exc

    db.refresh(profile)
    db.refresh(revision)

    _notify_therapist_profile_published(
        db,
        profile=profile,
    )

    return _admin_review_response(db, revision)


@router.post(
    "/{profile_id}/unpublish",
    response_model=TherapistProfileRead,
)
def unpublish_therapist_profile(
    profile_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("therapist_profiles.publish")),
):
    profile = db.scalar(
        select(TherapistProfile).where(TherapistProfile.id == profile_id)
    )
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Therapist profile not found.",
        )

    profile.is_published = False
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get(
    "/account-options",
    response_model=list[TherapistProfileAccountOptionRead],
)
def list_therapist_profile_account_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("therapist_profiles.update")
    ),
):
    users = (
        db.scalars(
            select(User)
            .join(User.roles)
            .where(
                Role.name == "Therapist",
                User.is_active.is_(True),
            )
            .order_by(
                User.full_name,
                User.email,
            )
        )
        .unique()
        .all()
    )

    user_ids = [user.id for user in users]

    linked_profiles = (
        db.scalars(
            select(TherapistProfile).where(
                TherapistProfile.user_id.in_(user_ids)
            )
        ).all()
        if user_ids
        else []
    )

    linked_profile_ids = {
        profile.user_id: profile.id
        for profile in linked_profiles
        if profile.user_id is not None
    }

    return [
        TherapistProfileAccountOptionRead(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            linked_profile_id=linked_profile_ids.get(
                user.id
            ),
        )
        for user in users
    ]


@router.patch("/{profile_id}/account", response_model=TherapistProfileRead)
def link_therapist_profile_account(
    profile_id: str,
    payload: TherapistProfileAccountLink,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("therapist_profiles.update")),
):
    profile = db.scalar(
        select(TherapistProfile).where(
            TherapistProfile.id == profile_id
        )
    )
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Therapist profile not found.",
        )

    if payload.user_id is None:
        profile.user_id = None
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile

    user = db.scalar(
        select(User)
        .options(selectinload(User.roles))
        .where(User.id == payload.user_id)
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An inactive account cannot be linked to a therapist profile.",
        )

    role_names = {role.name for role in user.roles}
    if "Therapist" not in role_names:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only an account with the Therapist role can be linked.",
        )

    existing_profile = db.scalar(
        select(TherapistProfile).where(
            TherapistProfile.user_id == user.id,
            TherapistProfile.id != profile.id,
        )
    )
    if existing_profile is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This account is already linked to another therapist profile.",
        )

    profile.user_id = user.id
    db.add(profile)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This account is already linked to another therapist profile.",
        ) from exc

    db.refresh(profile)
    return profile


@router.patch("/{profile_id}", response_model=TherapistProfileRead)
def update_therapist_profile(
    profile_id: str,
    payload: TherapistProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("therapist_profiles.update")),
):
    profile = db.scalar(select(TherapistProfile).where(TherapistProfile.id == profile_id))
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Therapist profile not found.")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, key, value)

    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_therapist_profile(
    profile_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("therapist_profiles.delete")),
):
    profile = db.scalar(select(TherapistProfile).where(TherapistProfile.id == profile_id))
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Therapist profile not found.")

    db.delete(profile)
    db.commit()
    return None
