#!/usr/bin/env bash
set -e

mkdir -p uploads

alembic upgrade head
python -m app.core.seed

uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
