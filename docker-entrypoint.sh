#!/bin/bash
set -e

# Ollama reads OLLAMA_MODELS and OLLAMA_KEEP_ALIVE when the server starts.
MODEL_DIR="${OLLAMA_MODELS:-/app/models}"
mkdir -p "$MODEL_DIR"
export OLLAMA_MODELS="$MODEL_DIR"
export OLLAMA_KEEP_ALIVE="${OLLAMA_KEEP_ALIVE:--1}"

echo "Ollama models directory: $OLLAMA_MODELS"
echo "Ollama keep-alive: $OLLAMA_KEEP_ALIVE"

# Start Ollama in the background
ollama serve &
OLLAMA_PID=$!

echo "Waiting for Ollama to start..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
    echo "Ollama is ready"
    break
  fi
  sleep 1
done

MODEL="${LOCAL_LLM_MODEL:-gemma4:e4b}"

echo "Ensuring default model ${MODEL} is available..."
ollama pull "$MODEL" || echo "Warning: could not pre-pull ${MODEL}. It will be pulled on first use."

echo "Preloading ${MODEL} into memory (keep_alive=${OLLAMA_KEEP_ALIVE})..."
if [[ "$OLLAMA_KEEP_ALIVE" =~ ^-?[0-9]+$ ]]; then
  KEEP_ALIVE_JSON="$OLLAMA_KEEP_ALIVE"
else
  KEEP_ALIVE_JSON="\"${OLLAMA_KEEP_ALIVE}\""
fi
curl -sf http://127.0.0.1:11434/api/generate \
  -H 'Content-Type: application/json' \
  -d "{\"model\":\"${MODEL}\",\"prompt\":\" \",\"stream\":false,\"keep_alive\":${KEEP_ALIVE_JSON},\"options\":{\"num_predict\":1}}" \
  > /dev/null || echo "Warning: could not preload ${MODEL} into memory."

# Start the Node server
exec node /app/server/dist/index.js
