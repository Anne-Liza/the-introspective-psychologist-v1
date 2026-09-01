from datetime import datetime

import pytest

from app.modules.blog.models import BlogPost, BlogPostRevision
from app.modules.blog.service import (
    REVIEW_APPROVED,
    REVIEW_CHANGES_REQUESTED,
    REVIEW_DRAFT,
    REVIEW_PENDING,
    REVIEW_REJECTED,
    build_revision_from_post,
    publish_blog_revision,
    record_blog_event,
    review_blog_revision,
    submit_blog_revision,
)


def make_post(**overrides):
    values = {
        "id": "post-1",
        "slug": "example-article",
        "title": "Example article",
        "excerpt": "Example excerpt",
        "body_markdown": "Original body",
        "category": "Wellbeing",
        "tags": ["therapy"],
        "author_name": "Amani Wekesa",
        "content_type": "article",
        "featured_media_type": "none",
        "is_featured": False,
        "status": "draft",
    }
    values.update(overrides)
    return BlogPost(**values)


def make_revision(**overrides):
    values = {
        "id": "revision-1",
        "blog_post_id": "post-1",
        "version_number": 1,
        "title": "Example article",
        "excerpt": "Example excerpt",
        "body_markdown": "Updated body",
        "category": "Wellbeing",
        "tags": ["therapy"],
        "author_name": "Amani Wekesa",
        "content_type": "article",
        "featured_media_type": "none",
        "is_featured": False,
        "review_status": REVIEW_DRAFT,
        "is_current_publication": False,
    }
    values.update(overrides)
    return BlogPostRevision(**values)


def test_build_revision_from_post_creates_editable_draft():
    post = make_post(
        status="published",
        body_markdown="Live body",
    )

    revision = build_revision_from_post(
        post,
        version_number=2,
        created_by_user_id="user-1",
    )

    assert revision.blog_post_id == post.id
    assert revision.version_number == 2
    assert revision.body_markdown == "Live body"
    assert revision.review_status == REVIEW_DRAFT
    assert revision.is_current_publication is False
    assert revision.created_by_user_id == "user-1"
    assert revision.updated_by_user_id == "user-1"


def test_submit_draft_moves_revision_to_pending_review():
    revision = make_revision()

    submit_blog_revision(revision)

    assert revision.review_status == REVIEW_PENDING
    assert revision.submitted_at is not None


def test_changes_requested_revision_can_be_resubmitted():
    revision = make_revision(
        review_status=REVIEW_CHANGES_REQUESTED,
        review_notes="Please clarify the closing section.",
    )

    submit_blog_revision(revision)

    assert revision.review_status == REVIEW_PENDING
    assert revision.submitted_at is not None
    assert revision.review_notes == (
        "Please clarify the closing section."
    )


@pytest.mark.parametrize(
    "review_status",
    [
        REVIEW_PENDING,
        REVIEW_APPROVED,
        REVIEW_REJECTED,
    ],
)
def test_non_editable_review_states_cannot_be_submitted(
    review_status,
):
    revision = make_revision(
        review_status=review_status,
    )

    with pytest.raises(ValueError):
        submit_blog_revision(revision)


def test_current_publication_cannot_be_submitted():
    revision = make_revision(
        is_current_publication=True,
    )

    with pytest.raises(ValueError):
        submit_blog_revision(revision)


def test_admin_can_approve_pending_revision():
    revision = make_revision(
        review_status=REVIEW_PENDING,
    )

    review_blog_revision(
        revision,
        decision=REVIEW_APPROVED,
        reviewer_user_id="admin-1",
    )

    assert revision.review_status == REVIEW_APPROVED
    assert revision.reviewed_by_user_id == "admin-1"
    assert revision.reviewed_at is not None


def test_requesting_changes_requires_notes():
    revision = make_revision(
        review_status=REVIEW_PENDING,
    )

    with pytest.raises(
        ValueError,
        match="Review notes are required",
    ):
        review_blog_revision(
            revision,
            decision=REVIEW_CHANGES_REQUESTED,
            reviewer_user_id="admin-1",
        )


def test_rejecting_article_requires_notes():
    revision = make_revision(
        review_status=REVIEW_PENDING,
    )

    with pytest.raises(
        ValueError,
        match="Review notes are required",
    ):
        review_blog_revision(
            revision,
            decision=REVIEW_REJECTED,
            reviewer_user_id="admin-1",
        )


def test_changes_requested_stores_feedback():
    revision = make_revision(
        review_status=REVIEW_PENDING,
    )

    review_blog_revision(
        revision,
        decision=REVIEW_CHANGES_REQUESTED,
        reviewer_user_id="admin-1",
        notes="  Add a clearer conclusion.  ",
    )

    assert (
        revision.review_status
        == REVIEW_CHANGES_REQUESTED
    )
    assert revision.review_notes == (
        "Add a clearer conclusion."
    )


def test_rejected_revision_records_reviewer_and_reason():
    revision = make_revision(
        review_status=REVIEW_PENDING,
    )

    review_blog_revision(
        revision,
        decision=REVIEW_REJECTED,
        reviewer_user_id="admin-1",
        notes="This topic is outside the publication scope.",
    )

    assert revision.review_status == REVIEW_REJECTED
    assert revision.reviewed_by_user_id == "admin-1"
    assert revision.reviewed_at is not None


def test_only_approved_revision_can_be_published():
    post = make_post()
    revision = make_revision(
        review_status=REVIEW_PENDING,
    )

    with pytest.raises(
        ValueError,
        match="Only approved",
    ):
        publish_blog_revision(
            post,
            revision,
            publisher_user_id="admin-1",
            previous_publications=[],
        )


def test_publish_copies_revision_to_live_post():
    post = make_post()

    revision = make_revision(
        review_status=REVIEW_APPROVED,
        title="Understanding burnout",
        body_markdown="Published body",
        category="Workplace wellbeing",
        tags=["burnout", "work"],
        is_featured=True,
    )

    publish_blog_revision(
        post,
        revision,
        publisher_user_id="admin-1",
        previous_publications=[],
    )

    assert post.title == "Understanding burnout"
    assert post.body_markdown == "Published body"
    assert post.category == "Workplace wellbeing"
    assert post.tags == ["burnout", "work"]
    assert post.is_featured is True

    assert post.status == "published"
    assert post.published_at is not None
    assert post.published_by_user_id == "admin-1"

    assert revision.is_current_publication is True
    assert revision.published_at is not None
    assert revision.published_by_user_id == "admin-1"


def test_publish_replaces_previous_current_publication():
    post = make_post(
        status="published",
    )

    previous = make_revision(
        id="revision-old",
        review_status=REVIEW_APPROVED,
        is_current_publication=True,
    )

    next_revision = make_revision(
        id="revision-new",
        version_number=2,
        review_status=REVIEW_APPROVED,
    )

    publish_blog_revision(
        post,
        next_revision,
        publisher_user_id="admin-1",
        previous_publications=[previous],
    )

    assert previous.is_current_publication is False
    assert next_revision.is_current_publication is True


def test_republishing_current_revision_restores_visibility():
    original_published_at = datetime(
        2026,
        8,
        20,
        10,
        30,
    )

    post = make_post(
        status="draft",
        published_at=original_published_at,
    )

    revision = make_revision(
        review_status=REVIEW_APPROVED,
        is_current_publication=True,
        published_at=original_published_at,
        published_by_user_id="admin-1",
    )

    publish_blog_revision(
        post,
        revision,
        publisher_user_id="admin-2",
        previous_publications=[revision],
    )

    assert post.status == "published"
    assert (
        revision.published_at
        == original_published_at
    )
    assert revision.published_by_user_id == "admin-1"


def test_review_event_trims_note_and_preserves_action():
    post = make_post()
    revision = make_revision()

    event = record_blog_event(
        post=post,
        revision=revision,
        actor_user_id="admin-1",
        action="changes_requested",
        note="  Add two references.  ",
    )

    assert event.blog_post_id == post.id
    assert event.revision_id == revision.id
    assert event.actor_user_id == "admin-1"
    assert event.action == "changes_requested"
    assert event.note == "Add two references."
