# Deployment Guide

This app can run locally with Docker, but production should use managed services.

Recommended production stack:

- Database: Supabase Postgres or another managed PostgreSQL provider
- Backend: Render Web Service
- Frontend: Netlify

## Self-Hosted Production with Docker Compose

The generated app also includes `docker-compose.prod.yml` for a self-hosted
single-server deployment.

Prepare the backend production environment:

    cp backend/.env.production.example backend/.env.production

Replace every placeholder in `backend/.env.production`, especially authentication
secrets, the encryption key, administrator credentials, CORS origins, email
credentials, and payment credentials.

Set the production Compose variables:

    export POSTGRES_PASSWORD="replace-with-a-strong-database-password"
    export VITE_API_BASE_URL="https://api.yourdomain.com/api"
    export VITE_SITE_URL="https://yourdomain.com"

Then build and start:

    docker compose -f docker-compose.prod.yml up -d --build

The production Compose configuration:

- uses production Dockerfiles
- keeps PostgreSQL private to the Compose network
- persists PostgreSQL data in a named volume
- persists uploaded files in a separate named volume
- waits for PostgreSQL before starting the backend
- waits for the backend before starting the frontend
- checks backend and frontend health
- excludes the local Mailpit email service

Place the deployment behind HTTPS and include uploaded-file storage in the
backup and recovery plan.

## 1. Local vs Production Database

Local Docker uses generated development credentials.

Example local DATABASE_URL:

    DATABASE_URL="postgresql+psycopg://app_name:app_name@db:5432/app_name"

This is only for local Docker development.

In production, replace DATABASE_URL with the connection string from Supabase, Render, Railway, Neon, or your managed PostgreSQL provider.

Do not use the local Docker database credentials in production.

Supabase often uses `postgres` as the database name. That is normal. The local Docker database name does not need to match the Supabase database name.

## 2. Production Environment Checklist

Before deploying, confirm:

- DATABASE_URL uses a real production PostgreSQL database.
- JWT_SECRET_KEY has been replaced with a strong random secret.
- JWT_REFRESH_SECRET_KEY has been replaced with a different strong random secret.
- SUPER_DEVELOPER_EMAIL is set to the real admin email.
- SUPER_DEVELOPER_PASSWORD is changed before handoff.
- BACKEND_CORS_ORIGINS contains the exact frontend production URL.
- FRONTEND_BASE_URL contains the exact frontend production URL.
- STORAGE_PROVIDER is set intentionally.
- EMAIL_PROVIDER is set intentionally.
- Local-only values such as localhost, mailpit, and default passwords are not used in production.

Generate secrets with:

    python -c "import secrets; print(secrets.token_urlsafe(64))"

Generate a separate value for each JWT secret.

## 3. Supabase Database

Create a Supabase project.

Use the Supabase connection string as DATABASE_URL.

If Supabase gives you a URL like:

    postgresql://...

convert it to:

    postgresql+psycopg://...

Example:

    DATABASE_URL="postgresql+psycopg://USER:PASSWORD@HOST:PORT/DATABASE"

If using the Supabase transaction pooler with psycopg, prepared statements may need to be disabled in SQLAlchemy:

    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        connect_args={"prepare_threshold": None},
    )

## 4. Backend Deployment on Render

Render settings:

- Language: Python 3
- Root Directory: backend
- Build Command: python -m pip install --upgrade pip && pip install -r requirements.txt
- Start Command: ./start.sh

Required Render environment variables:

    APP_ENV="production"
    DEPLOYMENT_TARGET="production"
    DATABASE_URL="postgresql+psycopg://..."
    JWT_SECRET_KEY="replace-with-strong-secret"
    JWT_REFRESH_SECRET_KEY="replace-with-different-strong-secret"
    SUPER_DEVELOPER_EMAIL="admin@example.com"
    SUPER_DEVELOPER_PASSWORD="replace-before-handoff"
    SUPER_DEVELOPER_FULL_NAME="Site Administrator"
    BACKEND_CORS_ORIGINS="https://your-frontend-domain.com"
    FRONTEND_BASE_URL="https://your-frontend-domain.com"
    EMAIL_PROVIDER="console"
    EMAIL_FROM="noreply@example.com"
    STORAGE_PROVIDER="local"
    PYTHON_VERSION="3.12.0"

Backend health checks:

    https://your-backend-domain.com/health
    https://your-backend-domain.com/docs

## 5. Database Migrations

Run migrations before serving production traffic.

The generated backend start script should run:

    alembic upgrade head

If running manually from the backend directory:

    alembic upgrade head

Do not reset or delete a production database unless you have a tested backup and a confirmed recovery plan.

## 6. Frontend Deployment on Netlify

Netlify settings:

- Base directory: frontend
- Build command: npm run build
- Publish directory: frontend/dist

Required Netlify environment variables:

    VITE_API_BASE_URL="https://your-backend-domain.com"
    VITE_SITE_URL="https://your-frontend-domain.com"
    VITE_SITE_NAME="Your Site Name"
    VITE_DEFAULT_SEO_TITLE="Your Site Name | Professional Website"
    VITE_DEFAULT_SEO_DESCRIPTION="A short description of the website."
    VITE_DEFAULT_OG_IMAGE="/og-image.png"

After changing frontend environment variables, redeploy the frontend.

## 7. CORS

The backend only accepts browser requests from domains listed in BACKEND_CORS_ORIGINS.

Example:

    BACKEND_CORS_ORIGINS="https://your-frontend-domain.com"

For multiple origins:

    BACKEND_CORS_ORIGINS="https://your-frontend-domain.com,https://preview-domain.netlify.app"

Do not use `*` in production.

## 8. Upload Storage

Local development uses:

    STORAGE_PROVIDER="local"
    LOCAL_UPLOAD_DIR="./uploads"

For production, local storage may disappear on some hosting platforms after redeploys.

Before using uploads in production, choose one:

- persistent disk storage from your host
- S3-compatible object storage
- Supabase Storage
- Cloudflare R2
- another managed file storage provider

If using local storage on Render, confirm whether your service has persistent disk enabled.

## 9. Email

For local development, Mailpit is used.

For production, configure a real email provider before relying on password reset, notifications, or contact workflows.

Example SMTP values:

    EMAIL_PROVIDER="smtp"
    SMTP_HOST="smtp.example.com"
    SMTP_PORT=587
    SMTP_USERNAME="username"
    SMTP_PASSWORD="password"
    SMTP_USE_TLS=true
    EMAIL_FROM="noreply@example.com"

## 10. Post-Deploy Smoke Test

After deployment, test:

- Frontend loads.
- Backend `/health` returns `ok`.
- Backend `/docs` loads.
- Login works with the super developer account.
- Default password is changed.
- Dashboard loads.
- Public projects load.
- Contact form submits.
- Contact messages appear in the dashboard.
- File upload behavior is confirmed.
- CORS errors do not appear in browser DevTools.

## 11. Common Errors

### CORS error

Check that BACKEND_CORS_ORIGINS contains the exact frontend domain.

Then redeploy the backend.

### Login works with curl but fails in browser

Usually this means one of these is wrong:

- BACKEND_CORS_ORIGINS
- VITE_API_BASE_URL
- frontend environment variables after deployment

Check browser DevTools, then Network, then the login request URL.

### Supabase duplicate prepared statement error

Use:

    connect_args={"prepare_threshold": None}

### Backend cannot connect to database

Check:

- DATABASE_URL
- database host
- database password
- database SSL requirements
- whether the database allows external connections

### Uploads disappear after deployment

Local filesystem uploads are not always persistent on hosted platforms.

Use persistent disk or object storage for production uploads.

## Managed Storage Adapter Boundary

The S3-compatible storage adapter is scaffolded only.

Do not set `STORAGE_PROVIDER` to `s3`, `cloudflare_r2`, `supabase`, or `minio` in production until the selected adapter has been implemented and tested.

Until then, use `STORAGE_PROVIDER="local"` only when the host has persistent disk enabled. For Render, confirm persistent disk configuration before relying on local uploads.
