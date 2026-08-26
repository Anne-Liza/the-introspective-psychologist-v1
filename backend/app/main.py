import asyncio
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.error_handlers import register_exception_handlers
from app.core.rate_limit import add_global_rate_limit
from app.core.request_context import add_request_id
from app.core.request_logging import add_request_logging
from app.core.security_headers import add_security_headers
from app.workers.mpesa_reconciliation import (
    mpesa_reconciliation_loop,
)


if settings.SENTRY_DSN.strip():
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.APP_ENV,
        release=settings.APP_VERSION,
        send_default_pii=False,
        traces_sample_rate=0.0,
    )
    sentry_sdk.capture_message(
        "Production Sentry verification",
        level="error",
    )

@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_production_security()

    reconciliation_task = None

    if settings.MPESA_RECONCILIATION_ENABLED:
        reconciliation_task = asyncio.create_task(
            mpesa_reconciliation_loop()
        )

    try:
        yield
    finally:
        if reconciliation_task is not None:
            reconciliation_task.cancel()

            try:
                await reconciliation_task
            except asyncio.CancelledError:
                pass


docs_url = "/docs" if settings.API_DOCS_ENABLED and not settings.is_production else None
redoc_url = "/redoc" if settings.API_DOCS_ENABLED and not settings.is_production else None
openapi_url = "/openapi.json" if settings.API_DOCS_ENABLED and not settings.is_production else None

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=f"{settings.APP_NAME} API",
    lifespan=lifespan,
    docs_url=docs_url,
    redoc_url=redoc_url,
    openapi_url=openapi_url,
)

app.middleware("http")(add_request_id)
app.middleware("http")(add_request_logging)
app.middleware("http")(add_security_headers)
app.middleware("http")(add_global_rate_limit)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

register_exception_handlers(app)


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
    }
