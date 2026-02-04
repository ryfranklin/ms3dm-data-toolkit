.PHONY: help install dev up down logs clean backend-lint frontend-lint lint backend-format format typecheck

help:
	@echo "MS3DM Toolkit - Available Commands"
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

# Clean caches
clean-cache:
	cd backend && $(MAKE) clean
	cd frontend && rm -rf node_modules/.cache dist
	@echo "Cleaned all caches"
