from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.modules.files.models import (
    FILE_PURPOSE_GENERAL,
    FILE_PURPOSE_THERAPIST_PROFILE_IMAGE,
    FILE_VISIBILITY_INTERNAL,
    FILE_VISIBILITY_PRIVATE,
)
from app.modules.therapist_profiles import routes


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
    purpose=(
        FILE_PURPOSE_THERAPIST_PROFILE_IMAGE
    ),
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


def test_owner_can_select_internal_profile_image():
    asset = make_asset()

    result = (
        routes._validated_profile_image_asset(
            FakeDB(asset),
            asset_id=asset.id,
            owner_user_id="user-1",
        )
    )

    assert result is asset


def test_other_user_cannot_select_owned_profile_image():
    asset = make_asset(
        owner_user_id="user-1"
    )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes._validated_profile_image_asset(
            FakeDB(asset),
            asset_id=asset.id,
            owner_user_id="user-2",
        )

    assert (
        exc_info.value.status_code
        == 404
    )


def test_profile_image_rejects_wrong_purpose():
    asset = make_asset(
        purpose=FILE_PURPOSE_GENERAL,
    )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes._validated_profile_image_asset(
            FakeDB(asset),
            asset_id=asset.id,
            owner_user_id="user-1",
        )

    assert (
        exc_info.value.status_code
        == 400
    )


def test_profile_image_requires_image_content():
    asset = make_asset(
        content_type="application/pdf",
    )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes._validated_profile_image_asset(
            FakeDB(asset),
            asset_id=asset.id,
            owner_user_id="user-1",
        )

    assert (
        exc_info.value.status_code
        == 400
    )


def test_private_asset_cannot_be_profile_image():
    asset = make_asset(
        visibility=FILE_VISIBILITY_PRIVATE,
    )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes._validated_profile_image_asset(
            FakeDB(asset),
            asset_id=asset.id,
            owner_user_id="user-1",
        )

    assert (
        exc_info.value.status_code
        == 400
    )


def test_revision_usage_moves_when_image_changes(
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
        profile_image_asset_id="new-asset",
    )

    routes._sync_profile_revision_asset_usage(
        SimpleNamespace(),
        revision=revision,
        previous_asset_id="old-asset",
    )

    assert calls == [
        ("remove", "old-asset"),
        ("add", "new-asset"),
    ]


def test_public_profile_image_uses_managed_asset():
    asset = make_asset(
        visibility=routes.FILE_VISIBILITY_PUBLIC,
    )

    profile = SimpleNamespace(
        profile_image_asset_id=asset.id,
        profile_image_url="/legacy/image.png",
    )

    result = routes._profile_image_public_url(
        FakeDB(asset),
        profile=profile,
    )

    assert result == (
        f"/files/public/{asset.id}"
    )


def test_internal_managed_image_is_not_public():
    asset = make_asset(
        visibility=FILE_VISIBILITY_INTERNAL,
    )

    profile = SimpleNamespace(
        profile_image_asset_id=asset.id,
        profile_image_url="/legacy/image.png",
    )

    result = routes._profile_image_public_url(
        FakeDB(asset),
        profile=profile,
    )

    assert result is None


def test_legacy_profile_image_remains_supported():
    profile = SimpleNamespace(
        profile_image_asset_id=None,
        profile_image_url=(
            "/demo/therapists/amani.svg"
        ),
    )

    result = routes._profile_image_public_url(
        FakeDB(None),
        profile=profile,
    )

    assert result == (
        "/demo/therapists/amani.svg"
    )


def test_unused_public_profile_asset_is_demoted(
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

    routes._demote_profile_asset_if_no_live_usage(
        FakeDB(asset),
        asset_id=asset.id,
    )

    assert (
        asset.visibility
        == routes.FILE_VISIBILITY_INTERNAL
    )


def test_live_profile_usage_keeps_asset_public(
    monkeypatch,
):
    asset = make_asset(
        visibility=routes.FILE_VISIBILITY_PUBLIC,
    )

    monkeypatch.setattr(
        routes,
        "list_file_usage",
        lambda _db, **kwargs: [
            SimpleNamespace(
                entity_type=(
                    routes.PROFILE_USAGE_TYPE
                )
            )
        ],
    )

    routes._demote_profile_asset_if_no_live_usage(
        FakeDB(asset),
        asset_id=asset.id,
    )

    assert (
        asset.visibility
        == routes.FILE_VISIBILITY_PUBLIC
    )
