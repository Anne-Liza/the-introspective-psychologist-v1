import re
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from app.core.database import get_db
from app.core.time import utc_now
from app.modules.auth.dependencies import require_permission
from app.modules.blog.models import (
    BlogPost,
    BlogPostRevision,
    BlogReviewEvent,
)
from app.modules.blog.schemas import (
    BlogAdminReviewRead,
    BlogDraftContent,
    BlogDraftCreate,
    BlogDraftUpdate,
    BlogPostCreate,
    BlogPostRead,
    BlogPostUpdate,
    BlogReviewEventRead,
    BlogReviewRequest,
    BlogRevisionRead,
    BlogWorkflowPostRead,
)
from app.modules.files.models import (
    FILE_PURPOSE_BLOG_COVER_IMAGE,
    FILE_VISIBILITY_INTERNAL,
    FILE_VISIBILITY_PRIVATE,
    FILE_VISIBILITY_PUBLIC,
    FileAsset,
)
from app.modules.files.service import (
    list_file_usage,
    register_file_usage,
    set_file_visibility,
    unregister_file_usage,
)
from app.modules.blog.service import (
    REVIEW_APPROVED,
    REVIEW_CHANGES_REQUESTED,
    REVIEW_DRAFT,
    REVIEW_PENDING,
    REVIEW_REJECTED,
    REVISION_CONTENT_FIELDS,
    build_revision_from_post,
    publish_blog_revision,
    record_blog_event,
    review_blog_revision,
    submit_blog_revision,
)
from app.modules.therapist_profiles.models import (
    TherapistProfile,
)
from app.modules.users.models import User

router = APIRouter()


BLOG_COVER_USAGE_FIELD = "cover_image"
BLOG_REVISION_USAGE_TYPE = "blog_post_revision"
BLOG_USAGE_TYPE = "blog_post"


def _validated_blog_cover_asset(
    db: Session,
    *,
    asset_id: str | None,
    owner_user_id: str | None = None,
) -> FileAsset | None:
    if asset_id is None:
        return None

    asset = db.scalar(
        select(FileAsset).where(
            FileAsset.id == asset_id
        )
    )

    if asset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blog cover image asset not found.",
        )

    if (
        owner_user_id is not None
        and asset.owner_user_id
        != owner_user_id
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blog cover image asset not found.",
        )

    if (
        asset.purpose
        != FILE_PURPOSE_BLOG_COVER_IMAGE
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "The selected asset is not "
                "a blog cover image."
            ),
        )

    if not (
        asset.content_type
        and asset.content_type.startswith("image/")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "A blog cover image must be "
                "an image file."
            ),
        )

    if (
        asset.visibility
        == FILE_VISIBILITY_PRIVATE
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Private assets cannot be used "
                "as public blog cover images."
            ),
        )

    return asset


def _blog_cover_public_url(
    db: Session,
    *,
    post: BlogPost,
) -> str | None:
    asset_id = post.cover_image_asset_id

    if not asset_id:
        return post.cover_image_url

    asset = db.scalar(
        select(FileAsset).where(
            FileAsset.id == asset_id
        )
    )

    if (
        asset is None
        or asset.visibility
        != FILE_VISIBILITY_PUBLIC
        or asset.purpose
        != FILE_PURPOSE_BLOG_COVER_IMAGE
        or not asset.content_type
        or not asset.content_type.startswith(
            "image/"
        )
    ):
        return None

    return f"/files/public/{asset.id}"


def _public_blog_post_response(
    db: Session,
    post: BlogPost,
) -> BlogPostRead:
    response = BlogPostRead.model_validate(post)

    return response.model_copy(
        update={
            "cover_image_url": (
                _blog_cover_public_url(
                    db,
                    post=post,
                )
            )
        }
    )


def _demote_blog_cover_if_no_live_usage(
    db: Session,
    *,
    asset_id: str | None,
) -> None:
    if not asset_id:
        return

    usages = list_file_usage(
        db,
        file_id=asset_id,
    )

    if any(
        usage.entity_type == BLOG_USAGE_TYPE
        for usage in usages
    ):
        return

    asset = db.scalar(
        select(FileAsset).where(
            FileAsset.id == asset_id
        )
    )

    if (
        asset is not None
        and asset.purpose
        == FILE_PURPOSE_BLOG_COVER_IMAGE
        and asset.visibility
        == FILE_VISIBILITY_PUBLIC
    ):
        set_file_visibility(
            asset,
            visibility=FILE_VISIBILITY_INTERNAL,
        )


def _sync_blog_revision_asset_usage(
    db: Session,
    *,
    revision: BlogPostRevision,
    previous_asset_id: str | None,
) -> None:
    current_asset_id = getattr(
        revision,
        "cover_image_asset_id",
        None,
    )

    if (
        previous_asset_id
        and previous_asset_id
        != current_asset_id
    ):
        unregister_file_usage(
            db,
            file_id=previous_asset_id,
            entity_type=(
                BLOG_REVISION_USAGE_TYPE
            ),
            entity_id=revision.id,
            field_name=(
                BLOG_COVER_USAGE_FIELD
            ),
        )

    if current_asset_id:
        register_file_usage(
            db,
            file_id=current_asset_id,
            entity_type=(
                BLOG_REVISION_USAGE_TYPE
            ),
            entity_id=revision.id,
            field_name=(
                BLOG_COVER_USAGE_FIELD
            ),
        )


def _publish_blog_cover_asset_usage(
    db: Session,
    *,
    post: BlogPost,
    revision: BlogPostRevision,
    previous_asset_id: str | None,
) -> None:
    current_asset_id = getattr(
        revision,
        "cover_image_asset_id",
        None,
    )

    if previous_asset_id:
        unregister_file_usage(
            db,
            file_id=previous_asset_id,
            entity_type=BLOG_USAGE_TYPE,
            entity_id=post.id,
            field_name=BLOG_COVER_USAGE_FIELD,
        )

    if (
        previous_asset_id
        and previous_asset_id
        != current_asset_id
    ):
        _demote_blog_cover_if_no_live_usage(
            db,
            asset_id=previous_asset_id,
        )

    if current_asset_id:
        unregister_file_usage(
            db,
            file_id=current_asset_id,
            entity_type=(
                BLOG_REVISION_USAGE_TYPE
            ),
            entity_id=revision.id,
            field_name=BLOG_COVER_USAGE_FIELD,
        )

        register_file_usage(
            db,
            file_id=current_asset_id,
            entity_type=BLOG_USAGE_TYPE,
            entity_id=post.id,
            field_name=BLOG_COVER_USAGE_FIELD,
        )

        asset = _validated_blog_cover_asset(
            db,
            asset_id=current_asset_id,
        )

        if asset is not None:
            set_file_visibility(
                asset,
                visibility=FILE_VISIBILITY_PUBLIC,
            )


def commit_blog_post(db: Session, post: BlogPost) -> BlogPost:
    db.add(post)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A blog post with this slug already exists.",
        ) from exc
    db.refresh(post)
    return post


@router.get("/public", response_model=list[BlogPostRead])
def list_public_blog_posts(db: Session = Depends(get_db)):
    posts = db.scalars(
        select(BlogPost)
        .where(BlogPost.status == "published")
        .order_by(
            BlogPost.is_featured.desc(),
            BlogPost.published_at.desc().nullslast(),
            BlogPost.created_at.desc(),
        )
    ).all()

    return [
        _public_blog_post_response(
            db,
            post,
        )
        for post in posts
    ]


@router.get("/public/{slug}", response_model=BlogPostRead)
def get_public_blog_post(slug: str, db: Session = Depends(get_db)):
    post = db.scalar(
        select(BlogPost).where(
            BlogPost.slug == slug,
            BlogPost.status == "published",
        )
    )
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blog post not found.",
        )

    return _public_blog_post_response(
        db,
        post,
    )


@router.get("", response_model=list[BlogPostRead])
def list_blog_posts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("blog.read")),
):
    return db.scalars(
        select(BlogPost).order_by(BlogPost.updated_at.desc(), BlogPost.created_at.desc())
    ).all()


def _legacy_blog_mutation_removed() -> None:
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=(
            "This legacy blog mutation endpoint has been retired. "
            "Use the editorial publishing workflow instead."
        ),
    )


@router.post("", response_model=BlogPostRead, status_code=status.HTTP_201_CREATED)
def create_blog_post(
    payload: BlogPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("blog.create")),
):
    _legacy_blog_mutation_removed()


@router.patch("/{post_id}", response_model=BlogPostRead)
def update_blog_post(
    post_id: str,
    payload: BlogPostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("blog.update")),
):
    _legacy_blog_mutation_removed()


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_blog_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("blog.delete")),
):
    _legacy_blog_mutation_removed()


# ---------------------------------------------------------------------------
# Editorial workflow
# ---------------------------------------------------------------------------


def _slugify_blog_title(
    value: str,
) -> str:
    normalized = unicodedata.normalize(
        "NFKD",
        value,
    )
    ascii_value = (
        normalized
        .encode("ascii", "ignore")
        .decode("ascii")
    )

    slug = re.sub(
        r"[^a-z0-9]+",
        "-",
        ascii_value.lower(),
    ).strip("-")

    return slug[:160] or "article"


def _allocate_blog_slug(
    db: Session,
    *,
    title: str,
) -> str:
    base = _slugify_blog_title(title)
    candidate = base
    suffix = 2

    while (
        db.scalar(
            select(BlogPost.id).where(
                BlogPost.slug == candidate
            )
        )
        is not None
    ):
        suffix_text = f"-{suffix}"
        candidate = (
            f"{base[:160 - len(suffix_text)]}"
            f"{suffix_text}"
        )
        suffix += 1

    return candidate


def _current_therapist_profile(
    db: Session,
    current_user: User,
) -> TherapistProfile:
    profile = db.scalar(
        select(TherapistProfile).where(
            TherapistProfile.user_id
            == current_user.id
        )
    )

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No therapist profile is linked "
                "to this account."
            ),
        )

    return profile


def _latest_blog_revision(
    db: Session,
    *,
    post_id: str,
) -> BlogPostRevision | None:
    return db.scalar(
        select(BlogPostRevision)
        .where(
            BlogPostRevision.blog_post_id
            == post_id
        )
        .order_by(
            BlogPostRevision
            .version_number
            .desc()
        )
        .limit(1)
    )


def _current_blog_publication(
    db: Session,
    *,
    post_id: str,
) -> BlogPostRevision | None:
    return db.scalar(
        select(BlogPostRevision)
        .where(
            BlogPostRevision.blog_post_id
            == post_id,
            BlogPostRevision
            .is_current_publication
            .is_(True),
        )
        .order_by(
            BlogPostRevision
            .version_number
            .desc()
        )
        .limit(1)
    )


def _working_blog_revision(
    db: Session,
    *,
    post_id: str,
) -> BlogPostRevision | None:
    return db.scalar(
        select(BlogPostRevision)
        .where(
            BlogPostRevision.blog_post_id
            == post_id,
            BlogPostRevision
            .is_current_publication
            .is_(False),
        )
        .order_by(
            BlogPostRevision
            .version_number
            .desc()
        )
        .limit(1)
    )


def _current_blog_publications(
    db: Session,
    *,
    post_id: str,
) -> list[BlogPostRevision]:
    return list(
        db.scalars(
            select(BlogPostRevision)
            .where(
                BlogPostRevision.blog_post_id
                == post_id,
                BlogPostRevision
                .is_current_publication
                .is_(True),
            )
        ).all()
    )


def _blog_history(
    db: Session,
    *,
    post_id: str,
) -> list[BlogReviewEvent]:
    return list(
        db.scalars(
            select(BlogReviewEvent)
            .where(
                BlogReviewEvent.blog_post_id
                == post_id
            )
            .order_by(
                BlogReviewEvent.created_at,
                BlogReviewEvent.id,
            )
        ).all()
    )


def _workflow_post_response(
    db: Session,
    post: BlogPost,
) -> BlogWorkflowPostRead:
    working = _working_blog_revision(
        db,
        post_id=post.id,
    )
    current = _current_blog_publication(
        db,
        post_id=post.id,
    )

    display_revision = working or current

    return BlogWorkflowPostRead(
        id=post.id,
        slug=post.slug,
        owner_user_id=post.owner_user_id,
        therapist_profile_id=(
            post.therapist_profile_id
        ),
        status=post.status,
        published_at=post.published_at,
        title=(
            display_revision.title
            if display_revision is not None
            else post.title
        ),
        author_name=(
            display_revision.author_name
            if display_revision is not None
            else post.author_name
        ),
        content_type=(
            display_revision.content_type
            if display_revision is not None
            else post.content_type
        ),
        created_at=post.created_at,
        updated_at=post.updated_at,
        working_revision=(
            BlogRevisionRead
            .model_validate(working)
            if working is not None
            else None
        ),
        current_publication=(
            BlogRevisionRead
            .model_validate(current)
            if current is not None
            else None
        ),
    )


def _owned_blog_post(
    db: Session,
    *,
    post_id: str,
    current_user: User,
) -> BlogPost:
    post = db.scalar(
        select(BlogPost).where(
            BlogPost.id == post_id,
            BlogPost.owner_user_id
            == current_user.id,
        )
    )

    if post is None:
        # Deliberately return 404 rather than revealing
        # whether another provider owns this article.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found.",
        )

    return post


def _editable_owned_blog_revision(
    db: Session,
    *,
    post: BlogPost,
    current_user: User,
) -> BlogPostRevision:
    latest = _latest_blog_revision(
        db,
        post_id=post.id,
    )

    if latest is None:
        revision = build_revision_from_post(
            post,
            version_number=1,
            created_by_user_id=(
                current_user.id
            ),
        )
        db.add(revision)

        if getattr(
            revision,
            "cover_image_asset_id",
            None,
        ):
            db.flush()

            _sync_blog_revision_asset_usage(
                db,
                revision=revision,
                previous_asset_id=None,
            )

        return revision

    if latest.is_current_publication:
        revision = build_revision_from_post(
            post,
            version_number=(
                latest.version_number + 1
            ),
            created_by_user_id=(
                current_user.id
            ),
        )
        db.add(revision)

        if getattr(
            revision,
            "cover_image_asset_id",
            None,
        ):
            db.flush()

            _sync_blog_revision_asset_usage(
                db,
                revision=revision,
                previous_asset_id=None,
            )

        return revision

    if latest.review_status in {
        REVIEW_DRAFT,
        REVIEW_CHANGES_REQUESTED,
    }:
        return latest

    if (
        latest.review_status
        == REVIEW_PENDING
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This article is currently "
                "in review and cannot be edited."
            ),
        )

    if (
        latest.review_status
        == REVIEW_APPROVED
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This article is approved "
                "and awaiting publication."
            ),
        )

    if (
        latest.review_status
        == REVIEW_REJECTED
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This article was rejected. "
                "Its review record is final."
            ),
        )

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=(
            "This article cannot currently "
            "be edited."
        ),
    )


def _validate_revision_content(
    revision: BlogPostRevision,
) -> None:
    values = {
        field: getattr(revision, field)
        for field in REVISION_CONTENT_FIELDS
    }

    validated = (
        BlogDraftContent.model_validate(
            values
        )
    )

    for field, value in (
        validated
        .model_dump()
        .items()
    ):
        setattr(
            revision,
            field,
            value,
        )


def _admin_review_revision(
    db: Session,
    *,
    revision_id: str,
    require_pending: bool = False,
) -> BlogPostRevision:
    revision = db.scalar(
        select(BlogPostRevision).where(
            BlogPostRevision.id
            == revision_id
        )
    )

    if revision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Article revision not found."
            ),
        )

    if revision.is_current_publication:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "The current published revision "
                "is not part of the review queue."
            ),
        )

    if require_pending:
        if (
            revision.review_status
            != REVIEW_PENDING
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_409_CONFLICT
                ),
                detail=(
                    "Only pending-review "
                    "article revisions can "
                    "be reviewed."
                ),
            )
    elif revision.review_status not in {
        REVIEW_PENDING,
        REVIEW_CHANGES_REQUESTED,
        REVIEW_APPROVED,
        REVIEW_REJECTED,
    }:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This article revision has "
                "not entered the editorial "
                "review workflow."
            ),
        )

    return revision


def _admin_review_response(
    db: Session,
    revision: BlogPostRevision,
) -> BlogAdminReviewRead:
    post = db.scalar(
        select(BlogPost).where(
            BlogPost.id
            == revision.blog_post_id
        )
    )

    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found.",
        )

    return BlogAdminReviewRead(
        post=_workflow_post_response(
            db,
            post,
        ),
        revision=(
            BlogRevisionRead
            .model_validate(revision)
        ),
        history=[
            BlogReviewEventRead
            .model_validate(event)
            for event in _blog_history(
                db,
                post_id=post.id,
            )
        ],
    )


# ---------------------------------------------------------------------------
# Therapist: My Articles
# ---------------------------------------------------------------------------


@router.get(
    "/mine",
    response_model=list[
        BlogWorkflowPostRead
    ],
)
def list_my_blog_posts(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "blog.own.read"
        )
    ),
):
    posts = db.scalars(
        select(BlogPost)
        .where(
            BlogPost.owner_user_id
            == current_user.id
        )
        .order_by(
            BlogPost.updated_at.desc(),
            BlogPost.created_at.desc(),
        )
    ).all()

    return [
        _workflow_post_response(
            db,
            post,
        )
        for post in posts
    ]


@router.post(
    "/mine",
    response_model=BlogWorkflowPostRead,
    status_code=status.HTTP_201_CREATED,
)
def create_my_blog_post(
    payload: BlogDraftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "blog.own.create"
        )
    ),
):
    profile = _current_therapist_profile(
        db,
        current_user,
    )

    content = payload.model_dump()

    selected_asset_id = (
        content.get("cover_image_asset_id")
    )

    if selected_asset_id:
        _validated_blog_cover_asset(
            db,
            asset_id=selected_asset_id,
            owner_user_id=current_user.id,
        )

        content["cover_image_url"] = None

    # Provider authorship is derived from the
    # authenticated therapist profile rather
    # than trusted from browser input.
    content["author_name"] = (
        profile.full_name
    )

    # Featuring is an editorial/publication
    # decision controlled by the practice.
    content["is_featured"] = False

    post = BlogPost(
        slug=_allocate_blog_slug(
            db,
            title=content["title"],
        ),
        owner_user_id=current_user.id,
        therapist_profile_id=profile.id,
        created_by_user_id=(
            current_user.id
        ),
        status="draft",
        published_at=None,
        published_by_user_id=None,
        **content,
    )

    db.add(post)

    try:
        db.flush()

        revision = (
            build_revision_from_post(
                post,
                version_number=1,
                created_by_user_id=(
                    current_user.id
                ),
            )
        )
        db.add(revision)
        db.flush()

        _sync_blog_revision_asset_usage(
            db,
            revision=revision,
            previous_asset_id=None,
        )

        db.add(
            record_blog_event(
                post=post,
                revision=revision,
                actor_user_id=(
                    current_user.id
                ),
                action="created",
            )
        )

        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "The article could not be "
                "created because its public "
                "identity conflicts with an "
                "existing article."
            ),
        ) from exc

    db.refresh(post)

    return _workflow_post_response(
        db,
        post,
    )


@router.get(
    "/mine/{post_id}",
    response_model=BlogWorkflowPostRead,
)
def get_my_blog_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "blog.own.read"
        )
    ),
):
    post = _owned_blog_post(
        db,
        post_id=post_id,
        current_user=current_user,
    )

    return _workflow_post_response(
        db,
        post,
    )


@router.get(
    "/mine/{post_id}/history",
    response_model=list[
        BlogReviewEventRead
    ],
)
def get_my_blog_history(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "blog.own.read"
        )
    ),
):
    post = _owned_blog_post(
        db,
        post_id=post_id,
        current_user=current_user,
    )

    return [
        BlogReviewEventRead
        .model_validate(event)
        for event in _blog_history(
            db,
            post_id=post.id,
        )
    ]


@router.patch(
    "/mine/{post_id}",
    response_model=BlogWorkflowPostRead,
)
def update_my_blog_post(
    post_id: str,
    payload: BlogDraftUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "blog.own.update"
        )
    ),
):
    post = _owned_blog_post(
        db,
        post_id=post_id,
        current_user=current_user,
    )

    profile = _current_therapist_profile(
        db,
        current_user,
    )

    revision = (
        _editable_owned_blog_revision(
            db,
            post=post,
            current_user=current_user,
        )
    )

    values = payload.model_dump(
        exclude_unset=True,
    )

    previous_asset_id = (
        revision.cover_image_asset_id
    )

    if "cover_image_asset_id" in values:
        selected_asset_id = values[
            "cover_image_asset_id"
        ]

        if selected_asset_id:
            _validated_blog_cover_asset(
                db,
                asset_id=selected_asset_id,
                owner_user_id=(
                    current_user.id
                    if selected_asset_id
                    != previous_asset_id
                    else None
                ),
            )

            values[
                "cover_image_url"
            ] = None

        elif (
            "cover_image_url"
            not in values
        ):
            values[
                "cover_image_url"
            ] = None

    elif (
        "cover_image_url" in values
        and values["cover_image_url"]
    ):
        values[
            "cover_image_asset_id"
        ] = None

    # Authenticated therapist identity remains
    # the canonical byline in own workflows.
    values.pop(
        "author_name",
        None,
    )

    for key, value in values.items():
        setattr(
            revision,
            key,
            value,
        )

    revision.author_name = (
        profile.full_name
    )
    revision.is_featured = False
    revision.updated_by_user_id = (
        current_user.id
    )

    try:
        _validate_revision_content(
            revision
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail=str(exc),
        ) from exc

    db.add(revision)
    db.flush()

    _sync_blog_revision_asset_usage(
        db,
        revision=revision,
        previous_asset_id=previous_asset_id,
    )

    db.commit()
    db.refresh(post)
    db.refresh(revision)

    return _workflow_post_response(
        db,
        post,
    )


@router.post(
    "/mine/{post_id}/submit",
    response_model=BlogWorkflowPostRead,
)
def submit_my_blog_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "blog.own.submit"
        )
    ),
):
    post = _owned_blog_post(
        db,
        post_id=post_id,
        current_user=current_user,
    )

    revision = (
        _working_blog_revision(
            db,
            post_id=post.id,
        )
    )

    if revision is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "There is no working article "
                "draft to submit."
            ),
        )

    try:
        _validate_revision_content(
            revision
        )
        submit_blog_revision(
            revision
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    revision.updated_by_user_id = (
        current_user.id
    )

    db.add(revision)
    db.add(
        record_blog_event(
            post=post,
            revision=revision,
            actor_user_id=(
                current_user.id
            ),
            action="submitted",
        )
    )

    db.commit()
    db.refresh(post)

    return _workflow_post_response(
        db,
        post,
    )


# ---------------------------------------------------------------------------
# Practice Admin: editorial review
# ---------------------------------------------------------------------------


@router.get(
    "/review-queue",
    response_model=list[
        BlogAdminReviewRead
    ],
)
def list_blog_review_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "blog.review"
        )
    ),
):
    revisions = db.scalars(
        select(BlogPostRevision)
        .where(
            BlogPostRevision.review_status
            == REVIEW_PENDING,
            BlogPostRevision
            .is_current_publication
            .is_(False),
        )
        .order_by(
            BlogPostRevision
            .submitted_at
            .asc(),
            BlogPostRevision
            .created_at
            .asc(),
        )
    ).all()

    return [
        _admin_review_response(
            db,
            revision,
        )
        for revision in revisions
    ]


@router.get(
    "/revisions/{revision_id}",
    response_model=BlogAdminReviewRead,
)
def get_blog_revision_for_review(
    revision_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "blog.review"
        )
    ),
):
    revision = (
        _admin_review_revision(
            db,
            revision_id=revision_id,
        )
    )

    return _admin_review_response(
        db,
        revision,
    )


@router.post(
    "/revisions/{revision_id}/review",
    response_model=BlogAdminReviewRead,
)
def review_blog_post_revision(
    revision_id: str,
    payload: BlogReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "blog.review"
        )
    ),
):
    revision = (
        _admin_review_revision(
            db,
            revision_id=revision_id,
            require_pending=True,
        )
    )

    post = db.scalar(
        select(BlogPost).where(
            BlogPost.id
            == revision.blog_post_id
        )
    )

    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found.",
        )

    try:
        review_blog_revision(
            revision,
            decision=payload.decision,
            reviewer_user_id=(
                current_user.id
            ),
            notes=payload.notes,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=str(exc),
        ) from exc

    db.add(revision)
    db.add(
        record_blog_event(
            post=post,
            revision=revision,
            actor_user_id=(
                current_user.id
            ),
            action=payload.decision,
            note=payload.notes,
        )
    )

    db.commit()
    db.refresh(revision)

    return _admin_review_response(
        db,
        revision,
    )


# ---------------------------------------------------------------------------
# Practice Admin: publication
# ---------------------------------------------------------------------------


@router.get(
    "/publication-queue",
    response_model=list[
        BlogAdminReviewRead
    ],
)
def list_blog_publication_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "blog.publish"
        )
    ),
):
    newer_revision = aliased(
        BlogPostRevision
    )

    revisions = db.scalars(
        select(BlogPostRevision)
        .where(
            BlogPostRevision.review_status
            == REVIEW_APPROVED,
            BlogPostRevision
            .is_current_publication
            .is_(False),
            ~(
                select(
                    newer_revision.id
                )
                .where(
                    newer_revision.blog_post_id
                    == BlogPostRevision.blog_post_id,
                    newer_revision.version_number
                    > BlogPostRevision.version_number,
                )
                .exists()
            ),
        )
        .order_by(
            BlogPostRevision
            .reviewed_at
            .asc(),
            BlogPostRevision
            .created_at
            .asc(),
        )
    ).all()

    return [
        _admin_review_response(
            db,
            revision,
        )
        for revision in revisions
    ]


@router.post(
    "/revisions/{revision_id}/publish",
    response_model=BlogAdminReviewRead,
)
def publish_blog_post_revision(
    revision_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "blog.publish"
        )
    ),
):
    revision = db.scalar(
        select(BlogPostRevision).where(
            BlogPostRevision.id
            == revision_id
        )
    )

    if revision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Article revision not found."
            ),
        )

    post = db.scalar(
        select(BlogPost).where(
            BlogPost.id
            == revision.blog_post_id
        )
    )

    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found.",
        )

    if not revision.is_current_publication:
        latest_revision = (
            _latest_blog_revision(
                db,
                post_id=post.id,
            )
        )

        if (
            latest_revision is None
            or latest_revision.id
            != revision.id
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_409_CONFLICT
                ),
                detail=(
                    "Only the latest approved "
                    "article revision can be "
                    "published."
                ),
            )

    if revision.cover_image_asset_id:
        _validated_blog_cover_asset(
            db,
            asset_id=(
                revision.cover_image_asset_id
            ),
        )

    previous_asset_id = (
        post.cover_image_asset_id
    )

    previous_publications = (
        _current_blog_publications(
            db,
            post_id=post.id,
        )
    )

    try:
        publish_blog_revision(
            post,
            revision,
            publisher_user_id=(
                current_user.id
            ),
            previous_publications=(
                previous_publications
            ),
        )

        _publish_blog_cover_asset_usage(
            db,
            post=post,
            revision=revision,
            previous_asset_id=(
                previous_asset_id
            ),
        )

        db.add(
            record_blog_event(
                post=post,
                revision=revision,
                actor_user_id=(
                    current_user.id
                ),
                action="published",
            )
        )

        db.commit()
    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=str(exc),
        ) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "The approved article "
                "could not be published."
            ),
        ) from exc

    db.refresh(post)
    db.refresh(revision)

    return _admin_review_response(
        db,
        revision,
    )


# ---------------------------------------------------------------------------
# Practice Admin: article authoring
# ---------------------------------------------------------------------------


def _admin_blog_post(
    db: Session,
    *,
    post_id: str,
) -> BlogPost:
    post = db.scalar(
        select(BlogPost).where(
            BlogPost.id == post_id
        )
    )

    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found.",
        )

    return post


def _practice_authored_blog_post(
    db: Session,
    *,
    post_id: str,
) -> BlogPost:
    post = _admin_blog_post(
        db,
        post_id=post_id,
    )

    if post.therapist_profile_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Provider-authored articles should be "
                "reviewed through the editorial workflow "
                "rather than edited by an administrator."
            ),
        )

    return post


def _editable_admin_blog_revision(
    db: Session,
    *,
    post: BlogPost,
    current_user: User,
) -> BlogPostRevision:
    latest = _latest_blog_revision(
        db,
        post_id=post.id,
    )

    if latest is None:
        revision = build_revision_from_post(
            post,
            version_number=1,
            created_by_user_id=current_user.id,
        )
        db.add(revision)

        if getattr(
            revision,
            "cover_image_asset_id",
            None,
        ):
            db.flush()

            _sync_blog_revision_asset_usage(
                db,
                revision=revision,
                previous_asset_id=None,
            )

        return revision

    if latest.is_current_publication:
        revision = build_revision_from_post(
            post,
            version_number=(
                latest.version_number + 1
            ),
            created_by_user_id=current_user.id,
        )
        db.add(revision)

        if getattr(
            revision,
            "cover_image_asset_id",
            None,
        ):
            db.flush()

            _sync_blog_revision_asset_usage(
                db,
                revision=revision,
                previous_asset_id=None,
            )

        return revision

    if latest.review_status in {
        REVIEW_DRAFT,
        REVIEW_CHANGES_REQUESTED,
    }:
        return latest

    if latest.review_status == REVIEW_PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This article is currently in review "
                "and cannot be edited."
            ),
        )

    if latest.review_status == REVIEW_APPROVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This article is approved and awaiting "
                "publication."
            ),
        )

    if latest.review_status == REVIEW_REJECTED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This article was rejected. "
                "Its review record is final."
            ),
        )

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="This article cannot currently be edited.",
    )


@router.get(
    "/admin",
    response_model=list[BlogWorkflowPostRead],
)
def list_admin_blog_posts(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("blog.read")
    ),
):
    posts = db.scalars(
        select(BlogPost)
        .order_by(
            BlogPost.updated_at.desc(),
            BlogPost.created_at.desc(),
        )
    ).all()

    return [
        _workflow_post_response(
            db,
            post,
        )
        for post in posts
    ]


@router.post(
    "/admin",
    response_model=BlogWorkflowPostRead,
    status_code=status.HTTP_201_CREATED,
)
def create_admin_blog_post(
    payload: BlogDraftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("blog.create")
    ),
):
    content = payload.model_dump()

    selected_asset_id = (
        content.get("cover_image_asset_id")
    )

    if selected_asset_id:
        _validated_blog_cover_asset(
            db,
            asset_id=selected_asset_id,
        )

        content["cover_image_url"] = None

    if not content["author_name"]:
        content["author_name"] = (
            current_user.full_name
        )

    post = BlogPost(
        slug=_allocate_blog_slug(
            db,
            title=content["title"],
        ),
        owner_user_id=current_user.id,
        therapist_profile_id=None,
        created_by_user_id=current_user.id,
        status="draft",
        published_at=None,
        published_by_user_id=None,
        **content,
    )

    db.add(post)

    try:
        db.flush()

        revision = build_revision_from_post(
            post,
            version_number=1,
            created_by_user_id=current_user.id,
        )

        db.add(revision)
        db.flush()

        _sync_blog_revision_asset_usage(
            db,
            revision=revision,
            previous_asset_id=None,
        )

        db.add(
            record_blog_event(
                post=post,
                revision=revision,
                actor_user_id=current_user.id,
                action="created",
            )
        )

        db.commit()
    except IntegrityError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "The article could not be created "
                "because its public identity conflicts "
                "with an existing article."
            ),
        ) from exc

    db.refresh(post)

    return _workflow_post_response(
        db,
        post,
    )


@router.get(
    "/admin/{post_id}",
    response_model=BlogWorkflowPostRead,
)
def get_admin_blog_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("blog.read")
    ),
):
    post = _admin_blog_post(
        db,
        post_id=post_id,
    )

    return _workflow_post_response(
        db,
        post,
    )


@router.get(
    "/admin/{post_id}/history",
    response_model=list[BlogReviewEventRead],
)
def get_admin_blog_history(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("blog.read")
    ),
):
    post = _admin_blog_post(
        db,
        post_id=post_id,
    )

    return [
        BlogReviewEventRead.model_validate(event)
        for event in _blog_history(
            db,
            post_id=post.id,
        )
    ]


@router.patch(
    "/admin/{post_id}",
    response_model=BlogWorkflowPostRead,
)
def update_admin_blog_post(
    post_id: str,
    payload: BlogDraftUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("blog.update")
    ),
):
    post = _practice_authored_blog_post(
        db,
        post_id=post_id,
    )

    revision = _editable_admin_blog_revision(
        db,
        post=post,
        current_user=current_user,
    )

    values = payload.model_dump(
        exclude_unset=True,
    )

    previous_asset_id = (
        revision.cover_image_asset_id
    )

    if "cover_image_asset_id" in values:
        selected_asset_id = values[
            "cover_image_asset_id"
        ]

        if selected_asset_id:
            _validated_blog_cover_asset(
                db,
                asset_id=selected_asset_id,
            )

            values[
                "cover_image_url"
            ] = None

        elif (
            "cover_image_url"
            not in values
        ):
            values[
                "cover_image_url"
            ] = None

    elif (
        "cover_image_url" in values
        and values["cover_image_url"]
    ):
        values[
            "cover_image_asset_id"
        ] = None

    for key, value in values.items():
        setattr(
            revision,
            key,
            value,
        )

    revision.updated_by_user_id = (
        current_user.id
    )

    try:
        _validate_revision_content(
            revision
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail=str(exc),
        ) from exc

    post.updated_at = utc_now()

    db.add(post)
    db.add(revision)
    db.flush()

    _sync_blog_revision_asset_usage(
        db,
        revision=revision,
        previous_asset_id=previous_asset_id,
    )

    db.commit()

    db.refresh(post)
    db.refresh(revision)

    return _workflow_post_response(
        db,
        post,
    )


@router.post(
    "/admin/{post_id}/submit",
    response_model=BlogWorkflowPostRead,
)
def submit_admin_blog_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("blog.update")
    ),
):
    post = _practice_authored_blog_post(
        db,
        post_id=post_id,
    )

    revision = _working_blog_revision(
        db,
        post_id=post.id,
    )

    if revision is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "There is no working article draft "
                "to submit."
            ),
        )

    try:
        _validate_revision_content(
            revision
        )

        submit_blog_revision(
            revision
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    revision.updated_by_user_id = (
        current_user.id
    )
    post.updated_at = utc_now()

    db.add(post)
    db.add(revision)

    db.add(
        record_blog_event(
            post=post,
            revision=revision,
            actor_user_id=current_user.id,
            action="submitted",
        )
    )

    db.commit()
    db.refresh(post)

    return _workflow_post_response(
        db,
        post,
    )
