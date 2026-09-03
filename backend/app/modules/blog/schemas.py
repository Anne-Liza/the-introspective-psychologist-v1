import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.url_safety import validate_public_url_or_path


SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


class BlogPostBase(BaseModel):
    title: str = Field(min_length=1, max_length=220)
    slug: str = Field(min_length=1, max_length=180)
    excerpt: str | None = Field(default=None, max_length=600)
    body_markdown: str = Field(min_length=1, max_length=100_000)
    cover_image_url: str | None = None
    cover_image_asset_id: str | None = None
    cover_image_alt: str | None = Field(default=None, max_length=220)
    category: str | None = Field(default=None, max_length=120)
    tags: list[str] = Field(default_factory=list, max_length=20)
    author_name: str | None = Field(default=None, max_length=180)
    status: Literal["draft", "published"] = "draft"
    is_featured: bool = False
    seo_title: str | None = Field(default=None, max_length=220)
    seo_description: str | None = Field(default=None, max_length=320)

    @field_validator("title", "body_markdown")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value cannot be blank.")
        return normalized

    @field_validator(
        "excerpt",
        "cover_image_alt",
        "category",
        "author_name",
        "seo_title",
        "seo_description",
    )
    @classmethod
    def trim_optional_text(cls, value: str | None) -> str | None:
        return clean_optional_text(value)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not SLUG_PATTERN.fullmatch(normalized):
            raise ValueError("slug must contain lowercase letters, numbers, and single hyphens only.")
        return normalized

    @field_validator("cover_image_url")
    @classmethod
    def validate_cover_image_url(cls, value: str | None) -> str | None:
        return validate_public_url_or_path(value, field_name="cover_image_url")

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, value: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()

        for raw_tag in value:
            tag = raw_tag.strip()
            key = tag.casefold()
            if not tag or key in seen:
                continue
            if len(tag) > 50:
                raise ValueError("Each tag must be 50 characters or fewer.")
            normalized.append(tag)
            seen.add(key)

        return normalized

    @model_validator(mode="after")
    def require_cover_image_alt(self):
        if (
            self.cover_image_url
            or self.cover_image_asset_id
        ) and not self.cover_image_alt:
            raise ValueError(
                "cover_image_alt is required "
                "when a cover image is set."
            )
        return self


class BlogPostCreate(BlogPostBase):
    pass


class BlogPostUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=220)
    slug: str | None = Field(default=None, min_length=1, max_length=180)
    excerpt: str | None = Field(default=None, max_length=600)
    body_markdown: str | None = Field(default=None, min_length=1, max_length=100_000)
    cover_image_url: str | None = None
    cover_image_asset_id: str | None = None
    cover_image_alt: str | None = Field(default=None, max_length=220)
    category: str | None = Field(default=None, max_length=120)
    tags: list[str] | None = Field(default=None, max_length=20)
    author_name: str | None = Field(default=None, max_length=180)
    status: Literal["draft", "published"] | None = None
    is_featured: bool | None = None
    seo_title: str | None = Field(default=None, max_length=220)
    seo_description: str | None = Field(default=None, max_length=320)

    @field_validator("title", "body_markdown")
    @classmethod
    def trim_required_updates(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value cannot be blank.")
        return normalized

    @field_validator(
        "excerpt",
        "cover_image_alt",
        "category",
        "author_name",
        "seo_title",
        "seo_description",
    )
    @classmethod
    def trim_optional_updates(cls, value: str | None) -> str | None:
        return clean_optional_text(value)

    @field_validator("slug")
    @classmethod
    def validate_update_slug(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if not SLUG_PATTERN.fullmatch(normalized):
            raise ValueError("slug must contain lowercase letters, numbers, and single hyphens only.")
        return normalized

    @field_validator("cover_image_url")
    @classmethod
    def validate_update_cover_image_url(cls, value: str | None) -> str | None:
        return validate_public_url_or_path(value, field_name="cover_image_url")

    @field_validator("tags")
    @classmethod
    def normalize_update_tags(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return BlogPostBase.normalize_tags(value)


class BlogPostRead(BlogPostBase):
    id: str
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


BLOG_CONTENT_TYPE = Literal[
    "article",
    "editorial",
    "external_coverage",
    "external_article",
    "licensed_republication",
]

BLOG_MEDIA_TYPE = Literal[
    "none",
    "image",
    "video",
]

BLOG_REVIEW_STATUS = Literal[
    "draft",
    "pending_review",
    "changes_requested",
    "approved",
    "rejected",
]

BLOG_REVIEW_DECISION = Literal[
    "changes_requested",
    "approved",
    "rejected",
]


class BlogDraftContent(BaseModel):
    model_config = {
        "extra": "forbid",
    }

    title: str = Field(
        min_length=1,
        max_length=220,
    )
    excerpt: str | None = Field(
        default=None,
        max_length=600,
    )
    body_markdown: str = Field(
        min_length=1,
        max_length=100_000,
    )

    category: str | None = Field(
        default=None,
        max_length=120,
    )
    tags: list[str] = Field(
        default_factory=list,
        max_length=20,
    )
    author_name: str | None = Field(
        default=None,
        max_length=180,
    )

    content_type: BLOG_CONTENT_TYPE = "article"

    external_url: str | None = None
    source_name: str | None = Field(
        default=None,
        max_length=220,
    )
    source_author: str | None = Field(
        default=None,
        max_length=220,
    )
    source_published_at: datetime | None = None

    featured_media_type: BLOG_MEDIA_TYPE = "none"

    cover_image_url: str | None = None
    cover_image_asset_id: str | None = None
    cover_image_alt: str | None = Field(
        default=None,
        max_length=220,
    )
    video_url: str | None = None
    media_caption: str | None = None
    media_credit: str | None = Field(
        default=None,
        max_length=300,
    )

    is_featured: bool = False

    seo_title: str | None = Field(
        default=None,
        max_length=220,
    )
    seo_description: str | None = Field(
        default=None,
        max_length=320,
    )

    @field_validator(
        "title",
        "body_markdown",
    )
    @classmethod
    def trim_blog_required_text(
        cls,
        value: str,
    ) -> str:
        normalized = value.strip()

        if not normalized:
            raise ValueError(
                "Value cannot be blank."
            )

        return normalized

    @field_validator(
        "excerpt",
        "category",
        "author_name",
        "source_name",
        "source_author",
        "cover_image_alt",
        "media_caption",
        "media_credit",
        "seo_title",
        "seo_description",
    )
    @classmethod
    def trim_blog_optional_text(
        cls,
        value: str | None,
    ) -> str | None:
        return clean_optional_text(value)

    @field_validator(
        "cover_image_url",
        "external_url",
        "video_url",
    )
    @classmethod
    def validate_blog_url(
        cls,
        value: str | None,
        info,
    ) -> str | None:
        return validate_public_url_or_path(
            value,
            field_name=info.field_name,
        )

    @field_validator("tags")
    @classmethod
    def normalize_blog_tags(
        cls,
        value: list[str],
    ) -> list[str]:
        return BlogPostBase.normalize_tags(value)

    @model_validator(mode="after")
    def validate_blog_content_type(self):
        external_types = {
            "external_coverage",
            "external_article",
        }

        if (
            self.content_type in external_types
            and not self.external_url
        ):
            raise ValueError(
                "external_url is required for "
                "external coverage or external articles."
            )

        if (
            self.content_type
            in {
                "external_coverage",
                "external_article",
                "licensed_republication",
            }
            and not self.source_name
        ):
            raise ValueError(
                "source_name is required for "
                "externally sourced content."
            )

        if self.featured_media_type == "image":
            if not (
                self.cover_image_url
                or self.cover_image_asset_id
            ):
                raise ValueError(
                    "A cover image asset or external "
                    "image URL is required for image media."
                )

            if not self.cover_image_alt:
                raise ValueError(
                    "cover_image_alt is required "
                    "for image media."
                )

        if (
            self.featured_media_type == "video"
            and not self.video_url
        ):
            raise ValueError(
                "video_url is required "
                "for video media."
            )

        return self


class BlogDraftCreate(
    BlogDraftContent,
):
    pass


class BlogDraftUpdate(BaseModel):
    model_config = {
        "extra": "forbid",
    }

    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=220,
    )
    excerpt: str | None = Field(
        default=None,
        max_length=600,
    )
    body_markdown: str | None = Field(
        default=None,
        min_length=1,
        max_length=100_000,
    )

    category: str | None = Field(
        default=None,
        max_length=120,
    )
    tags: list[str] | None = Field(
        default=None,
        max_length=20,
    )
    author_name: str | None = Field(
        default=None,
        max_length=180,
    )

    content_type: BLOG_CONTENT_TYPE | None = None

    external_url: str | None = None
    source_name: str | None = Field(
        default=None,
        max_length=220,
    )
    source_author: str | None = Field(
        default=None,
        max_length=220,
    )
    source_published_at: datetime | None = None

    featured_media_type: BLOG_MEDIA_TYPE | None = None

    cover_image_url: str | None = None
    cover_image_asset_id: str | None = None
    cover_image_alt: str | None = Field(
        default=None,
        max_length=220,
    )
    video_url: str | None = None
    media_caption: str | None = None
    media_credit: str | None = Field(
        default=None,
        max_length=300,
    )

    is_featured: bool | None = None

    seo_title: str | None = Field(
        default=None,
        max_length=220,
    )
    seo_description: str | None = Field(
        default=None,
        max_length=320,
    )

    @field_validator(
        "title",
        "body_markdown",
    )
    @classmethod
    def trim_blog_required_update(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        normalized = value.strip()

        if not normalized:
            raise ValueError(
                "Value cannot be blank."
            )

        return normalized

    @field_validator(
        "excerpt",
        "category",
        "author_name",
        "source_name",
        "source_author",
        "cover_image_alt",
        "media_caption",
        "media_credit",
        "seo_title",
        "seo_description",
    )
    @classmethod
    def trim_blog_optional_update(
        cls,
        value: str | None,
    ) -> str | None:
        return clean_optional_text(value)

    @field_validator(
        "cover_image_url",
        "external_url",
        "video_url",
    )
    @classmethod
    def validate_blog_update_url(
        cls,
        value: str | None,
        info,
    ) -> str | None:
        return validate_public_url_or_path(
            value,
            field_name=info.field_name,
        )

    @field_validator("tags")
    @classmethod
    def normalize_blog_update_tags(
        cls,
        value: list[str] | None,
    ) -> list[str] | None:
        if value is None:
            return None

        return BlogPostBase.normalize_tags(value)


class BlogRevisionRead(
    BlogDraftContent,
):
    id: str
    blog_post_id: str
    version_number: int

    review_status: BLOG_REVIEW_STATUS
    submitted_at: datetime | None

    reviewed_by_user_id: str | None
    reviewed_at: datetime | None
    review_notes: str | None

    created_by_user_id: str | None
    updated_by_user_id: str | None

    is_current_publication: bool
    published_by_user_id: str | None
    published_at: datetime | None

    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True,
    }


class BlogWorkflowPostRead(BaseModel):
    id: str
    slug: str

    owner_user_id: str | None
    therapist_profile_id: str | None

    status: Literal[
        "draft",
        "published",
    ]
    published_at: datetime | None

    title: str
    author_name: str | None
    content_type: BLOG_CONTENT_TYPE

    created_at: datetime
    updated_at: datetime

    working_revision: (
        BlogRevisionRead | None
    ) = None

    current_publication: (
        BlogRevisionRead | None
    ) = None

    model_config = {
        "from_attributes": True,
    }


class BlogReviewRequest(BaseModel):
    model_config = {
        "extra": "forbid",
    }

    decision: BLOG_REVIEW_DECISION
    notes: str | None = Field(
        default=None,
        max_length=5000,
    )

    @field_validator("notes")
    @classmethod
    def trim_review_notes(
        cls,
        value: str | None,
    ) -> str | None:
        return clean_optional_text(value)


class BlogReviewEventRead(BaseModel):
    id: str
    blog_post_id: str
    revision_id: str | None
    actor_user_id: str | None
    action: str
    note: str | None
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }


class BlogAdminReviewRead(BaseModel):
    post: BlogWorkflowPostRead
    revision: BlogRevisionRead
    history: list[
        BlogReviewEventRead
    ] = Field(
        default_factory=list,
    )
