from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.modules.commerce_core import routes
from app.modules.files.models import (
    FILE_PURPOSE_GENERAL,
    FILE_PURPOSE_PRODUCT_IMAGE,
    FILE_VISIBILITY_INTERNAL,
    FILE_VISIBILITY_PRIVATE,
    FILE_VISIBILITY_PUBLIC,
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
    purpose=FILE_PURPOSE_PRODUCT_IMAGE,
    content_type="image/png",
    visibility=FILE_VISIBILITY_INTERNAL,
):
    return SimpleNamespace(
        id="asset-1",
        purpose=purpose,
        content_type=content_type,
        visibility=visibility,
    )


def test_internal_product_image_is_valid():
    asset = make_asset()

    result = (
        routes
        ._validated_commerce_image_asset(
            FakeDB(asset),
            asset_id=asset.id,
        )
    )

    assert result is asset


def test_product_image_rejects_wrong_purpose():
    asset = make_asset(
        purpose=FILE_PURPOSE_GENERAL,
    )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes._validated_commerce_image_asset(
            FakeDB(asset),
            asset_id=asset.id,
        )

    assert exc_info.value.status_code == 400


def test_product_image_requires_image_content():
    asset = make_asset(
        content_type="application/pdf",
    )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes._validated_commerce_image_asset(
            FakeDB(asset),
            asset_id=asset.id,
        )

    assert exc_info.value.status_code == 400


def test_private_product_image_is_rejected():
    asset = make_asset(
        visibility=FILE_VISIBILITY_PRIVATE,
    )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes._validated_commerce_image_asset(
            FakeDB(asset),
            asset_id=asset.id,
        )

    assert exc_info.value.status_code == 400


def test_public_product_uses_managed_image_url():
    asset = make_asset(
        visibility=FILE_VISIBILITY_PUBLIC,
    )

    item = SimpleNamespace(
        image_asset_id=asset.id,
        image_url="/legacy/product.jpg",
    )

    result = (
        routes._commerce_image_public_url(
            FakeDB(asset),
            item=item,
        )
    )

    assert result == (
        f"/files/public/{asset.id}"
    )


def test_internal_managed_product_image_not_public():
    asset = make_asset()

    item = SimpleNamespace(
        image_asset_id=asset.id,
        image_url="/legacy/product.jpg",
    )

    result = (
        routes._commerce_image_public_url(
            FakeDB(asset),
            item=item,
        )
    )

    assert result is None


def test_legacy_product_image_still_supported():
    item = SimpleNamespace(
        image_asset_id=None,
        image_url="/demo/store/item.jpg",
    )

    result = (
        routes._commerce_image_public_url(
            FakeDB(None),
            item=item,
        )
    )

    assert result == (
        "/demo/store/item.jpg"
    )


def test_product_image_usage_moves_on_replace(
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
        "_sync_commerce_image_visibility",
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

    item = SimpleNamespace(
        id="item-1",
        image_asset_id="new-asset",
    )

    routes._sync_commerce_image_usage(
        db,
        item=item,
        previous_asset_id="old-asset",
    )

    assert calls == [
        ("remove", "old-asset"),
        ("add", "new-asset"),
        ("visibility", "old-asset"),
        ("visibility", "new-asset"),
    ]
