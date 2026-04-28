.PHONY: help install dev up down logs clean backend-lint frontend-lint lint backend-format format typecheck test test-docker test-frontend

help:
	@echo "MS3DM Workbench - Available Commands"
	@echo ""
	@echo "Docker Commands:"
	@echo "  make up         - Start all services with Docker Compose"
	@echo "  make down       - Stop all services"
	@echo "  make logs       - View logs from all services"
	@echo "  make logs-sql   - View SQL Server logs"
	@echo "  make logs-be    - View backend logs"
	@echo "  make logs-fe    - View frontend logs"
	@echo "  make clean      - Stop services and remove volumes"
	@echo ""
	@echo "Development Commands:"
	@echo "  make install    - Install all dependencies (backend + frontend)"
	@echo "  make dev        - Install dev dependencies"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint       - Run linters (backend + frontend)"
	@echo "  make format     - Format code (backend)"
	@echo "  make typecheck  - Run type checker (backend)"
	@echo "  make check      - Run all checks"
	@echo "  make fix        - Fix all auto-fixable issues"
	@echo ""
	@echo "Tests:"
	@echo "  make test          - Run pytest in local backend venv (skips pyodbc tests on Mac w/o unixodbc)"
	@echo "  make test-frontend - Run vitest in frontend"
	@echo "  make test-docker   - Run full pytest suite in Docker (matches CI)"

# Docker commands
up:
	docker-compose up --build

down:
	docker-compose down

logs:
	docker-compose logs -f

logs-sql:
	docker-compose logs -f sqlserver

logs-be:
	docker-compose logs -f backend

logs-fe:
	docker-compose logs -f frontend

clean:
	docker-compose down -v
	@echo "Removed all containers and volumes"

# Installation
install: backend-install frontend-install

backend-venv:
	@if [ ! -d backend/.venv ]; then \
		cd backend && uv venv; \
		echo "Backend virtual environment created"; \
	else \
		echo "Backend virtual environment already exists"; \
	fi

backend-install: backend-venv
	cd backend && uv pip install -r requirements.txt

frontend-install:
	cd frontend && npm install

dev: backend-dev frontend-install

backend-dev: backend-venv
	cd backend && uv pip install -r requirements.txt
	cd backend && uv pip install ruff pyright

# Linting
lint: backend-lint frontend-lint

backend-lint:
	cd backend && ruff check .

frontend-lint:
	cd frontend && npm run lint || echo "No frontend linter configured"

# Formatting
format: backend-format

backend-format:
	cd backend && ruff format .

# Type checking
typecheck:
	cd backend && pyright

# Combined checks
check: lint typecheck
	@echo "All checks passed!"

fix: backend-fix

backend-fix:
	cd backend && ruff check --fix .
	cd backend && ruff format .

# Tests
test:
	cd backend && .venv/bin/pytest tests/ -v

test-frontend:
	cd frontend && npm test

# Mirrors CI exactly — runs the full backend pytest suite (including the
# pyodbc-dependent modules that skip locally on macOS without unixodbc).
test-docker:
	docker build -f backend/Dockerfile.test -t ms3dm-test backend/
	docker run --rm ms3dm-test

# Clean caches
clean-cache:
	cd backend && $(MAKE) clean
	cd frontend && rm -rf node_modules/.cache dist
	@echo "Cleaned all caches"
