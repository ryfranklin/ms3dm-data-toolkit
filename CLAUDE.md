# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

### Docker (full stack)
```bash
docker-compose up --build       # Start all services (SQL Server, backend, frontend, Dagu)
docker-compose down             # Stop services
docker-compose down -v          # Stop and remove volumes
```

### Backend (Python 3.11+, Flask)
```bash
cd backend
make venv           # Create virtualenv with uv
make install        # Install dependencies
make dev            # Install with dev tools (ruff, pyright)
make run            # Start Flask dev server on port 8000
make lint           # ruff check
make format         # ruff format
make typecheck      # pyright
make check          # lint + typecheck
make fix            # Auto-fix linting issues
```

### Frontend (React/Vite)
```bash
cd frontend
npm install
npm run dev         # Vite dev server on port 5173
npm run build       # Production build
npm run lint        # ESLint
```

### Root Makefile shortcuts
```bash
make up / make down / make clean    # Docker lifecycle
make logs-be / logs-fe / logs-sql   # Service logs
make install                        # Install all deps (backend + frontend)
make lint / format / check / fix    # Code quality across both
```

## Architecture

**Four Docker services** orchestrated via docker-compose:
- **sqlserver** (port 1433) — SQL Server 2022 with AdventureWorksLT2022 sample DB (auto-downloads on first run)
- **backend** (port 8000) — Flask API server
- **frontend** (port 5173) — React SPA (Vite dev server)
- **dagu** (port 8080) — Workflow orchestrator for scheduled DAGs

### Backend

Flask app with **8 API blueprints** under `backend/api/`: config, quality, docs, expectations, scheduler, catalog, storage, dbt. All mounted at `/api/<blueprint>/`.

**Central persistence: `MetadataStore`** (`backend/services/metadata_store.py`)
- All metadata lives in the `ms3dm_metadata` SQL Server database (8 tables: connections, quality_results, quality_configs, expectation_results, catalog_metadata, data_flows, documents, app_settings)
- Initialized in `app.py`, stored in `app.config['METADATA_STORE']`
- Every blueprint accesses it via `current_app.config['METADATA_STORE']`
- Uses MERGE statements for upserts; JSON columns stored as NVARCHAR(MAX) with json.dumps/loads
- The old file-based `ConfigManager` has been deleted — do not recreate it

**Key services** (`backend/services/`):
- `db_connector.py` — pyodbc wrapper with Windows Auth + SQL Auth support
- `quality_checker.py` — Runs 5 check types (nulls, schema, gaps, freshness, profiling)
- `expectation_engine.py` — 20+ expectation types inspired by Great Expectations; accepts `store=` kwarg
- `dbt_manager.py` — Manages dbt project for documentation/lineage

**DAG files** live on disk in a shared Docker named volume (`dags_volume`) mounted by both backend and Dagu. Dagu data/logs are bind mounts to `./dagu/`.

### Frontend

React 18 + React Router v6 + TailwindCSS 3.4. API client in `frontend/src/api/client.js` (Axios, base URL from `VITE_API_URL`).

**Routes** (defined in `App.jsx`): `/` (config), `/quality`, `/pipeline-builder`, `/catalog`, `/scheduler`, `/docs`.

Key libraries: Recharts (charts), react-markdown + mermaid (documentation).

## Environment

Copy `.env.sample` to `.env`. Key variables:
- `SA_PASSWORD` — SQL Server sa password (used across docker-compose with fallback `YourStrong@Passw0rd`)
- `MS3DM_METADATA_*` — Host, port, user, password, database for metadata store
- `VITE_API_URL` — Backend URL for frontend (default `http://localhost:8000`)

## Conventions

- Backend uses port 8000 (not 5000) to avoid macOS AirPlay Receiver conflict
- API responses return `jsonify({'message': ..., 'data': ...})` with appropriate HTTP status codes
- Ruff config: line length 100, Python 3.11 target, rule sets E/W/F/I/B/C4/UP (see `pyproject.toml`)
- No test suite exists yet — testing is manual via API endpoints
- `results/` and `backend/expectations_results/` contain quality check output files
