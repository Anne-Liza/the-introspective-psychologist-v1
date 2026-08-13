#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "" ]; then
  echo "Usage: scripts/restore-postgres.sh <backup-file.sql>"
  exit 1
fi

BACKUP_FILE="$1"
RESTORE_MODE="${RESTORE_MODE:-docker-compose}"
DB_SERVICE="${DB_SERVICE:-db}"
POSTGRES_USER="${POSTGRES_USER:-launchkit}"
POSTGRES_DB="${POSTGRES_DB:-launchkit}"
DATABASE_URL="${DATABASE_URL:-}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "Restoring PostgreSQL backup..."
echo "Mode: $RESTORE_MODE"
echo "Input: $BACKUP_FILE"
echo ""
echo "WARNING: this will apply the backup to the configured database."

if [ "${CONFIRM_RESTORE:-}" != "YES" ]; then
  echo "Refusing to restore without explicit confirmation."
  echo "Re-run with CONFIRM_RESTORE=YES when you are sure."
  exit 1
fi

if [ "$RESTORE_MODE" = "docker-compose" ]; then
  echo "Service: $DB_SERVICE"
  echo "Database: $POSTGRES_DB"

  docker compose exec -T "$DB_SERVICE" \
    psql \
    --set ON_ERROR_STOP=on \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    < "$BACKUP_FILE"

elif [ "$RESTORE_MODE" = "database-url" ]; then
  if [ -z "$DATABASE_URL" ]; then
    echo "DATABASE_URL is required when RESTORE_MODE=database-url"
    exit 1
  fi

  psql --set ON_ERROR_STOP=on "$DATABASE_URL" < "$BACKUP_FILE"

else
  echo "Unknown RESTORE_MODE: $RESTORE_MODE"
  echo "Use RESTORE_MODE=docker-compose or RESTORE_MODE=database-url"
  exit 1
fi

echo "Restore completed from: $BACKUP_FILE"
