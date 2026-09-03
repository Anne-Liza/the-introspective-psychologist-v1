from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.modules.files import routes
from app.modules.files.models import (
    FILE_PURPOSE_PRODUCT_IMAGE,
    FILE_PURPOSE_THERAPIST_PROFILE_IMAGE,
    FILE_VISIBILITY_INTERNAL,
    FILE_VISIBILITY_PUBLIC,
)


def make_user(
    user_id="user-1",
    permissions=(),
):
    role = SimpleNamespace(
        permissions=[
            SimpleNamespace(code=value)
            for value in permissions
        ]
    )

    return SimpleNamespace(
        id=user_id,
        roles=[role],
    )


def make_asset(
    *,
    owner_user_id="user-1",
    visibility=FILE_VISIBILITY_INTERNAL,
):
    return SimpleNamespace(
        id="file-1",
        original_filename="portrait.png",
        stored_filename="uuid.png",
        content_type="image/png",
        size_bytes=100,
        storage_provider="local",
        storage_path="uploads/uuid.png",
        uploaded_by_user_id=owner_user_id,
        owner_user_id=owner_user_id,
        visibility=visibility,
        purpose=(
            FILE_PURPOSE_THERAPIST_PROFILE_IMAGE
        ),
        created_at=None,
    )


def test_owner_can_read_internal_asset():
    user = make_user(
        permissions={
            "files.own.read",
        }
    )

    asset = make_asset()

    assert routes._can_read_file(
        user,
        asset,
    )


def test_other_owner_cannot_read_internal_asset():
    user = make_user(
        user_id="user-2",
        permissions={
            "files.own.read",
        },
    )

    asset = make_asset(
        owner_user_id="user-1",
    )

    assert not routes._can_read_file(
        user,
        asset,
    )


def test_admin_can_read_internal_asset():
    user = make_user(
        user_id="admin-1",
        permissions={
            "files.read",
        },
    )

    asset = make_asset(
        owner_user_id="user-1",
    )

    assert routes._can_read_file(
        user,
        asset,
    )


def test_any_authenticated_user_can_read_public_asset():
    user = make_user(
        user_id="user-2",
    )

    asset = make_asset(
        visibility=(
            FILE_VISIBILITY_PUBLIC
        ),
    )

    assert routes._can_read_file(
        user,
        asset,
    )


def test_public_endpoint_hides_internal_asset():
    class DB:
        def scalar(
            self,
            _statement,
        ):
            return make_asset(
                visibility=(
                    FILE_VISIBILITY_INTERNAL
                )
            )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes.get_public_file(
            "file-1",
            DB(),
        )

    assert (
        exc_info.value.status_code
        == 404
    )


def test_safe_response_hides_storage_details():
    class DB:
        def scalar(
            self,
            _statement,
        ):
            return 0

    asset = make_asset()

    payload = (
        routes.serialize_file_asset(
            DB(),
            asset,
        )
    )

    assert (
        "storage_path"
        not in payload
    )

    assert (
        "stored_filename"
        not in payload
    )

    assert (
        "owner_user_id"
        not in payload
    )

    assert payload["public_url"] is None

    assert payload["content_url"] == (
        "/files/content/file-1"
    )


def test_owned_asset_delete_blocked_when_in_use(
    monkeypatch,
):
    asset = make_asset()

    monkeypatch.setattr(
        routes,
        "_load_file_asset",
        lambda db, file_id: asset,
    )

    monkeypatch.setattr(
        routes,
        "file_is_in_use",
        lambda db, file_id: True,
    )

    user = make_user(
        permissions={
            "files.own.delete",
        },
    )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes.delete_owned_file(
            "file-1",
            SimpleNamespace(),
            user,
        )

    assert (
        exc_info.value.status_code
        == 409
    )


def test_legacy_metadata_creation_is_retired():
    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes.create_file_metadata(
            None,
            None,
            make_user(),
        )

    assert (
        exc_info.value.status_code
        == 410
    )


@pytest.mark.asyncio
async def test_self_service_rejects_admin_only_purpose():
    with pytest.raises(
        HTTPException
    ) as exc_info:
        await routes.upload_owned_file(
            None,
            None,
            FILE_PURPOSE_PRODUCT_IMAGE,
            None,
            make_user(),
        )

    assert (
        exc_info.value.status_code
        == 400
    )


@pytest.mark.asyncio
async def test_upload_passes_validated_content_type(
    monkeypatch,
):
    class Upload:
        filename = "portrait.png"
        content_type = "image/png"

        async def read(
            self,
            _limit,
        ):
            return b"fake-image-content"

    class Storage:
        def save(
            self,
            *,
            original_filename,
            content,
            content_type,
        ):
            assert (
                content_type
                == "image/png"
            )

            return SimpleNamespace(
                original_filename=(
                    original_filename
                ),
                stored_filename=(
                    "generated.png"
                ),
                content_type=(
                    content_type
                ),
                size_bytes=len(content),
                storage_provider="local",
                storage_path=(
                    "uploads/generated.png"
                ),
            )

    class DB:
        def add(
            self,
            _value,
        ):
            pass

        def commit(self):
            pass

        def refresh(
            self,
            _value,
        ):
            pass

    monkeypatch.setattr(
        routes,
        "get_storage_provider",
        lambda: Storage(),
    )

    monkeypatch.setattr(
        routes,
        "record_audit_event",
        lambda *args, **kwargs: None,
    )

    user = make_user()

    result = (
        await routes._store_uploaded_file(
            upload=Upload(),
            db=DB(),
            current_user=user,
            visibility=(
                FILE_VISIBILITY_INTERNAL
            ),
            purpose=(
                FILE_PURPOSE_THERAPIST_PROFILE_IMAGE
            ),
        )
    )

    assert (
        result.content_type
        == "image/png"
    )

    assert (
        result.owner_user_id
        == user.id
    )


@pytest.mark.asyncio
async def test_self_service_rejects_unknown_purpose():
    with pytest.raises(
        HTTPException
    ) as exc_info:
        await routes.upload_owned_file(
            None,
            None,
            "not-a-real-purpose",
            None,
            make_user(),
        )

    assert (
        exc_info.value.status_code
        == 400
    )


def test_public_asset_cannot_be_deleted_directly():
    asset = make_asset(
        visibility=(
            FILE_VISIBILITY_PUBLIC
        ),
    )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        routes._delete_asset(
            db=SimpleNamespace(),
            current_user=make_user(),
            file_asset=asset,
        )

    assert (
        exc_info.value.status_code
        == 409
    )
