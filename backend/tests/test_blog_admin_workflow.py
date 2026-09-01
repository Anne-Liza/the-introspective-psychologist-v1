from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.modules.blog import routes
from app.modules.blog.service import (
    REVIEW_APPROVED,
    REVIEW_DRAFT,
    REVIEW_PENDING,
)


def make_user():
    return SimpleNamespace(
        id="admin-1",
        full_name="Practice Admin",
    )


def make_post(
    *,
    therapist_profile_id=None,
):
    return SimpleNamespace(
        id="post-1",
        therapist_profile_id=(
            therapist_profile_id
        ),
    )


def test_admin_cannot_silently_edit_provider_article():
    class DB:
        def scalar(
            self,
            _statement,
        ):
            return make_post(
                therapist_profile_id="therapist-1",
            )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes._practice_authored_blog_post(
            DB(),
            post_id="post-1",
        )

    assert (
        exc_info.value.status_code
        == 409
    )
    assert (
        "Provider-authored articles"
        in exc_info.value.detail
    )


def test_admin_can_edit_existing_draft(
    monkeypatch,
):
    post = make_post()

    revision = SimpleNamespace(
        id="revision-1",
        version_number=1,
        review_status=REVIEW_DRAFT,
        is_current_publication=False,
    )

    monkeypatch.setattr(
        routes,
        "_latest_blog_revision",
        lambda db, post_id: revision,
    )

    result = (
        routes._editable_admin_blog_revision(
            SimpleNamespace(
                add=lambda value: None
            ),
            post=post,
            current_user=make_user(),
        )
    )

    assert result is revision


def test_admin_cannot_edit_pending_revision(
    monkeypatch,
):
    post = make_post()

    revision = SimpleNamespace(
        id="revision-1",
        version_number=1,
        review_status=REVIEW_PENDING,
        is_current_publication=False,
    )

    monkeypatch.setattr(
        routes,
        "_latest_blog_revision",
        lambda db, post_id: revision,
    )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes._editable_admin_blog_revision(
            SimpleNamespace(
                add=lambda value: None
            ),
            post=post,
            current_user=make_user(),
        )

    assert (
        exc_info.value.status_code
        == 409
    )


def test_published_article_edit_creates_next_revision(
    monkeypatch,
):
    post = make_post()

    published = SimpleNamespace(
        id="revision-1",
        version_number=3,
        review_status=REVIEW_APPROVED,
        is_current_publication=True,
    )

    created = SimpleNamespace(
        version_number=4,
        review_status=REVIEW_DRAFT,
        is_current_publication=False,
    )

    monkeypatch.setattr(
        routes,
        "_latest_blog_revision",
        lambda db, post_id: published,
    )

    monkeypatch.setattr(
        routes,
        "build_revision_from_post",
        lambda post,
        version_number,
        created_by_user_id: (
            created
            if version_number == 4
            else None
        ),
    )

    added = []

    result = (
        routes._editable_admin_blog_revision(
            SimpleNamespace(
                add=added.append
            ),
            post=post,
            current_user=make_user(),
        )
    )

    assert result is created
    assert added == [created]
    assert result.version_number == 4


@pytest.mark.parametrize(
    "operation",
    [
        lambda: routes.create_blog_post(
            None,
            None,
            make_user(),
        ),
        lambda: routes.update_blog_post(
            "post-1",
            None,
            None,
            make_user(),
        ),
        lambda: routes.delete_blog_post(
            "post-1",
            None,
            make_user(),
        ),
    ],
)
def test_legacy_blog_mutations_are_retired(
    operation,
):
    with pytest.raises(
        HTTPException
    ) as exc_info:
        operation()

    assert (
        exc_info.value.status_code
        == 410
    )

    assert (
        "editorial publishing workflow"
        in exc_info.value.detail
    )
