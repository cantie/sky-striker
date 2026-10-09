#!/bin/sh
set -e

# Secrets may arrive as real env vars, or as a dotenv-style file rendered by e.g. Vault Agent.
# Point ENV_FILE at that file and it is loaded before the app starts (migrations need MYSQL_URL).
if [ -n "$ENV_FILE" ]; then
  if [ -f "$ENV_FILE" ]; then
    set -a
    . "$ENV_FILE"
    set +a
  else
    echo "ENV_FILE=$ENV_FILE not found" >&2
    exit 1
  fi
fi

# DB migrations run on boot (TypeORM migrationsRun), then the server listens on $PORT
exec node dist/main.js
