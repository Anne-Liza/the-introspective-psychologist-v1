from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.modules.auth.dependencies import (
    require_permission,
)
from app.modules.blog import routes
from app.modules.blog.schemas import (
    BlogDraftCreate,
)


class ScalarResults:
    def __init__(self, records):
        self.records = records

    def all(self):
        return self.records


def make_user(
    *permission_codes: str,
    user_id: str = "therapist-user-1",
):
    return SimpleNamespace(
        id=user_id,
        roles=[
            SimpleNamespace(
                permissions=[
                    SimpleNamespace(code=code)
                    for code in permission_codes
                ]
            )
        ],
    )


@pytest.mark.parametrize(
    "permission",
    [
        "blog.own.read",
        "blog.own.create",
        "blog.own.update",
        "blog.own.submit",
    ],
)
def test_therapist_own_blog_permissions_are_allowed(
    permission,
):
    therapist = make_user(
        "blog.own.read",
        "blog.own.create",
        "blog.own.update",
        "blog.own.submit",
    )

    dependency = require_permission(
        permission
    )

    assert dependency(therapist) is therapist


@pytest.mark.parametrize(
    "permission",
    [
        "blog.read",
        "blog.review",
        "blog.publish",
    ],
)
def test_therapist_cannot_use_admin_blog_permissions(
    permission,
):
    therapist = make_user(
        "blog.own.read",
        "blog.own.create",
        "blog.own.update",
        "blog.own.submit",
    )

    dependency = require_permission(
        permission
    )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        dependency(therapist)

    assert (
        exc_info.value.status_code
        == 403
    )


def test_my_articles_query_is_scoped_to_current_user(
    monkeypatch,
):
    captured = []

    class DB:
        def scalars(
            self,
            statement,
        ):
            captured.append(statement)

            return ScalarResults(
                [
                    SimpleNamespace(
                        id="post-own"
                    )
                ]
            )

    monkeypatch.setattr(
        routes,
        "_workflow_post_response",
        lambda db, post: post.id,
    )

    therapist = make_user(
        "blog.own.read",
        user_id="therapist-user-123",
    )

    result = routes.list_my_blog_posts(
        db=DB(),
        current_user=therapist,
    )

    assert result == [
        "post-own"
    ]
    assert len(captured) == 1

    compiled = str(
        captured[0].compile(
            compile_kwargs={
                "literal_binds": True,
            }
        )
    )

    assert "owner_user_id" in compiled
    assert (
        "therapist-user-123"
        in compiled
    )


def test_owned_article_lookup_hides_other_owners():
    captured = []

    class DB:
        def scalar(
            self,
            statement,
        ):
            captured.append(statement)
            return None

    therapist = make_user(
        "blog.own.read",
        user_id="therapist-user-123",
    )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes._owned_blog_post(
            DB(),
            post_id="some-post",
            current_user=therapist,
        )

    assert (
        exc_info.value.status_code
        == 404
    )
    assert (
        exc_info.value.detail
        == "Article not found."
    )

    compiled = str(
        captured[0].compile(
            compile_kwargs={
                "literal_binds": True,
            }
        )
    )

    assert "owner_user_id" in compiled
    assert (
        "therapist-user-123"
        in compiled
    )


def test_therapist_article_creation_derives_identity(
    monkeypatch,
):
    added = []

    class DB:
        def add(
            self,
            record,
        ):
            added.append(record)

        def flush(self):
            return None

        def commit(self):
            return None

        def rollback(self):
            return None

        def refresh(
            self,
            record,
        ):
            return None

    profile = SimpleNamespace(
        id="profile-1",
        full_name="Amani Wekesa",
    )

    monkeypatch.setattr(
        routes,
        "_current_therapist_profile",
        lambda db, current_user: profile,
    )

    monkeypatch.setattr(
        routes,
        "_allocate_blog_slug",
        lambda db, title: "safe-title",
    )

    revision = SimpleNamespace(
        id="revision-1",
    )

    monkeypatch.setattr(
        routes,
        "build_revision_from_post",
        lambda post,
        version_number,
        created_by_user_id: revision,
    )

    monkeypatch.setattr(
        routes,
        "record_blog_event",
        lambda **kwargs: SimpleNamespace(
            action="created"
        ),
    )

    monkeypatch.setattr(
        routes,
        "_workflow_post_response",
        lambda db, post: post,
    )

    therapist = make_user(
        "blog.own.create",
        user_id="therapist-user-1",
    )

    payload = BlogDraftCreate(
        title="Safe title",
        body_markdown="Article body",
        author_name="Fake byline",
        is_featured=True,
    )

    post = routes.create_my_blog_post(
        payload=payload,
        db=DB(),
        current_user=therapist,
    )

    assert (
        post.owner_user_id
        == "therapist-user-1"
    )
    assert (
        post.therapist_profile_id
        == "profile-1"
    )

    # Browser-supplied identity cannot
    # replace the therapist profile identity.
    assert (
        post.author_name
        == "Amani Wekesa"
    )

    # Featuring remains an editorial
    # decision for the practice.
    assert post.is_featured is False

    # Provider creation always begins
    # as an unpublished draft.
    assert post.status == "draft"
    assert post.published_at is None


def test_therapist_payload_cannot_set_publication_status():
    with pytest.raises(
        ValidationError
    ):
        BlogDraftCreate.model_validate(
            {
                "title": "Attempted bypass",
                "body_markdown": (
                    "This should remain "
                    "a draft."
                ),
                "status": "published",
            }
        )
