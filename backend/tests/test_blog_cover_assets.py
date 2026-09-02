from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.modules.blog import routes
from app.modules.files.models import (
    FILE_PURPOSE_BLOG_COVER_IMAGE,
    FILE_PURPOSE_GENERAL,
    FILE_VISIBILITY_INTERNAL,
    FILE_VISIBILITY_PRIVATE,
)


class FakeDB:
    def __init__(
        self,
        asset,
    ):
        self.asset = asset

    def scalar(
        self,
        _statement,
    ):
        return self.asset


def make_asset(
    *,
    owner_user_id="user-1",
    purpose=FILE_PURPOSE_BLOG_COVER_IMAGE,
    content_type="image/png",
    visibility=FILE_VISIBILITY_INTERNAL,
):
    return SimpleNamespace(
        id="asset-1",
        owner_user_id=owner_user_id,
        purpose=purpose,
        content_type=content_type,
        visibility=visibility,
    )


def test_owner_can_select_internal_blog_cover():
    asset = make_asset()

    result = routes._validated_blog_cover_asset(
        FakeDB(asset),
        asset_id=asset.id,
        owner_user_id="user-1",
    )

    assert result is asset


def test_other_user_cannot_select_blog_cover():
    asset = make_asset(
        owner_user_id="user-1"
    )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes._validated_blog_cover_asset(
            FakeDB(asset),
            asset_id=asset.id,
            owner_user_id="user-2",
        )

    assert exc_info.value.status_code == 404


def test_blog_cover_rejects_wrong_purpose():
    asset = make_asset(
        purpose=FILE_PURPOSE_GENERAL,
    )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes._validated_blog_cover_asset(
            FakeDB(asset),
            asset_id=asset.id,
        )

    assert exc_info.value.status_code == 400


def test_blog_cover_requires_image_content():
    asset = make_asset(
        content_type="application/pdf",
    )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes._validated_blog_cover_asset(
            FakeDB(asset),
            asset_id=asset.id,
        )

    assert exc_info.value.status_code == 400


def test_private_asset_cannot_be_blog_cover():
    asset = make_asset(
        visibility=FILE_VISIBILITY_PRIVATE,
    )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes._validated_blog_cover_asset(
            FakeDB(asset),
            asset_id=asset.id,
        )

    assert exc_info.value.status_code == 400


def test_blog_revision_usage_moves_when_cover_changes(
    monkeypatch,
):
    calls = []

    monkeypatch.setattr(
        routes,
        "unregister_file_usage",
        lambda _db, **kwargs: calls.append(
            (
                "remove",
                kwargs["file_id"],
            )
        ),
    )

    monkeypatch.setattr(
        routes,
        "register_file_usage",
        lambda _db, **kwargs: calls.append(
            (
                "add",
                kwargs["file_id"],
            )
        ),
    )

    revision = SimpleNamespace(
        id="revision-1",
        cover_image_asset_id="new-asset",
    )

    routes._sync_blog_revision_asset_usage(
        SimpleNamespace(),
        revision=revision,
        previous_asset_id="old-asset",
    )

    assert calls == [
        ("remove", "old-asset"),
        ("add", "new-asset"),
    ]


def test_public_blog_cover_uses_managed_asset():
    asset = make_asset(
        visibility=routes.FILE_VISIBILITY_PUBLIC,
    )

    post = SimpleNamespace(
        cover_image_asset_id=asset.id,
        cover_image_url="/legacy/blog.jpg",
    )

    result = routes._blog_cover_public_url(
        FakeDB(asset),
        post=post,
    )

    assert result == (
        f"/files/public/{asset.id}"
    )


def test_internal_managed_blog_cover_is_not_public():
    asset = make_asset()

    post = SimpleNamespace(
        cover_image_asset_id=asset.id,
        cover_image_url="/legacy/blog.jpg",
    )

    result = routes._blog_cover_public_url(
        FakeDB(asset),
        post=post,
    )

    assert result is None


def test_legacy_blog_cover_remains_supported():
    post = SimpleNamespace(
        cover_image_asset_id=None,
        cover_image_url="/demo/blog/cover.svg",
    )

    result = routes._blog_cover_public_url(
        FakeDB(None),
        post=post,
    )

    assert result == "/demo/blog/cover.svg"


def test_unused_public_blog_cover_is_demoted(
    monkeypatch,
):
    asset = make_asset(
        visibility=routes.FILE_VISIBILITY_PUBLIC,
    )

    monkeypatch.setattr(
        routes,
        "list_file_usage",
        lambda _db, **kwargs: [],
    )

    routes._demote_blog_cover_if_no_live_usage(
        FakeDB(asset),
        asset_id=asset.id,
    )

    assert (
        asset.visibility
        == routes.FILE_VISIBILITY_INTERNAL
    )
