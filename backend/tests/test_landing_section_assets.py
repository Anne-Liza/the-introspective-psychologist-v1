from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.modules.files.models import (
    FILE_PURPOSE_GENERAL,
    FILE_PURPOSE_LANDING_SECTION_IMAGE,
    FILE_VISIBILITY_INTERNAL,
    FILE_VISIBILITY_PRIVATE,
    FILE_VISIBILITY_PUBLIC,
)
from app.modules.landing_sections import routes


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
    purpose=FILE_PURPOSE_LANDING_SECTION_IMAGE,
    content_type="image/png",
    visibility=FILE_VISIBILITY_INTERNAL,
):
    return SimpleNamespace(
        id="asset-1",
        purpose=purpose,
        content_type=content_type,
        visibility=visibility,
    )


def test_internal_landing_image_is_valid():
    asset = make_asset()

    result = (
        routes
        ._validated_landing_image_asset(
            FakeDB(asset),
            asset_id=asset.id,
        )
    )

    assert result is asset


def test_landing_image_rejects_wrong_purpose():
    asset = make_asset(
        purpose=FILE_PURPOSE_GENERAL,
    )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes._validated_landing_image_asset(
            FakeDB(asset),
            asset_id=asset.id,
        )

    assert exc_info.value.status_code == 400


def test_landing_image_requires_image_content():
    asset = make_asset(
        content_type="application/pdf",
    )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes._validated_landing_image_asset(
            FakeDB(asset),
            asset_id=asset.id,
        )

    assert exc_info.value.status_code == 400


def test_private_landing_image_is_rejected():
    asset = make_asset(
        visibility=FILE_VISIBILITY_PRIVATE,
    )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes._validated_landing_image_asset(
            FakeDB(asset),
            asset_id=asset.id,
        )

    assert exc_info.value.status_code == 400


def test_public_section_uses_managed_image_url():
    asset = make_asset(
        visibility=FILE_VISIBILITY_PUBLIC,
    )

    section = SimpleNamespace(
        image_asset_id=asset.id,
        image_url="/legacy/hero.jpg",
    )

    result = (
        routes._landing_image_public_url(
            FakeDB(asset),
            section=section,
        )
    )

    assert result == (
        f"/files/public/{asset.id}"
    )


def test_internal_managed_landing_image_not_public():
    asset = make_asset()

    section = SimpleNamespace(
        image_asset_id=asset.id,
        image_url="/legacy/hero.jpg",
    )

    result = (
        routes._landing_image_public_url(
            FakeDB(asset),
            section=section,
        )
    )

    assert result is None


def test_legacy_landing_image_still_supported():
    section = SimpleNamespace(
        image_asset_id=None,
        image_url="/demo/practice/room.svg",
    )

    result = (
        routes._landing_image_public_url(
            FakeDB(None),
            section=section,
        )
    )

    assert result == (
        "/demo/practice/room.svg"
    )


def test_landing_image_usage_moves_on_replace(
    monkeypatch,
):
    calls = []

    monkeypatch.setattr(
        routes,
        "unregister_file_usage",
        lambda _db, **kwargs:
            calls.append(
                (
                    "remove",
                    kwargs["file_id"],
                )
            ),
    )

    monkeypatch.setattr(
        routes,
        "register_file_usage",
        lambda _db, **kwargs:
            calls.append(
                (
                    "add",
                    kwargs["file_id"],
                )
            ),
    )

    monkeypatch.setattr(
        routes,
        "_sync_landing_image_visibility",
        lambda _db, **kwargs:
            calls.append(
                (
                    "visibility",
                    kwargs["asset_id"],
                )
            ),
    )

    db = SimpleNamespace(
        flush=lambda: None,
    )

    section = SimpleNamespace(
        id="section-1",
        image_asset_id="new-asset",
    )

    routes._sync_landing_image_usage(
        db,
        section=section,
        previous_asset_id="old-asset",
    )

    assert calls == [
        ("remove", "old-asset"),
        ("add", "new-asset"),
        ("visibility", "old-asset"),
        ("visibility", "new-asset"),
    ]
