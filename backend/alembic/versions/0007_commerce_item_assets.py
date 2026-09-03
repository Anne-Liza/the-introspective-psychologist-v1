"""add commerce item asset references

Revision ID: 0007_commerce_item_assets
Revises: 0006_blog_cover_assets
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0007_commerce_item_assets"

down_revision: Union[str, None] = (
    "0006_blog_cover_assets"
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
        "commerce_items",
        sa.Column(
            "image_asset_id",
            sa.String(),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        "fk_commerce_items_image_asset_id_files",
        "commerce_items",
        "files",
        ["image_asset_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index(
        "ix_commerce_items_image_asset_id",
        "commerce_items",
        ["image_asset_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_commerce_items_image_asset_id",
        table_name="commerce_items",
    )

    op.drop_constraint(
        "fk_commerce_items_image_asset_id_files",
        "commerce_items",
        type_="foreignkey",
    )

    op.drop_column(
        "commerce_items",
        "image_asset_id",
    )
