#!/bin/sh
set -e

COUCH_HOST="${COUCHDB_HOST:-couchdb}"
COUCH_PORT="${COUCHDB_PORT:-5984}"
COUCH_USER="${COUCHDB_USER:-admin}"
COUCH_PASSWORD="${COUCHDB_PASSWORD:-password}"
BASE="http://${COUCH_HOST}:${COUCH_PORT}"

echo "Waiting for CouchDB at ${BASE}..."
until curl -sf "${BASE}/_up" >/dev/null 2>&1; do
  sleep 2
done

echo "Waiting for CouchDB admin auth..."
until curl -sf -u "${COUCH_USER}:${COUCH_PASSWORD}" "${BASE}/_all_dbs" >/dev/null 2>&1; do
  sleep 2
done

for db in projects executions; do
  code="$(curl -s -o /dev/null -w '%{http_code}' -u "${COUCH_USER}:${COUCH_PASSWORD}" -X PUT "${BASE}/${db}")"
  if [ "$code" = "201" ] || [ "$code" = "412" ]; then
    echo "Database '${db}' ready (${code})."
  else
    echo "ERROR: failed to create database '${db}' (HTTP ${code})" >&2
    exit 1
  fi
done

echo "CouchDB databases initialized."
