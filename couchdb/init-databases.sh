#!/bin/sh
set -e

COUCH_HOST="${COUCHDB_HOST:-couchdb}"
COUCH_PORT="${COUCHDB_PORT:-5984}"
COUCH_USER="${COUCHDB_USER:-admin}"
COUCH_PASSWORD="${COUCHDB_PASSWORD:-password}"
BASE="http://${COUCH_HOST}:${COUCH_PORT}"
AUTH="${COUCH_USER}:${COUCH_PASSWORD}"

echo "Waiting for CouchDB at ${BASE}..."
until curl -sf "${BASE}/_up" >/dev/null 2>&1; do
  sleep 2
done

echo "Waiting for CouchDB admin auth..."
until curl -sf -u "${AUTH}" "${BASE}/_all_dbs" >/dev/null 2>&1; do
  sleep 2
done

CREATED_ANY=0

ensure_db() {
  db="$1"
  code="$(curl -s -o /dev/null -w '%{http_code}' -u "${AUTH}" -X PUT "${BASE}/${db}")"
  if [ "$code" = "201" ]; then
    echo "Database '${db}' created."
    CREATED_ANY=1
  elif [ "$code" = "412" ]; then
    echo "Database '${db}' already exists."
  else
    echo "ERROR: failed to create database '${db}' (HTTP ${code})" >&2
    exit 1
  fi
}

# System DBs first — auth cache listener requires _users at startup.
for db in _users _replicator projects executions; do
  ensure_db "$db"
done

if [ "$CREATED_ANY" = "1" ]; then
  echo "Restarting CouchDB so system listeners pick up new databases..."
  curl -sf -u "${AUTH}" -X POST "${BASE}/_restart" >/dev/null || true
  sleep 3
  until curl -sf "${BASE}/_up" >/dev/null 2>&1; do
    sleep 2
  done
  until curl -sf -u "${AUTH}" "${BASE}/_all_dbs" >/dev/null 2>&1; do
    sleep 2
  done
  echo "CouchDB restarted."
fi

echo "CouchDB databases initialized."
