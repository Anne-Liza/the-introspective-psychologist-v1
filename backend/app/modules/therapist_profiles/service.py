from app.core.time import utc_now
from app.modules.therapist_profiles.models import (
    TherapistProfile,
    TherapistProfileRevision,
)

REVIEW_DRAFT = "draft"
REVIEW_PENDING = "pending_review"
REVIEW_CHANGES_REQUESTED = "changes_requested"
REVIEW_APPROVED = "approved"

REVIEW_STATUSES = {
    REVIEW_DRAFT,
    REVIEW_PENDING,
    REVIEW_CHANGES_REQUESTED,
    REVIEW_APPROVED,
}

SUBMITTABLE_REVIEW_STATUSES = {
    REVIEW_DRAFT,
    REVIEW_CHANGES_REQUESTED,
}

REVIEW_DECISIONS = {
    REVIEW_CHANGES_REQUESTED,
    REVIEW_APPROVED,
}

REVISION_CONTENT_FIELDS = (
    "full_name",
    "title",
    "short_bio",
    "bio",
    "specialties",
    "approaches",
    "languages",
    "location",
    "session_formats",
    "profile_image_url",
    "profile_image_asset_id",
)


def build_revision_from_profile(
    profile: TherapistProfile,
    *,
    version_number: int,
    created_by_user_id: str | None = None,
) -> TherapistProfileRevision:
    """Create an unpublished working revision from the current live profile."""

    values = {field: getattr(profile, field) for field in REVISION_CONTENT_FIELDS}

    return TherapistProfileRevision(
        therapist_profile_id=profile.id,
        version_number=version_number,
        review_status=REVIEW_DRAFT,
        created_by_user_id=created_by_user_id,
        updated_by_user_id=created_by_user_id,
        is_current_publication=False,
        **values,
    )


def submit_profile_for_review(
    revision: TherapistProfileRevision,
) -> TherapistProfileRevision:
    if revision.review_status not in SUBMITTABLE_REVIEW_STATUSES:
        raise ValueError(
            "Only draft or changes-requested revisions " "can be submitted for review."
        )

    revision.review_status = REVIEW_PENDING
    revision.submitted_at = utc_now()

    # Keep the latest review metadata when a changes-requested
    # revision is resubmitted so the feedback remains visible
    # during the next review cycle.
    return revision


def review_profile(
    revision: TherapistProfileRevision,
    *,
    decision: str,
    reviewer_user_id: str,
    notes: str | None = None,
) -> TherapistProfileRevision:
    if revision.review_status != REVIEW_PENDING:
        raise ValueError("Only pending-review revisions can be reviewed.")

    if decision not in REVIEW_DECISIONS:
        raise ValueError("Review decision must be approved or " "changes_requested.")

    clean_notes = notes.strip() if notes else None

    if decision == REVIEW_CHANGES_REQUESTED and not clean_notes:
        raise ValueError("Review notes are required when requesting changes.")

    revision.review_status = decision
    revision.reviewed_by_user_id = reviewer_user_id
    revision.reviewed_at = utc_now()
    revision.review_notes = clean_notes
    revision.updated_by_user_id = reviewer_user_id

    return revision


def publish_profile_revision(
    profile: TherapistProfile,
    revision: TherapistProfileRevision,
    *,
    publisher_user_id: str,
    previous_publications: list[TherapistProfileRevision],
) -> TherapistProfileRevision:
    """Make an approved revision the live professional profile."""

    if revision.therapist_profile_id != profile.id:
        raise ValueError("Profile revision does not belong to this therapist profile.")

    if not revision.is_current_publication and revision.review_status != REVIEW_APPROVED:
        raise ValueError("Only approved therapist profile revisions can be published.")

    for previous in previous_publications:
        if previous.therapist_profile_id != profile.id:
            raise ValueError("Current publication belongs to another therapist profile.")

        if previous.id != revision.id:
            previous.is_current_publication = False

    # Re-publishing an already-current revision after an unpublish only
    # restores visibility. Keep its original publication provenance.
    if revision.is_current_publication:
        profile.is_published = True
        return revision

    for field in REVISION_CONTENT_FIELDS:
        setattr(profile, field, getattr(revision, field))

    # These transitional fields now describe the currently live version.
    profile.review_status = revision.review_status
    profile.reviewed_by_user_id = revision.reviewed_by_user_id
    profile.reviewed_at = revision.reviewed_at
    profile.review_notes = revision.review_notes
    profile.is_published = True

    revision.is_current_publication = True
    revision.published_by_user_id = publisher_user_id
    revision.published_at = utc_now()

    return revision
