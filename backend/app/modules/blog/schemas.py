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
        if self.cover_image_url and not self.cover_image_alt:
            raise ValueError("cover_image_alt is required when cover_image_url is set.")
        return self


class BlogPostCreate(BlogPostBase):
    pass


class BlogPostUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=220)
    slug: str | None = Field(default=None, min_length=1, max_length=180)
    excerpt: str | None = Field(default=None, max_length=600)
    body_markdown: str | None = Field(default=None, min_length=1, max_length=100_000)
    cover_image_url: str | None = None
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
