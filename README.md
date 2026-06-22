# Simple Scraper

A Docker-packaged website scraper with an Angular UI, a local small LLM (via Ollama), and an optional cloud LLM for complex formatting.

## Features

- **Web UI** — paste URLs and output fields, configure scraping prompts, pick a local LLM, and run jobs with live progress + logs (SSE)
- **Spider** — crawls same-origin pages as a graph (BFS, up to 50 pages per site)
- **Scrape** — saves original HTML and extracted visible text to temp files per page
- **Local LLM** — Gemma 4, Qwen 3, or Qwen 2.5 (Ollama) for summarization and field Q&A
- **Cloud LLM** — OpenAI-compatible API for final JSON formatting (optional)
- **Settings** — gear icon opens a modal to configure environment variables at runtime
- **Workflow tab** — embedded [n8n](https://n8n.io) editor proxied at `/workflow/` for building automation workflows

## Quick Start (Docker)

```bash
cp .env.example .env
# Edit .env with your CLOUD_LLM_URL and CLOUD_LLM_API_KEY if needed

mkdir -p runtime/n8n runtime/n8n-files
# If n8n reports permission errors on first start (Linux/WSL):
# sudo chown -R 1000:1000 runtime/n8n runtime/n8n-files

docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). Use the **Scraper** and **Workflow** tabs to switch between the scrape form and the n8n workspace.

On first visit to the Workflow tab, n8n will prompt you to create an owner account.

### n8n workflow persistence

All n8n data is stored on the host via Docker bind mounts (survives `docker compose down` and container rebuilds):

| Host path | Container path | Contents |
|-----------|----------------|----------|
| `./runtime/n8n` | `/home/node/.n8n` | Workflows, credentials, SQLite database, encryption key |
| `./runtime/n8n-files` | `/files` | Files read/written by workflow nodes |

Verify persistence after creating a workflow:

```bash
docker compose restart n8n
ls -la runtime/n8n/database.sqlite   # appears after first workflow save
```

### Build error: `cgroup-parent for systemd cgroup should be a valid slice`

This happens when Docker Compose uses a broken Buildx builder (often a `docker-container` driver on WSL/systemd). Switch to the default builder:

```bash
docker buildx use default
docker compose up --build
```

If that doesn't help, remove stale builders: `docker buildx rm clever_knuth` (use the name from `docker buildx ls`), or reset Buildx state by moving `~/.docker/buildx/` aside.

### Models not appearing in `./runtime/models`

Ollama only uses `OLLAMA_MODELS` when the server starts. Models pulled before this was configured correctly are stored inside the container at `/root/.ollama/models` and are lost when the container is recreated. Rebuild and restart, then pull again:

```bash
docker compose up --build -d
docker compose exec simple-scraper ollama pull gemma4:e4b
ls -la runtime/models/blobs
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLOUD_LLM_URL` | *(empty)* | OpenAI-compatible API base URL |
| `CLOUD_LLM_API_KEY` | *(empty)* | API key for the cloud LLM |
| `LOCAL_LLM_MODEL` | `gemma4:e4b` | Default Ollama model tag |
| `OLLAMA_MODELS` | `./models` | Where Ollama stores downloaded models |
| `OUTPUT_FOLDER` | `./output` | Where scraped JSON results are written |

These can also be changed from the **Settings** modal in the UI (persisted to `/app/data/settings.json` inside the container).

## Local Development

Requires Node 20+ and a running [Ollama](https://ollama.com) instance.

```bash
npm run install:all

# Terminal 1 — API server
npm run dev:server

# Terminal 2 — Angular dev server (proxies /api to :3000)
npm run dev:client
```

Open [http://localhost:4200](http://localhost:4200).

Pull a local model before scraping:

```bash
ollama pull gemma4:e4b   # or qwen3:8b, qwen2.5:7b
```

## How It Works

### UI scrape job (via n8n)

When you click **Scrape**, the server triggers the n8n **Website Scraper** workflow and streams progress back to the UI:

1. Spider each URL (discover same-origin pages)
2. For each page: scrape text → summarize (local LLM)
3. For each field on each page: extract via Q&A (local LLM)
4. Aggregate, format, and save JSON to the output folder

### n8n workflow (orchestration engine)

The **Scrape** button triggers the n8n **Website Scraper** workflow via webhook. n8n orchestrates each step and reports progress back to the UI in real time.

On first Docker start, the `n8n-import` service automatically imports and activates the workflow from `n8n/workflows/website-scraper.workflow.json`.

**Re-import after workflow changes** (one-time):

```bash
rm runtime/n8n/.website-scraper-imported
docker compose run --rm n8n-import
docker compose restart n8n
```

## Project Structure

```
simple-scraper/
├── client/          Angular frontend
├── server/          Express + TypeScript API & scraper engine
├── n8n/workflows/   Importable n8n workflow templates
├── Dockerfile       Multi-stage build (Angular + Node + Ollama)
└── docker-compose.yml
```

## API Endpoints

### Scraper UI

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scrape/models` | List available local LLM options |
| GET | `/api/scrape/progress` | Current job progress |
| GET | `/api/scrape/progress/stream` | SSE live progress stream |
| POST | `/api/scrape/start` | Start a scrape job |
| POST | `/api/scrape/stop` | Stop the running job |
| POST | `/api/scrape/dismiss` | Clear progress panel |
| GET/PUT | `/api/settings` | Read/update settings |

### n8n workflow steps

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/workflow/spider` | `{ url }` → `{ url, pages[] }` |
| POST | `/api/workflow/scrape-page` | `{ url }` → `{ url, text, textLength }` |
| POST | `/api/workflow/summarize` | `{ text, summarizePrompt?, localLlmModel? }` → `{ summary }` |
| POST | `/api/workflow/extract-field` | `{ field, context, fieldPrompt?, directions? }` → field Q&A result |
| POST | `/api/workflow/save-result` | `{ startUrl, pageResults[] }` → `{ outputPath, document }` |
| POST | `/api/workflow/progress/:jobId/event` | Progress callbacks from n8n (`log`, `url_start`, `url_done`, `complete`, `error`) |
