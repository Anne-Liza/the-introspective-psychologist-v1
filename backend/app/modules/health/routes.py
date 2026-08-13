from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db

router = APIRouter()


@router.get("/health")
def health():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "version": settings.APP_VERSION,
    }


@router.get("/health/deep")
def deep_health(db: Session = Depends(get_db)):
    database_status = "unknown"
    try:
        db.execute(text("SELECT 1"))
        database_status = "connected"
    except Exception:
        database_status = "unavailable"

    return {
        "status": "ok" if database_status == "connected" else "degraded",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "version": settings.APP_VERSION,
        "database": database_status,
        "storage_provider": settings.STORAGE_PROVIDER,
        "email_provider": settings.EMAIL_PROVIDER,
        "sentry": "configured" if settings.SENTRY_DSN else "not_configured",
    }
