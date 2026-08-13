#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups}"
BACKUP_MODE="${BACKUP_MODE:-docker-compose}"
DB_SERVICE="${DB_SERVICE:-db}"
POSTGRES_USER="${POSTGRES_USER:-launchkit}"
POSTGRES_DB="${POSTGRES_DB:-launchkit}"
DATABASE_URL="${DATABASE_URL:-}"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/${POSTGRES_DB}-${TIMESTAMP}.sql"

echo "Creating PostgreSQL backup..."
echo "Mode: $BACKUP_MODE"
echo "Output: $BACKUP_FILE"

if [ "$BACKUP_MODE" = "docker-compose" ]; then
  echo "Service: $DB_SERVICE"
  echo "Database: $POSTGRES_DB"

  docker compose exec -T "$DB_SERVICE" \
    pg_dump \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --clean \
    --if-exists \
    > "$BACKUP_FILE"

elif [ "$BACKUP_MODE" = "database-url" ]; then
  if [ -z "$DATABASE_URL" ]; then
    echo "DATABASE_URL is required when BACKUP_MODE=database-url"
    exit 1
  fi

  pg_dump \
    "$DATABASE_URL" \
    --clean \
    --if-exists \
    > "$BACKUP_FILE"

else
  echo "Unknown BACKUP_MODE: $BACKUP_MODE"
  echo "Use BACKUP_MODE=docker-compose or BACKUP_MODE=database-url"
  exit 1
fi

echo "Backup created: $BACKUP_FILE"
