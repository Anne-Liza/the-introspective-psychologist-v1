from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.time import utc_now
from app.modules.auth.dependencies import require_permission
from app.modules.blog.models import BlogPost
from app.modules.blog.schemas import BlogPostCreate, BlogPostRead, BlogPostUpdate
from app.modules.users.models import User

router = APIRouter()


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
    return db.scalars(
        select(BlogPost)
        .where(BlogPost.status == "published")
        .order_by(
            BlogPost.is_featured.desc(),
            BlogPost.published_at.desc().nullslast(),
            BlogPost.created_at.desc(),
        )
    ).all()


@router.get("/public/{slug}", response_model=BlogPostRead)
def get_public_blog_post(slug: str, db: Session = Depends(get_db)):
    post = db.scalar(
        select(BlogPost).where(
            BlogPost.slug == slug,
            BlogPost.status == "published",
        )
    )
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blog post not found.")
    return post


@router.get("", response_model=list[BlogPostRead])
def list_blog_posts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("blog.read")),
):
    return db.scalars(
        select(BlogPost).order_by(BlogPost.updated_at.desc(), BlogPost.created_at.desc())
    ).all()


@router.post("", response_model=BlogPostRead, status_code=status.HTTP_201_CREATED)
def create_blog_post(
    payload: BlogPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("blog.create")),
):
    values = payload.model_dump()
    if values["status"] == "published":
        values["published_at"] = utc_now()
    return commit_blog_post(db, BlogPost(**values))


@router.patch("/{post_id}", response_model=BlogPostRead)
def update_blog_post(
    post_id: str,
    payload: BlogPostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("blog.update")),
):
    post = db.get(BlogPost, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blog post not found.")

    values = payload.model_dump(exclude_unset=True)
    for key, value in values.items():
        setattr(post, key, value)

    if values.get("status") == "published" and post.published_at is None:
        post.published_at = utc_now()

    if post.cover_image_url and not post.cover_image_alt:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cover image alt text is required when a cover image is set.",
        )

    return commit_blog_post(db, post)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_blog_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("blog.delete")),
):
    post = db.get(BlogPost, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blog post not found.")
    db.delete(post)
    db.commit()
    return None
