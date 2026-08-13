#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

EXTERNAL_APP_ENV="${APP_ENV:-}"
EXTERNAL_DEPLOYMENT_TARGET="${DEPLOYMENT_TARGET:-}"

if [ -f "backend/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "backend/.env"
  set +a
fi

APP_ENV_VALUE="${EXTERNAL_APP_ENV:-${APP_ENV:-development}}"
DEPLOYMENT_TARGET_VALUE="${EXTERNAL_DEPLOYMENT_TARGET:-${DEPLOYMENT_TARGET:-local}}"

if [ "$APP_ENV_VALUE" = "production" ] || [ "$DEPLOYMENT_TARGET_VALUE" = "production" ]; then
  echo "Refusing to reset database because this app is marked as production."
  echo "APP_ENV=$APP_ENV_VALUE"
  echo "DEPLOYMENT_TARGET=$DEPLOYMENT_TARGET_VALUE"
  exit 1
fi

if [ "${CONFIRM_LOCAL_DB_RESET:-}" != "1" ]; then
  echo "This command deletes the local Docker database volume."
  echo "It is intended for local development only."
  echo ""
  echo "To continue, run:"
  echo "  CONFIRM_LOCAL_DB_RESET=1 ./bin/reset-local-db.sh"
  exit 1
fi

echo "Stopping containers and deleting local Docker volumes..."
docker compose down -v

echo "Rebuilding and starting the local app..."
docker compose up --build
