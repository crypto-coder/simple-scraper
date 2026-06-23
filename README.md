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
# Edit .env for CLOUD_LLM_* if needed. n8n owner defaults are in config/n8n.env.

docker compose up --build
```

The **`runtime-init`** service runs first on every `docker compose up`. It executes `scripts/init-runtime-dirs.sh`, which creates `./runtime/{n8n,n8n-files,models,output,data}` and assigns ownership to uid **1000** (required by n8n). No manual `mkdir` or `chown` is needed on a new machine.

To run the init step alone:

```bash
docker compose run --rm runtime-init
```

If you still see `EACCES` under `./runtime/n8n` (e.g. after copying data from another host as root):

```bash
docker compose run --rm runtime-init
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). Use the **Scraper**, **Workflow**, and **Database** tabs to switch between the scrape form, the n8n workspace, and CouchDB (Fauxton).

The **Workflow** tab signs in automatically using the n8n owner account from `config/n8n.env`. No manual setup or login is required after the first stack start.

To change the default n8n owner password, edit `config/n8n.env` and regenerate the bcrypt hash:

```bash
node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"
```

Update both `N8N_OWNER_PASSWORD` and `N8N_INSTANCE_OWNER_PASSWORD_HASH` in that file. In the hash line, escape every `$` as `$$` (e.g. `$2b$10$...` becomes `$$2b$$10$$...`) so Docker Compose does not strip the value.

If the browser console shows `A listener indicated an asynchronous response...`, that message comes from a **browser extension** (password managers, VPN, ad blockers), not from this app. Try an incognito window with extensions disabled to confirm. The iframe is also kept alive across tab switches so extensions are not re-triggered on every visit.

When opening the app from another machine by IP (not `localhost`), set `PUBLIC_BASE_URL` in `.env` to the URL you use in the browser, for example `http://10.32.1.124:3000`. This keeps n8n editor and webhook links consistent. Console warnings about Cross-Origin-Opener-Policy or WebAuthn on plain HTTP are expected in that setup and do not block workflow execution.

If running a workflow in the n8n editor shows **Lost connection to the server** or repeating **Origin header does NOT match** errors in the n8n logs, rebuild after pulling the latest code — the proxy must forward the browser `Host` to n8n on WebSocket upgrades (not the internal `n8n:5678` hostname).

If the embedded n8n editor returns **408 Request Timeout** when saving, rebuild `simple-scraper` after pulling the latest code (the proxy must stream responses, not buffer them). On a slow or unreliable USB disk, prefer editing `n8n/workflows/website-scraper.workflow.json` in the repo and re-importing:

```bash
rm -f runtime/n8n/.website-scraper-imported-v8
docker compose run --rm n8n-import
docker compose restart n8n
```

If you previously started n8n and saw the owner setup wizard, reset n8n data once so the env-provisioned owner can be applied:

```bash
docker compose down
rm -f runtime/n8n/.website-scraper-imported runtime/n8n/database.sqlite*
docker compose up --build
```

### n8n workflow persistence

All n8n data is stored on the host via Docker bind mounts (survives `docker compose down` and container rebuilds):

| Host path | Container path | Contents |
|-----------|----------------|----------|
| `./runtime/n8n` | `/home/node/.n8n` | Workflows, credentials, SQLite database, encryption key |
| `./runtime/n8n-files` | `/files` | Files read/written by workflow nodes |

### CouchDB persistence

CouchDB (with Fauxton UI) stores data on the host at `./runtime/couchdb`. The **Database** tab signs in automatically and opens Fauxton in an iframe.

Default credentials are in `config/couchdb.env`:

- User: `admin`
- Password: `password`

On first stack start, `couchdb-init` ensures CouchDB system databases (`_users`, `_replicator`) and app databases exist:

| Database | Document `_id` | Purpose |
|----------|----------------|---------|
| `projects` | `project_id` (UUID) | Saved scrape project configs |
| `executions` | `execution_id` (UUID) | Run history with extracted results |
| `scrapes` | `scrape_id` (UUID) | Per-page scrape and summary text |

Example document:

```json
{
  "_id": "my-project-001",
  "name": "Example site scrape",
  "created_at": "2026-01-15T12:00:00Z"
}
```

Use `_id` as the primary key (`project_id` or `execution_id` value).

Verify persistence:

```bash
docker compose restart couchdb
curl -u admin:password http://localhost:3000/database/_all_dbs
```

If CouchDB logs `_users database does not exist` or the **Database** tab shows `database_does_not_exist` errors, re-run init (creates missing system/app DBs and restarts CouchDB if needed):

```bash
docker compose run --rm couchdb-init
docker compose restart simple-scraper
```

If errors persist on an existing volume, reset CouchDB data and start fresh:

```bash
docker compose down
rm -rf runtime/couchdb
docker compose up -d
```

Verify n8n persistence after creating a workflow:

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
| `OLLAMA_KEEP_ALIVE` | `-1` | How long Ollama keeps models loaded in memory (`-1` = indefinitely) |
| `OUTPUT_FOLDER` | `./output` | Where scraped JSON results are written |

n8n owner credentials (`N8N_OWNER_*`, `N8N_INSTANCE_OWNER_*`) are in **`config/n8n.env`**, not `.env`.

CouchDB credentials (`COUCHDB_USER`, `COUCHDB_PASSWORD`) are in **`config/couchdb.env`**.

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
2. For **each page**: scrape visible text → summarize with local LLM
3. For **each page summary**: Q&A field extraction per requested field (kept separate per page)
4. Collect findings (field + value + page URL) and save final JSON (`NOT FOUND` when a field is missing everywhere)

### n8n workflow (orchestration engine)

The **Scrape** button triggers the n8n **Website Scraper** workflow via webhook. n8n orchestrates each step and reports progress back to the UI in real time.

On first Docker start, the `n8n-import` service automatically imports and activates the workflow from `n8n/workflows/website-scraper.workflow.json`.

**Re-import after workflow changes** (one-time):

```bash
rm -f runtime/n8n/.website-scraper-imported-v8
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
| POST | `/api/workflow/save-result` | `{ startUrl, requestedFields[], findings[], pageResults[] }` → `{ outputPath, document }` |
| POST | `/api/workflow/progress/:jobId/event` | Progress callbacks from n8n (`log`, `url_start`, `url_done`, `complete`, `error`) |
