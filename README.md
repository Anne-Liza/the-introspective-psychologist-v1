# The Introspective Psychologist Production Proof

This is a standalone ejected client app generated from the app factory.

It is now an independent application with its own codebase, database, environment files, Docker setup, migrations, seed data, and deployment path.

## Profile

Profile: therapy_practice
App name: the-introspective-psychologist-production-proof

## Included Modules

- public_site
- landing_sections
- blog
- health
- auth
- users
- roles
- files
- email
- email_templates
- invitations
- app_settings
- contact_messages
- therapist_profiles
- services
- availability
- appointments
- client_records
- booking_engine
- commerce_core
- payment_requests
- cart_checkout
- payment_attempts
- mpesa_payments
- receipts
- fulfillment

## Local Setup

Environment files are generated automatically during ejection:

- `backend/.env`
- `backend/.env.example`
- `frontend/.env`
- `frontend/.env.example`

Do not copy `.env.example` over `.env` unless you intentionally want to reset local configuration.

Start the app:

    docker compose up --build

## Local Runtime URLs

This app receives its own local ports during generation. Check:

    LOCAL_RUNTIME.md

That file contains the correct frontend, backend, API docs, health check, PostgreSQL, and Mailpit ports for this specific generated app.

Important: Docker container logs may show internal container ports such as `5173` for Vite or `8000` for Uvicorn. Use `LOCAL_RUNTIME.md` for the browser and host-machine URLs.

## Default Login

Email: developer@example.com
Password: ChangeMe123!

Change this password before any real deployment or client handover.

## Database Lifecycle

This app uses PostgreSQL by default.

The generated app starts with one clean initial migration:

    backend/alembic/versions/0001_initial_schema.py

Run migrations manually:

    cd backend
    alembic upgrade head

Run seed data manually:

    cd backend
    python -m app.core.seed

In Docker local development, the backend startup runs migration, seed, then Uvicorn.

## Local Database Reset

For local development only, use the guarded reset script:

    CONFIRM_LOCAL_DB_RESET=1 ./bin/reset-local-db.sh

This deletes the local Docker database volume and recreates the database from migrations and seed data.

The script refuses to run when APP_ENV or DEPLOYMENT_TARGET is set to production.

Do not use destructive database resets in production.

## Useful Docker Commands

    docker compose ps
    docker compose logs backend
    docker compose logs frontend
    docker compose logs db
    docker compose exec db psql -U the_introspective_psychologist_production_proof -d the_introspective_psychologist_production_proof

Quick database checks:

    docker compose exec db psql -P pager=off -U the_introspective_psychologist_production_proof -d the_introspective_psychologist_production_proof -c "select count(*) from permissions;"
    docker compose exec db psql -P pager=off -U the_introspective_psychologist_production_proof -d the_introspective_psychologist_production_proof -c "select count(*) from projects;"

## Public Routes

- /
- /about
- /contact
- /projects
- /projects/:slug

## Security Notes

Before production deployment or client handover:

- rotate the default developer password
- set strong production JWT secrets
- configure production database credentials
- configure CORS for the production frontend domain
- configure file storage
- confirm contact form spam protection
- confirm file upload restrictions
- confirm backups are enabled
- confirm HTTPS is enabled

The generated local backend CORS origin is limited to this app's assigned frontend URL. The factory frontend URL is not whitelisted in the generated client app.

## Deployment Notes

See `DEPLOYMENT.md`.

## Handover Notes

See:

- `LOCAL_RUNTIME.md`
- `SECURITY_CHECKLIST.md`
- `BACKUP_AND_RECOVERY.md`
- `DEPLOYMENT.md`
