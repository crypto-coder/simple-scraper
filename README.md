# Site Scraper

A Docker-packaged website scraper with an Angular UI, a local small LLM (via Ollama), and an optional cloud LLM for complex formatting.

## Features

- **Web UI** — paste URLs and output fields, configure scraping prompts, pick a local LLM, and run jobs with live progress + logs (SSE)
- **Spider** — crawls same-origin pages as a graph (BFS, up to 50 pages per site)
- **Scrape** — saves original HTML and extracted visible text to temp files per page
- **Local LLM** — Gemma 4, Qwen 3, or Qwen 2.5 (Ollama) for summarization and field Q&A
- **Cloud LLM** — OpenAI-compatible API for final JSON formatting (optional)
- **Settings** — gear icon opens a modal to configure environment variables at runtime

## Quick Start (Docker)

```bash
cp .env.example .env
# Edit .env with your CLOUD_LLM_URL and CLOUD_LLM_API_KEY if needed

docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000).

On first run, the container pulls the default local model (`gemma4:e4b`). This can take several minutes depending on your connection.

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
docker compose exec site-scraper ollama pull gemma4:e4b
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

For each URL (processed sequentially):

1. Spider all same-origin pages linked from the start URL
2. Save each page's HTML and extracted text to temp files
3. Summarize long text with the local LLM if needed
4. Ask the local LLM about each output field one-by-one
5. Format results into JSON (cloud LLM if configured, otherwise local fallback)
6. Write JSON to the output folder and stream progress/logs to the UI

## Project Structure

```
site_scraper/
├── client/          Angular frontend
├── server/          Express + TypeScript API & scraper engine
├── Dockerfile       Multi-stage build (Angular + Node + Ollama)
└── docker-compose.yml
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scrape/models` | List available local LLM options |
| GET | `/api/scrape/progress` | Current job progress |
| GET | `/api/scrape/progress/stream` | SSE live progress stream |
| POST | `/api/scrape/start` | Start a scrape job |
| POST | `/api/scrape/stop` | Stop the running job |
| POST | `/api/scrape/dismiss` | Clear progress panel |
| GET/PUT | `/api/settings` | Read/update settings |
