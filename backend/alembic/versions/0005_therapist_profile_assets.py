"""add therapist profile asset references

Revision ID: 0005_therapist_profile_assets
Revises: 0004_secure_asset_foundation
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = (
    "0005_therapist_profile_assets"
)

down_revision: Union[str, None] = (
    "0004_secure_asset_foundation"
)

branch_labels: Union[
    str,
    Sequence[str],
    None,
] = None

depends_on: Union[
    str,
    Sequence[str],
    None,
] = None


def upgrade() -> None:
    op.add_column(
        "therapist_profiles",
        sa.Column(
            "profile_image_asset_id",
            sa.String(),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        (
            "fk_therapist_profiles_"
            "profile_image_asset_id_files"
        ),
        "therapist_profiles",
        "files",
        ["profile_image_asset_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index(
        (
            "ix_therapist_profiles_"
            "profile_image_asset_id"
        ),
        "therapist_profiles",
        ["profile_image_asset_id"],
    )

    op.add_column(
        "therapist_profile_revisions",
        sa.Column(
            "profile_image_asset_id",
            sa.String(),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        (
            "fk_therapist_profile_revisions_"
            "profile_image_asset_id_files"
        ),
        "therapist_profile_revisions",
        "files",
        ["profile_image_asset_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index(
        (
            "ix_therapist_profile_revisions_"
            "profile_image_asset_id"
        ),
        "therapist_profile_revisions",
        ["profile_image_asset_id"],
    )


def downgrade() -> None:
    op.drop_index(
        (
            "ix_therapist_profile_revisions_"
            "profile_image_asset_id"
        ),
        table_name=(
            "therapist_profile_revisions"
        ),
    )

    op.drop_constraint(
        (
            "fk_therapist_profile_revisions_"
            "profile_image_asset_id_files"
        ),
        "therapist_profile_revisions",
        type_="foreignkey",
    )

    op.drop_column(
        "therapist_profile_revisions",
        "profile_image_asset_id",
    )

    op.drop_index(
        (
            "ix_therapist_profiles_"
            "profile_image_asset_id"
        ),
        table_name="therapist_profiles",
    )

    op.drop_constraint(
        (
            "fk_therapist_profiles_"
            "profile_image_asset_id_files"
        ),
        "therapist_profiles",
        type_="foreignkey",
    )

    op.drop_column(
        "therapist_profiles",
        "profile_image_asset_id",
    )
