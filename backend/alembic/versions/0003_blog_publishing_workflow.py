"""add blog publishing workflow

Revision ID: 0003_blog_publishing_workflow
Revises: 0002_mpesa_reconciliation
"""

from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision: str = "0003_blog_publishing_workflow"
down_revision: Union[str, None] = "0002_mpesa_reconciliation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Stable ownership and publication metadata.
    op.add_column(
        "blog_posts",
        sa.Column(
            "owner_user_id",
            sa.String(),
            nullable=True,
        ),
    )
    op.add_column(
        "blog_posts",
        sa.Column(
            "therapist_profile_id",
            sa.String(),
            nullable=True,
        ),
    )
    op.add_column(
        "blog_posts",
        sa.Column(
            "created_by_user_id",
            sa.String(),
            nullable=True,
        ),
    )
    op.add_column(
        "blog_posts",
        sa.Column(
            "content_type",
            sa.String(length=40),
            nullable=False,
            server_default="article",
        ),
    )
    op.add_column(
        "blog_posts",
        sa.Column(
            "external_url",
            sa.String(length=1000),
            nullable=True,
        ),
    )
    op.add_column(
        "blog_posts",
        sa.Column(
            "source_name",
            sa.String(length=220),
            nullable=True,
        ),
    )
    op.add_column(
        "blog_posts",
        sa.Column(
            "source_author",
            sa.String(length=220),
            nullable=True,
        ),
    )
    op.add_column(
        "blog_posts",
        sa.Column(
            "source_published_at",
            sa.DateTime(),
            nullable=True,
        ),
    )
    op.add_column(
        "blog_posts",
        sa.Column(
            "featured_media_type",
            sa.String(length=20),
            nullable=False,
            server_default="none",
        ),
    )
    op.add_column(
        "blog_posts",
        sa.Column(
            "video_url",
            sa.String(length=1000),
            nullable=True,
        ),
    )
    op.add_column(
        "blog_posts",
        sa.Column(
            "media_caption",
            sa.Text(),
            nullable=True,
        ),
    )
    op.add_column(
        "blog_posts",
        sa.Column(
            "media_credit",
            sa.String(length=300),
            nullable=True,
        ),
    )
    op.add_column(
        "blog_posts",
        sa.Column(
            "published_by_user_id",
            sa.String(),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        "fk_blog_posts_owner_user_id_users",
        "blog_posts",
        "users",
        ["owner_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_blog_posts_therapist_profile_id_therapist_profiles",
        "blog_posts",
        "therapist_profiles",
        ["therapist_profile_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_blog_posts_created_by_user_id_users",
        "blog_posts",
        "users",
        ["created_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_blog_posts_published_by_user_id_users",
        "blog_posts",
        "users",
        ["published_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_check_constraint(
        "ck_blog_posts_content_type",
        "blog_posts",
        "content_type IN "
        "('article', 'editorial', 'external_coverage', "
        "'external_article', 'licensed_republication')",
    )
    op.create_check_constraint(
        "ck_blog_posts_featured_media_type",
        "blog_posts",
        "featured_media_type IN ('none', 'image', 'video')",
    )

    op.create_index(
        "ix_blog_posts_owner_user_id",
        "blog_posts",
        ["owner_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_blog_posts_therapist_profile_id",
        "blog_posts",
        ["therapist_profile_id"],
        unique=False,
    )
    op.create_index(
        "ix_blog_posts_content_type",
        "blog_posts",
        ["content_type"],
        unique=False,
    )

    # Existing cover images become image featured media.
    op.execute(
        """
        UPDATE blog_posts
        SET featured_media_type = 'image'
        WHERE cover_image_url IS NOT NULL
        """
    )

    # Versioned editorial content.
    op.create_table(
        "blog_post_revisions",
        sa.Column(
            "id",
            sa.String(),
            nullable=False,
        ),
        sa.Column(
            "blog_post_id",
            sa.String(),
            nullable=False,
        ),
        sa.Column(
            "version_number",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "title",
            sa.String(length=220),
            nullable=False,
        ),
        sa.Column(
            "excerpt",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "body_markdown",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "category",
            sa.String(length=120),
            nullable=True,
        ),
        sa.Column(
            "tags",
            sa.JSON(),
            nullable=False,
        ),
        sa.Column(
            "author_name",
            sa.String(length=180),
            nullable=True,
        ),
        sa.Column(
            "content_type",
            sa.String(length=40),
            nullable=False,
        ),
        sa.Column(
            "external_url",
            sa.String(length=1000),
            nullable=True,
        ),
        sa.Column(
            "source_name",
            sa.String(length=220),
            nullable=True,
        ),
        sa.Column(
            "source_author",
            sa.String(length=220),
            nullable=True,
        ),
        sa.Column(
            "source_published_at",
            sa.DateTime(),
            nullable=True,
        ),
        sa.Column(
            "featured_media_type",
            sa.String(length=20),
            nullable=False,
        ),
        sa.Column(
            "cover_image_url",
            sa.String(length=500),
            nullable=True,
        ),
        sa.Column(
            "cover_image_alt",
            sa.String(length=220),
            nullable=True,
        ),
        sa.Column(
            "video_url",
            sa.String(length=1000),
            nullable=True,
        ),
        sa.Column(
            "media_caption",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "media_credit",
            sa.String(length=300),
            nullable=True,
        ),
        sa.Column(
            "is_featured",
            sa.Boolean(),
            nullable=False,
        ),
        sa.Column(
            "seo_title",
            sa.String(length=220),
            nullable=True,
        ),
        sa.Column(
            "seo_description",
            sa.String(length=320),
            nullable=True,
        ),
        sa.Column(
            "review_status",
            sa.String(length=32),
            nullable=False,
        ),
        sa.Column(
            "submitted_at",
            sa.DateTime(),
            nullable=True,
        ),
        sa.Column(
            "reviewed_by_user_id",
            sa.String(),
            nullable=True,
        ),
        sa.Column(
            "reviewed_at",
            sa.DateTime(),
            nullable=True,
        ),
        sa.Column(
            "review_notes",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "created_by_user_id",
            sa.String(),
            nullable=True,
        ),
        sa.Column(
            "updated_by_user_id",
            sa.String(),
            nullable=True,
        ),
        sa.Column(
            "is_current_publication",
            sa.Boolean(),
            nullable=False,
        ),
        sa.Column(
            "published_by_user_id",
            sa.String(),
            nullable=True,
        ),
        sa.Column(
            "published_at",
            sa.DateTime(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["blog_post_id"],
            ["blog_posts.id"],
            name="fk_blog_post_revisions_blog_post_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by_user_id"],
            ["users.id"],
            name="fk_blog_post_revisions_reviewed_by_user_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
            name="fk_blog_post_revisions_created_by_user_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["updated_by_user_id"],
            ["users.id"],
            name="fk_blog_post_revisions_updated_by_user_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["published_by_user_id"],
            ["users.id"],
            name="fk_blog_post_revisions_published_by_user_id",
            ondelete="SET NULL",
        ),
        sa.CheckConstraint(
            "review_status IN "
            "('draft', 'pending_review', 'changes_requested', "
            "'approved', 'rejected')",
            name="ck_blog_post_revisions_review_status",
        ),
        sa.CheckConstraint(
            "content_type IN "
            "('article', 'editorial', 'external_coverage', "
            "'external_article', 'licensed_republication')",
            name="ck_blog_post_revisions_content_type",
        ),
        sa.CheckConstraint(
            "featured_media_type IN ('none', 'image', 'video')",
            name="ck_blog_post_revisions_featured_media_type",
        ),
        sa.UniqueConstraint(
            "blog_post_id",
            "version_number",
            name="uq_blog_post_revision_version",
        ),
    )

    op.create_index(
        "ix_blog_post_revisions_blog_post_id",
        "blog_post_revisions",
        ["blog_post_id"],
        unique=False,
    )
    op.create_index(
        "ix_blog_post_revisions_review_status",
        "blog_post_revisions",
        ["review_status"],
        unique=False,
    )
    op.create_index(
        "ix_blog_post_revisions_is_current_publication",
        "blog_post_revisions",
        ["is_current_publication"],
        unique=False,
    )

    # Append-only review and publication history.
    op.create_table(
        "blog_review_events",
        sa.Column(
            "id",
            sa.String(),
            nullable=False,
        ),
        sa.Column(
            "blog_post_id",
            sa.String(),
            nullable=False,
        ),
        sa.Column(
            "revision_id",
            sa.String(),
            nullable=True,
        ),
        sa.Column(
            "actor_user_id",
            sa.String(),
            nullable=True,
        ),
        sa.Column(
            "action",
            sa.String(length=40),
            nullable=False,
        ),
        sa.Column(
            "note",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["blog_post_id"],
            ["blog_posts.id"],
            name="fk_blog_review_events_blog_post_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["revision_id"],
            ["blog_post_revisions.id"],
            name="fk_blog_review_events_revision_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
            name="fk_blog_review_events_actor_user_id",
            ondelete="SET NULL",
        ),
        sa.CheckConstraint(
            "action IN "
            "('created', 'submitted', 'changes_requested', "
            "'approved', 'rejected', 'published', 'unpublished', "
            "'archived', 'restored')",
            name="ck_blog_review_events_action",
        ),
    )

    op.create_index(
        "ix_blog_review_events_blog_post_id",
        "blog_review_events",
        ["blog_post_id"],
        unique=False,
    )
    op.create_index(
        "ix_blog_review_events_revision_id",
        "blog_review_events",
        ["revision_id"],
        unique=False,
    )
    op.create_index(
        "ix_blog_review_events_created_at",
        "blog_review_events",
        ["created_at"],
        unique=False,
    )

    # Backfill every existing article into revision version 1.
    bind = op.get_bind()

    existing_posts = bind.execute(
        sa.text(
            """
            SELECT
                id,
                title,
                excerpt,
                body_markdown,
                category,
                tags,
                author_name,
                content_type,
                external_url,
                source_name,
                source_author,
                source_published_at,
                featured_media_type,
                cover_image_url,
                cover_image_alt,
                video_url,
                media_caption,
                media_credit,
                is_featured,
                seo_title,
                seo_description,
                status,
                published_at,
                created_at,
                updated_at
            FROM blog_posts
            """
        )
    ).mappings().all()

    revisions = sa.table(
        "blog_post_revisions",
        sa.column("id", sa.String()),
        sa.column("blog_post_id", sa.String()),
        sa.column("version_number", sa.Integer()),
        sa.column("title", sa.String()),
        sa.column("excerpt", sa.Text()),
        sa.column("body_markdown", sa.Text()),
        sa.column("category", sa.String()),
        sa.column("tags", sa.JSON()),
        sa.column("author_name", sa.String()),
        sa.column("content_type", sa.String()),
        sa.column("external_url", sa.String()),
        sa.column("source_name", sa.String()),
        sa.column("source_author", sa.String()),
        sa.column("source_published_at", sa.DateTime()),
        sa.column("featured_media_type", sa.String()),
        sa.column("cover_image_url", sa.String()),
        sa.column("cover_image_alt", sa.String()),
        sa.column("video_url", sa.String()),
        sa.column("media_caption", sa.Text()),
        sa.column("media_credit", sa.String()),
        sa.column("is_featured", sa.Boolean()),
        sa.column("seo_title", sa.String()),
        sa.column("seo_description", sa.String()),
        sa.column("review_status", sa.String()),
        sa.column("submitted_at", sa.DateTime()),
        sa.column("reviewed_by_user_id", sa.String()),
        sa.column("reviewed_at", sa.DateTime()),
        sa.column("review_notes", sa.Text()),
        sa.column("created_by_user_id", sa.String()),
        sa.column("updated_by_user_id", sa.String()),
        sa.column("is_current_publication", sa.Boolean()),
        sa.column("published_by_user_id", sa.String()),
        sa.column("published_at", sa.DateTime()),
        sa.column("created_at", sa.DateTime()),
        sa.column("updated_at", sa.DateTime()),
    )

    for post in existing_posts:
        is_published = post["status"] == "published"

        bind.execute(
            revisions.insert().values(
                id=str(uuid4()),
                blog_post_id=post["id"],
                version_number=1,
                title=post["title"],
                excerpt=post["excerpt"],
                body_markdown=post["body_markdown"],
                category=post["category"],
                tags=post["tags"] or [],
                author_name=post["author_name"],
                content_type=post["content_type"],
                external_url=post["external_url"],
                source_name=post["source_name"],
                source_author=post["source_author"],
                source_published_at=post[
                    "source_published_at"
                ],
                featured_media_type=post[
                    "featured_media_type"
                ],
                cover_image_url=post["cover_image_url"],
                cover_image_alt=post["cover_image_alt"],
                video_url=post["video_url"],
                media_caption=post["media_caption"],
                media_credit=post["media_credit"],
                is_featured=post["is_featured"],
                seo_title=post["seo_title"],
                seo_description=post["seo_description"],
                review_status=(
                    "approved"
                    if is_published
                    else "draft"
                ),
                submitted_at=None,
                reviewed_by_user_id=None,
                reviewed_at=None,
                review_notes=None,
                created_by_user_id=None,
                updated_by_user_id=None,
                is_current_publication=is_published,
                published_by_user_id=None,
                published_at=post["published_at"],
                created_at=post["created_at"],
                updated_at=post["updated_at"],
            )
        )

    # Defaults were only needed to safely migrate existing rows.
    op.alter_column(
        "blog_posts",
        "content_type",
        server_default=None,
    )
    op.alter_column(
        "blog_posts",
        "featured_media_type",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_table("blog_review_events")
    op.drop_table("blog_post_revisions")

    op.drop_index(
        "ix_blog_posts_content_type",
        table_name="blog_posts",
    )
    op.drop_index(
        "ix_blog_posts_therapist_profile_id",
        table_name="blog_posts",
    )
    op.drop_index(
        "ix_blog_posts_owner_user_id",
        table_name="blog_posts",
    )

    op.drop_constraint(
        "ck_blog_posts_featured_media_type",
        "blog_posts",
        type_="check",
    )
    op.drop_constraint(
        "ck_blog_posts_content_type",
        "blog_posts",
        type_="check",
    )

    op.drop_constraint(
        "fk_blog_posts_published_by_user_id_users",
        "blog_posts",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_blog_posts_created_by_user_id_users",
        "blog_posts",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_blog_posts_therapist_profile_id_therapist_profiles",
        "blog_posts",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_blog_posts_owner_user_id_users",
        "blog_posts",
        type_="foreignkey",
    )

    op.drop_column(
        "blog_posts",
        "published_by_user_id",
    )
    op.drop_column(
        "blog_posts",
        "media_credit",
    )
    op.drop_column(
        "blog_posts",
        "media_caption",
    )
    op.drop_column(
        "blog_posts",
        "video_url",
    )
    op.drop_column(
        "blog_posts",
        "featured_media_type",
    )
    op.drop_column(
        "blog_posts",
        "source_published_at",
    )
    op.drop_column(
        "blog_posts",
        "source_author",
    )
    op.drop_column(
        "blog_posts",
        "source_name",
    )
    op.drop_column(
        "blog_posts",
        "external_url",
    )
    op.drop_column(
        "blog_posts",
        "content_type",
    )
    op.drop_column(
        "blog_posts",
        "created_by_user_id",
    )
    op.drop_column(
        "blog_posts",
        "therapist_profile_id",
    )
    op.drop_column(
        "blog_posts",
        "owner_user_id",
    )
