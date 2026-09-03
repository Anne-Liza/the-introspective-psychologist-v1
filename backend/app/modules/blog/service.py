from app.core.time import utc_now
from app.modules.blog.models import (
    BlogPost,
    BlogPostRevision,
    BlogReviewEvent,
)


REVIEW_DRAFT = "draft"
REVIEW_PENDING = "pending_review"
REVIEW_CHANGES_REQUESTED = "changes_requested"
REVIEW_APPROVED = "approved"
REVIEW_REJECTED = "rejected"

REVIEW_STATUSES = {
    REVIEW_DRAFT,
    REVIEW_PENDING,
    REVIEW_CHANGES_REQUESTED,
    REVIEW_APPROVED,
    REVIEW_REJECTED,
}

SUBMITTABLE_REVIEW_STATUSES = {
    REVIEW_DRAFT,
    REVIEW_CHANGES_REQUESTED,
}

REVIEW_DECISIONS = {
    REVIEW_CHANGES_REQUESTED,
    REVIEW_APPROVED,
    REVIEW_REJECTED,
}


REVISION_CONTENT_FIELDS = (
    "title",
    "excerpt",
    "body_markdown",
    "category",
    "tags",
    "author_name",
    "content_type",
    "external_url",
    "source_name",
    "source_author",
    "source_published_at",
    "featured_media_type",
    "cover_image_url",
    "cover_image_asset_id",
    "cover_image_alt",
    "video_url",
    "media_caption",
    "media_credit",
    "is_featured",
    "seo_title",
    "seo_description",
)


def build_revision_from_post(
    post: BlogPost,
    *,
    version_number: int,
    created_by_user_id: str | None = None,
) -> BlogPostRevision:
    """
    Start a new unpublished working revision from the live article.

    Publishing the revision later copies these fields back to BlogPost.
    """

    values = {
        field: getattr(post, field)
        for field in REVISION_CONTENT_FIELDS
    }

    return BlogPostRevision(
        blog_post_id=post.id,
        version_number=version_number,
        review_status=REVIEW_DRAFT,
        created_by_user_id=created_by_user_id,
        updated_by_user_id=created_by_user_id,
        is_current_publication=False,
        **values,
    )


def submit_blog_revision(
    revision: BlogPostRevision,
) -> BlogPostRevision:
    if (
        revision.review_status
        not in SUBMITTABLE_REVIEW_STATUSES
    ):
        raise ValueError(
            "Only draft or changes-requested article revisions "
            "can be submitted for review."
        )

    if revision.is_current_publication:
        raise ValueError(
            "The currently published article cannot be "
            "submitted as a working revision."
        )

    revision.review_status = REVIEW_PENDING
    revision.submitted_at = utc_now()

    # Keep earlier review metadata when resubmitting after
    # changes were requested so the author can still see
    # the previous feedback.
    return revision


def review_blog_revision(
    revision: BlogPostRevision,
    *,
    decision: str,
    reviewer_user_id: str,
    notes: str | None = None,
) -> BlogPostRevision:
    if revision.review_status != REVIEW_PENDING:
        raise ValueError(
            "Only pending-review article revisions can be reviewed."
        )

    if decision not in REVIEW_DECISIONS:
        raise ValueError(
            "Review decision must be approved, rejected, "
            "or changes_requested."
        )

    clean_notes = notes.strip() if notes else None

    if (
        decision
        in {
            REVIEW_CHANGES_REQUESTED,
            REVIEW_REJECTED,
        }
        and not clean_notes
    ):
        raise ValueError(
            "Review notes are required when requesting "
            "changes or rejecting an article."
        )

    revision.review_status = decision
    revision.reviewed_by_user_id = reviewer_user_id
    revision.reviewed_at = utc_now()
    revision.review_notes = clean_notes
    revision.updated_by_user_id = reviewer_user_id

    return revision


def publish_blog_revision(
    post: BlogPost,
    revision: BlogPostRevision,
    *,
    publisher_user_id: str,
    previous_publications: list[
        BlogPostRevision
    ],
) -> BlogPostRevision:
    """
    Make an approved article revision the live public version.

    A newer draft/review revision can therefore exist without
    changing what visitors currently see.
    """

    if revision.blog_post_id != post.id:
        raise ValueError(
            "Article revision does not belong to this blog post."
        )

    if (
        not revision.is_current_publication
        and revision.review_status
        != REVIEW_APPROVED
    ):
        raise ValueError(
            "Only approved article revisions can be published."
        )

    for previous in previous_publications:
        if previous.blog_post_id != post.id:
            raise ValueError(
                "Current publication belongs to another blog post."
            )

        if previous.id != revision.id:
            previous.is_current_publication = False

    # Re-publishing an already-current version after an
    # unpublish should only restore visibility.
    if revision.is_current_publication:
        post.status = "published"
        return revision

    for field in REVISION_CONTENT_FIELDS:
        setattr(
            post,
            field,
            getattr(revision, field),
        )

    published_at = utc_now()

    post.status = "published"
    post.published_at = published_at
    post.published_by_user_id = (
        publisher_user_id
    )

    revision.is_current_publication = True
    revision.published_by_user_id = (
        publisher_user_id
    )
    revision.published_at = published_at

    return revision


def record_blog_event(
    *,
    post: BlogPost,
    action: str,
    actor_user_id: str | None,
    revision: BlogPostRevision | None = None,
    note: str | None = None,
) -> BlogReviewEvent:
    """
    Build an append-only editorial history event.
    """

    clean_note = (
        note.strip()
        if note and note.strip()
        else None
    )

    return BlogReviewEvent(
        blog_post_id=post.id,
        revision_id=(
            revision.id
            if revision is not None
            else None
        ),
        actor_user_id=actor_user_id,
        action=action,
        note=clean_note,
    )
