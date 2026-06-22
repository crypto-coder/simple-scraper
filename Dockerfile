# Build Angular client
FROM node:20-bookworm AS client-build
WORKDIR /build/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Build Node server
FROM node:20-bookworm AS server-build
WORKDIR /build/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npm run build && npm prune --omit=dev

# Production image with Ollama for local LLMs
FROM ollama/ollama:latest

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy Node.js runtime from official image (Ollama base lacks npm)
COPY --from=node:20-bookworm /usr/local/bin/node /usr/local/bin/node

WORKDIR /app

COPY --from=server-build /build/server/dist ./server/dist
COPY --from=server-build /build/server/node_modules ./server/node_modules
COPY --from=server-build /build/server/package.json ./server/package.json

COPY --from=client-build /build/client/dist/simple-scraper/browser ./server/public

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV PORT=3000
ENV LOCAL_LLM_MODEL=gemma4:e4b
ENV OUTPUT_FOLDER=/app/output
ENV OLLAMA_HOST=http://127.0.0.1:11434
ENV OLLAMA_MODELS=/app/models

VOLUME ["/app/models", "/app/output", "/app/data"]

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
