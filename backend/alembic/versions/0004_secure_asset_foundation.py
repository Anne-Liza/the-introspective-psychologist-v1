"""add secure asset foundation

Revision ID: 0004_secure_asset_foundation
Revises: 0003_blog_publishing_workflow
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = (
    "0004_secure_asset_foundation"
)

down_revision: Union[str, None] = (
    "0003_blog_publishing_workflow"
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
        "files",
        sa.Column(
            "owner_user_id",
            sa.String(),
            nullable=True,
        ),
    )

    op.add_column(
        "files",
        sa.Column(
            "visibility",
            sa.String(length=20),
            nullable=False,
            server_default="internal",
        ),
    )

    op.add_column(
        "files",
        sa.Column(
            "purpose",
            sa.String(length=80),
            nullable=False,
            server_default="general",
        ),
    )

    op.create_foreign_key(
        "fk_files_owner_user_id_users",
        "files",
        "users",
        ["owner_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index(
        "ix_files_owner_user_id",
        "files",
        ["owner_user_id"],
    )

    op.create_index(
        "ix_files_visibility",
        "files",
        ["visibility"],
    )

    op.create_index(
        "ix_files_purpose",
        "files",
        ["purpose"],
    )

    op.create_check_constraint(
        "ck_files_visibility",
        "files",
        (
            "visibility IN "
            "('public', 'internal', 'private')"
        ),
    )

    # Preserve the behavior of assets created before
    # visibility existed. They were already available
    # through /files/public/{id}.
    op.execute(
        """
        UPDATE files
        SET visibility = 'public'
        """
    )

    # Existing uploader becomes the initial owner.
    op.execute(
        """
        UPDATE files
        SET owner_user_id = uploaded_by_user_id
        WHERE owner_user_id IS NULL
        """
    )

    op.create_table(
        "file_asset_usages",
        sa.Column(
            "id",
            sa.String(),
            nullable=False,
        ),
        sa.Column(
            "file_id",
            sa.String(),
            nullable=False,
        ),
        sa.Column(
            "entity_type",
            sa.String(length=80),
            nullable=False,
        ),
        sa.Column(
            "entity_id",
            sa.String(length=120),
            nullable=False,
        ),
        sa.Column(
            "field_name",
            sa.String(length=80),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["file_id"],
            ["files.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "id",
        ),
        sa.UniqueConstraint(
            "file_id",
            "entity_type",
            "entity_id",
            "field_name",
            name=(
                "uq_file_asset_usage_reference"
            ),
        ),
    )

    op.create_index(
        "ix_file_asset_usages_file_id",
        "file_asset_usages",
        ["file_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_file_asset_usages_file_id",
        table_name="file_asset_usages",
    )

    op.drop_table(
        "file_asset_usages"
    )

    op.drop_constraint(
        "ck_files_visibility",
        "files",
        type_="check",
    )

    op.drop_index(
        "ix_files_purpose",
        table_name="files",
    )

    op.drop_index(
        "ix_files_visibility",
        table_name="files",
    )

    op.drop_index(
        "ix_files_owner_user_id",
        table_name="files",
    )

    op.drop_constraint(
        "fk_files_owner_user_id_users",
        "files",
        type_="foreignkey",
    )

    op.drop_column(
        "files",
        "purpose",
    )

    op.drop_column(
        "files",
        "visibility",
    )

    op.drop_column(
        "files",
        "owner_user_id",
    )
