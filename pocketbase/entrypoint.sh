#!/bin/sh
set -e

DATA_DIR="${PB_DATA_DIR:-/pb/pb_data}"
MIGRATIONS_DIR="${PB_MIGRATIONS_DIR:-/pb/pb_migrations}"

# Create or update the superuser from environment variables (idempotent).
# This also initializes the data directory and applies pending migrations.
if [ -n "$POCKETBASE_ADMIN_EMAIL" ] && [ -n "$POCKETBASE_ADMIN_PASSWORD" ]; then
    echo "Ensuring PocketBase superuser ($POCKETBASE_ADMIN_EMAIL) exists..."
    /pb/pocketbase superuser upsert "$POCKETBASE_ADMIN_EMAIL" "$POCKETBASE_ADMIN_PASSWORD" \
        --dir "$DATA_DIR" --migrationsDir "$MIGRATIONS_DIR" \
        || echo "WARNING: superuser upsert failed; check POCKETBASE_ADMIN_PASSWORD length (min 8)."
else
    echo "WARNING: POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD not set; skipping superuser bootstrap."
fi

echo "Starting PocketBase on :8090 ..."
exec /pb/pocketbase serve \
    --http=0.0.0.0:8090 \
    --dir "$DATA_DIR" \
    --migrationsDir "$MIGRATIONS_DIR"
