#!/usr/bin/env bash
# Start a throwaway local Postgres for development and end-to-end tests.
#
#   ./scripts/dev-db.sh start [dbname]   # start the server and create the database
#   ./scripts/dev-db.sh stop
#
# Prints the DATABASE_URL to use. Data lives in PGROOT and is disposable.
set -euo pipefail

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PGROOT="${PGROOT:-/var/lib/postgresql/devdb}"
PGPORT="${PGPORT:-5433}"
DBNAME="${2:-app}"

if [ ! -x "$PGBIN/initdb" ]; then
  echo "Postgres server binaries not found. Set PGBIN, or install postgresql." >&2
  exit 1
fi

case "${1:-start}" in
  start)
    if [ ! -d "$PGROOT/PG_VERSION" ] && [ ! -f "$PGROOT/PG_VERSION" ]; then
      mkdir -p "$PGROOT"
      chown postgres:postgres "$PGROOT"
      chmod 700 "$PGROOT"
      su postgres -c "$PGBIN/initdb -D $PGROOT -A trust -U postgres" >/dev/null
    fi
    if ! "$PGBIN/pg_isready" -h 127.0.0.1 -p "$PGPORT" >/dev/null 2>&1; then
      su postgres -c "$PGBIN/pg_ctl -D $PGROOT -o '-p $PGPORT -h 127.0.0.1' -l $PGROOT/server.log start" >/dev/null
    fi
    psql -h 127.0.0.1 -p "$PGPORT" -U postgres -tAc \
      "select 1 from pg_database where datname='$DBNAME'" | grep -q 1 ||
      psql -h 127.0.0.1 -p "$PGPORT" -U postgres -c "create database \"$DBNAME\";" >/dev/null
    echo "postgres://postgres@127.0.0.1:$PGPORT/$DBNAME"
    ;;
  stop)
    su postgres -c "$PGBIN/pg_ctl -D $PGROOT stop" >/dev/null 2>&1 || true
    echo "stopped"
    ;;
  *)
    echo "usage: $0 {start|stop} [dbname]" >&2
    exit 1
    ;;
esac
