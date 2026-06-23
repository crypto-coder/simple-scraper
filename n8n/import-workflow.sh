#!/bin/sh
set -e

MARKER="/home/node/.n8n/.website-scraper-imported-v9"
WORKFLOW="/import/website-scraper.workflow.json"
WORKFLOW_ID="a1b2c3d4-0100-4000-8000-000000000100"

mkdir -p /home/node/.n8n

if ! touch /home/node/.n8n/.write-test 2>/dev/null; then
  echo "ERROR: Cannot write to /home/node/.n8n (host path ./runtime/n8n)."
  echo "Run: docker compose run --rm runtime-init"
  echo "Then: docker compose up --build"
  exit 1
fi
rm -f /home/node/.n8n/.write-test

if [ -f "$MARKER" ]; then
  echo "Website Scraper workflow already imported."
  exit 0
fi

if [ ! -f "$WORKFLOW" ]; then
  echo "ERROR: Workflow file not found at $WORKFLOW"
  exit 1
fi

import_workflow() {
  # Import inactive; active:true in JSON breaks recent n8n versions during upsert.
  n8n import:workflow --input="$WORKFLOW"
  n8n publish:workflow --id="$WORKFLOW_ID"
}

echo "Importing Website Scraper workflow into n8n..."
if ! import_workflow; then
  echo "Import failed (often a stale/corrupt n8n database). Resetting and retrying..."
  rm -f /home/node/.n8n/database.sqlite /home/node/.n8n/database.sqlite-shm /home/node/.n8n/database.sqlite-wal
  import_workflow
fi

touch "$MARKER"
echo "Website Scraper workflow imported and ready."
