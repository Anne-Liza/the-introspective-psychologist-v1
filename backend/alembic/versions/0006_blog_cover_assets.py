"""add blog cover asset references

Revision ID: 0006_blog_cover_assets
Revises: 0005_therapist_profile_assets
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006_blog_cover_assets"

down_revision: Union[str, None] = (
    "0005_therapist_profile_assets"
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
        "blog_posts",
        sa.Column(
            "cover_image_asset_id",
            sa.String(),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        "fk_blog_posts_cover_image_asset_id_files",
        "blog_posts",
        "files",
        ["cover_image_asset_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index(
        "ix_blog_posts_cover_image_asset_id",
        "blog_posts",
        ["cover_image_asset_id"],
    )

    op.add_column(
        "blog_post_revisions",
        sa.Column(
            "cover_image_asset_id",
            sa.String(),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        (
            "fk_blog_post_revisions_"
            "cover_image_asset_id_files"
        ),
        "blog_post_revisions",
        "files",
        ["cover_image_asset_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index(
        (
            "ix_blog_post_revisions_"
            "cover_image_asset_id"
        ),
        "blog_post_revisions",
        ["cover_image_asset_id"],
    )


def downgrade() -> None:
    op.drop_index(
        (
            "ix_blog_post_revisions_"
            "cover_image_asset_id"
        ),
        table_name="blog_post_revisions",
    )

    op.drop_constraint(
        (
            "fk_blog_post_revisions_"
            "cover_image_asset_id_files"
        ),
        "blog_post_revisions",
        type_="foreignkey",
    )

    op.drop_column(
        "blog_post_revisions",
        "cover_image_asset_id",
    )

    op.drop_index(
        "ix_blog_posts_cover_image_asset_id",
        table_name="blog_posts",
    )

    op.drop_constraint(
        "fk_blog_posts_cover_image_asset_id_files",
        "blog_posts",
        type_="foreignkey",
    )

    op.drop_column(
        "blog_posts",
        "cover_image_asset_id",
    )
