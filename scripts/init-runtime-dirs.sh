#!/bin/sh
# Creates bind-mounted runtime directories and fixes ownership for container uid 1000 (n8n).
# Runs as root via the runtime-init compose service before n8n-import and other services.
set -e

RUNTIME_UID="${RUNTIME_UID:-1000}"
RUNTIME_GID="${RUNTIME_GID:-1000}"
BASE="${RUNTIME_BASE:-/data}"

for sub in n8n n8n-files models output data; do
  dir="${BASE}/${sub}"
  mkdir -p "$dir"
  chown -R "${RUNTIME_UID}:${RUNTIME_GID}" "$dir"
  chmod -R u+rwX,g+rwX "$dir"
  echo "  ${dir} -> ${RUNTIME_UID}:${RUNTIME_GID}"
done

echo "Runtime directories ready under ${BASE} (uid ${RUNTIME_UID})"
