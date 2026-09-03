"""add landing section asset references

Revision ID: 0008_landing_section_assets
Revises: 0007_commerce_item_assets
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0008_landing_section_assets"

down_revision: Union[str, None] = (
    "0007_commerce_item_assets"
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
        "landing_sections",
        sa.Column(
            "image_asset_id",
            sa.String(),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        "fk_landing_sections_image_asset_id_files",
        "landing_sections",
        "files",
        ["image_asset_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index(
        "ix_landing_sections_image_asset_id",
        "landing_sections",
        ["image_asset_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_landing_sections_image_asset_id",
        table_name="landing_sections",
    )

    op.drop_constraint(
        "fk_landing_sections_image_asset_id_files",
        "landing_sections",
        type_="foreignkey",
    )

    op.drop_column(
        "landing_sections",
        "image_asset_id",
    )
