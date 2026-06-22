#!/bin/bash
set -e

# Ollama reads OLLAMA_MODELS when the server starts — set it before ollama serve.
MODEL_DIR="${OLLAMA_MODELS:-/app/models}"
mkdir -p "$MODEL_DIR"
export OLLAMA_MODELS="$MODEL_DIR"

echo "Ollama models directory: $OLLAMA_MODELS"

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

# Start the Node server
exec node /app/server/dist/index.js
