#!/bin/bash
# =============================================================================
# migrate.sh — применяет init.surql к работающему SurrealDB контейнеру.
# Запускать из корня проекта: bash db/migrate.sh
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE не найден"
  exit 1
fi

# Загружаем переменные из .env.local
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

SURREAL_USER="${SURREAL_USER:-admin}"
SURREAL_PASS="${SURREAL_PASS:-${SURREAL_PASSWORD:-}}"
SURREAL_NAMESPACE="${SURREAL_NAMESPACE:-bcsp}"
SURREAL_DATABASE="${SURREAL_DATABASE:-site}"

if [ -z "$SURREAL_PASS" ]; then
  echo "ERROR: SURREAL_PASS (или SURREAL_PASSWORD) не задан в .env.local"
  exit 1
fi

echo "Applying init.surql to SurrealDB (ns=$SURREAL_NAMESPACE, db=$SURREAL_DATABASE)..."

docker run --rm \
  --network it-eco_default \
  -v "$SCRIPT_DIR/init.surql:/init.surql:ro" \
  surrealdb/surrealdb:latest \
  import \
  --conn ws://surreal:8000 \
  --user "$SURREAL_USER" \
  --pass "$SURREAL_PASS" \
  --ns "$SURREAL_NAMESPACE" \
  --db "$SURREAL_DATABASE" \
  /init.surql

echo "Done!"
