#!/bin/sh
set -e

MARKER="/home/node/.n8n/.website-scraper-imported"
WORKFLOW="/import/website-scraper.workflow.json"

mkdir -p /home/node/.n8n

if [ -f "$MARKER" ]; then
  echo "Website Scraper workflow already imported."
  exit 0
fi

if [ ! -f "$WORKFLOW" ]; then
  echo "ERROR: Workflow file not found at $WORKFLOW"
  exit 1
fi

echo "Importing Website Scraper workflow into n8n..."
n8n import:workflow --input="$WORKFLOW"
touch "$MARKER"
echo "Website Scraper workflow imported and ready."
