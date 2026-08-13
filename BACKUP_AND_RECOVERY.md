# Backup and Recovery Guide

This app has two kinds of data that may need backup:

- PostgreSQL database data
- uploaded files and media

Back up both if the app uses uploads.

## 1. Backup Modes

This generated app includes portable PostgreSQL backup and restore scripts:

    scripts/backup-postgres.sh
    scripts/restore-postgres.sh

The scripts support two modes:

- `docker-compose`
- `database-url`

Use `docker-compose` mode for local Docker development.

Use `database-url` mode for non-Docker deployments such as Render, Railway, Fly, VPS servers, Neon, Supabase, or other managed PostgreSQL providers.

## 2. Local Docker Database Backup

From the generated app directory:

    scripts/backup-postgres.sh

By default, this uses:

    BACKUP_MODE=docker-compose
    DB_SERVICE=db
    POSTGRES_USER=launchkit
    POSTGRES_DB=launchkit

If your generated app uses a different database name or user, override them:

    POSTGRES_USER=your_user POSTGRES_DB=your_database scripts/backup-postgres.sh

Backups are written to:

    backups/

## 3. Local Docker Database Restore

Warning: restoring can overwrite existing data.

Restore requires explicit confirmation:

    CONFIRM_RESTORE=YES scripts/restore-postgres.sh backups/your-backup.sql

If your generated app uses a different database name or user, override them:

    POSTGRES_USER=your_user POSTGRES_DB=your_database CONFIRM_RESTORE=YES scripts/restore-postgres.sh backups/your-backup.sql

## 4. Non-Docker Database Backup

For production or non-Docker deployments, use `DATABASE_URL` mode:

    BACKUP_MODE=database-url DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE" scripts/backup-postgres.sh

If your app uses SQLAlchemy-style URLs such as:

    postgresql+psycopg://USER:PASSWORD@HOST:PORT/DATABASE

your database provider may require the plain PostgreSQL URL for command-line tools:

    postgresql://USER:PASSWORD@HOST:PORT/DATABASE

## 5. Non-Docker Database Restore

Warning: restoring can overwrite existing data.

Use a separate staging or recovery database first whenever possible.

    RESTORE_MODE=database-url DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE" CONFIRM_RESTORE=YES scripts/restore-postgres.sh backups/your-backup.sql

## 6. Production Database Backups

Production should use managed PostgreSQL, such as Supabase, Render, Railway, Neon, AWS RDS, or another PostgreSQL provider.

For production:

- enable automatic backups with your database provider
- confirm backup retention period
- confirm point-in-time recovery availability
- test restore before relying on the backup plan
- restrict who can delete or reset the database

Do not depend on local Docker backups for production recovery.

## 7. Supabase Backup Notes

If using Supabase:

- enable backups for the project plan you are using
- document the project reference ID
- store database credentials securely
- test recovery on a separate project before restoring over production
- confirm whether point-in-time recovery is available on your plan

Supabase may use `postgres` as the database name. That is normal.

## 8. Uploads and Media Backups

Database backups do not automatically back up uploaded files.

If `STORAGE_PROVIDER="local"`, uploaded files are stored in:

    LOCAL_UPLOAD_DIR="./uploads"

For production, local uploads may disappear after redeploys unless your host provides persistent disk storage.

For production uploads, prefer:

- persistent disk storage from your host
- S3-compatible object storage
- Supabase Storage
- Cloudflare R2
- another managed file storage provider

Back up uploaded files separately from the database.

## 9. Recovery Drill

Before launch, perform a recovery drill:

1. Create a backup.
2. Restore it into a separate test database.
3. Start the backend against the restored database.
4. Run a health check.
5. Confirm key records are present.
6. Confirm uploaded files are recoverable if uploads are enabled.

Minimum health check:

    curl http://localhost:8000/health

## 10. Destructive Commands

These commands can delete local data:

    docker compose down -v
    CONFIRM_LOCAL_DB_RESET=1 ./bin/reset-local-db.sh

Never run destructive commands against production.

Before deleting or restoring production data, confirm:

- a recent backup exists
- the backup can be restored
- the client or owner has approved the action
- the recovery steps are documented

## 11. Recovery Test Checklist

At least once before launch, test recovery:

- create a database backup
- restore it into a separate test database
- start the backend against the restored database
- confirm login works
- confirm dashboard data appears
- confirm public pages load
- confirm uploaded files are available
- document who performed the test and when

## 12. Minimum Production Backup Policy

Recommended minimum policy:

- daily automated database backups
- at least 7 days retention
- separate backup for uploaded files
- restricted database deletion permissions
- tested restore process before launch

## Managed Storage Adapter Boundary

The S3-compatible storage adapter is scaffolded only.

Do not set `STORAGE_PROVIDER` to `s3`, `cloudflare_r2`, `supabase`, or `minio` in production until the selected adapter has been implemented and tested.

Until then, use `STORAGE_PROVIDER="local"` only when the host has persistent disk enabled. Include uploaded files in recovery drills when local storage is used.
