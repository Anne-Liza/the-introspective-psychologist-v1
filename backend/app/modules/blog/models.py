from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utc_now


BLOG_CONTENT_TYPES = (
    "article",
    "editorial",
    "external_coverage",
    "external_article",
    "licensed_republication",
)

BLOG_REVIEW_STATUSES = (
    "draft",
    "pending_review",
    "changes_requested",
    "approved",
    "rejected",
)

BLOG_MEDIA_TYPES = (
    "none",
    "image",
    "video",
)

BLOG_REVIEW_ACTIONS = (
    "created",
    "submitted",
    "changes_requested",
    "approved",
    "rejected",
    "published",
    "unpublished",
    "archived",
    "restored",
)


class BlogPost(Base):
    """
    Stable blog/article identity and current public publication.

    Draft/review work belongs to BlogPostRevision so editing a new
    revision never mutates the currently published article.
    """

    __tablename__ = "blog_posts"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'published')",
            name="ck_blog_posts_status",
        ),
        CheckConstraint(
            "content_type IN "
            "('article', 'editorial', 'external_coverage', "
            "'external_article', 'licensed_republication')",
            name="ck_blog_posts_content_type",
        ),
        CheckConstraint(
            "featured_media_type IN ('none', 'image', 'video')",
            name="ck_blog_posts_featured_media_type",
        ),
    )

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid4()),
    )

    # Stable identity.
    slug: Mapped[str] = mapped_column(
        String(180),
        unique=True,
        index=True,
        nullable=False,
    )

    # Ownership and provenance.
    owner_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    therapist_profile_id: Mapped[str | None] = mapped_column(
        ForeignKey(
            "therapist_profiles.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )
    created_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Current published/public snapshot.
    title: Mapped[str] = mapped_column(
        String(220),
        nullable=False,
    )
    excerpt: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    body_markdown: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    category: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )
    tags: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    author_name: Mapped[str | None] = mapped_column(
        String(180),
        nullable=True,
    )

    content_type: Mapped[str] = mapped_column(
        String(40),
        default="article",
        nullable=False,
        index=True,
    )

    # External publication / press metadata.
    external_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )
    source_name: Mapped[str | None] = mapped_column(
        String(220),
        nullable=True,
    )
    source_author: Mapped[str | None] = mapped_column(
        String(220),
        nullable=True,
    )
    source_published_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    # Featured media.
    featured_media_type: Mapped[str] = mapped_column(
        String(20),
        default="none",
        nullable=False,
    )
    cover_image_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    cover_image_asset_id: Mapped[str | None] = mapped_column(
        ForeignKey(
            "files.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )
    cover_image_alt: Mapped[str | None] = mapped_column(
        String(220),
        nullable=True,
    )
    video_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )
    media_caption: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    media_credit: Mapped[str | None] = mapped_column(
        String(300),
        nullable=True,
    )

    # Publication.
    status: Mapped[str] = mapped_column(
        String(32),
        default="draft",
        nullable=False,
        index=True,
    )
    is_featured: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
        index=True,
    )
    published_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Search / SEO.
    seo_title: Mapped[str | None] = mapped_column(
        String(220),
        nullable=True,
    )
    seo_description: Mapped[str | None] = mapped_column(
        String(320),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )


class BlogPostRevision(Base):
    """
    Versioned article content.

    Therapists and admins edit revisions. Only an approved revision
    can later become the BlogPost's live public snapshot.
    """

    __tablename__ = "blog_post_revisions"
    __table_args__ = (
        CheckConstraint(
            "review_status IN "
            "('draft', 'pending_review', 'changes_requested', "
            "'approved', 'rejected')",
            name="ck_blog_post_revisions_review_status",
        ),
        CheckConstraint(
            "content_type IN "
            "('article', 'editorial', 'external_coverage', "
            "'external_article', 'licensed_republication')",
            name="ck_blog_post_revisions_content_type",
        ),
        CheckConstraint(
            "featured_media_type IN ('none', 'image', 'video')",
            name="ck_blog_post_revisions_featured_media_type",
        ),
        UniqueConstraint(
            "blog_post_id",
            "version_number",
            name="uq_blog_post_revision_version",
        ),
    )

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    blog_post_id: Mapped[str] = mapped_column(
        ForeignKey(
            "blog_posts.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )
    version_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # Versioned article content.
    title: Mapped[str] = mapped_column(
        String(220),
        nullable=False,
    )
    excerpt: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    body_markdown: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    category: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )
    tags: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    author_name: Mapped[str | None] = mapped_column(
        String(180),
        nullable=True,
    )

    content_type: Mapped[str] = mapped_column(
        String(40),
        default="article",
        nullable=False,
    )

    # External source metadata.
    external_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )
    source_name: Mapped[str | None] = mapped_column(
        String(220),
        nullable=True,
    )
    source_author: Mapped[str | None] = mapped_column(
        String(220),
        nullable=True,
    )
    source_published_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    # Media.
    featured_media_type: Mapped[str] = mapped_column(
        String(20),
        default="none",
        nullable=False,
    )
    cover_image_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    cover_image_asset_id: Mapped[str | None] = mapped_column(
        ForeignKey(
            "files.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )
    cover_image_alt: Mapped[str | None] = mapped_column(
        String(220),
        nullable=True,
    )
    video_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )
    media_caption: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    media_credit: Mapped[str | None] = mapped_column(
        String(300),
        nullable=True,
    )

    is_featured: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    seo_title: Mapped[str | None] = mapped_column(
        String(220),
        nullable=True,
    )
    seo_description: Mapped[str | None] = mapped_column(
        String(320),
        nullable=True,
    )

    # Editorial review lifecycle.
    review_status: Mapped[str] = mapped_column(
        String(32),
        default="draft",
        nullable=False,
        index=True,
    )
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )
    reviewed_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )
    review_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Editing provenance.
    created_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Publication provenance.
    is_current_publication: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )
    published_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )


class BlogReviewEvent(Base):
    """
    Append-only editorial history.

    Review notes belong to events so previous feedback is never lost
    when a later review decision is made.
    """

    __tablename__ = "blog_review_events"
    __table_args__ = (
        CheckConstraint(
            "action IN "
            "('created', 'submitted', 'changes_requested', "
            "'approved', 'rejected', 'published', 'unpublished', "
            "'archived', 'restored')",
            name="ck_blog_review_events_action",
        ),
    )

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    blog_post_id: Mapped[str] = mapped_column(
        ForeignKey(
            "blog_posts.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )
    revision_id: Mapped[str | None] = mapped_column(
        ForeignKey(
            "blog_post_revisions.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )
    actor_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
    )
    note: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
        nullable=False,
        index=True,
    )
