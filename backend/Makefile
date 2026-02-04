.PHONY: help venv install dev lint format typecheck test clean run check-deps

help:
	@echo "Available commands:"
	@echo "  make check-deps - Check system dependencies (macOS)"
	@echo "  make venv       - Create virtual environment with uv"
	@echo "  make install    - Install dependencies with uv"
	@echo "  make dev        - Install dev dependencies"
	@echo "  make lint       - Run ruff linter"
	@echo "  make format     - Format code with ruff"
	@echo "  make typecheck  - Run pyright type checker"
	@echo "  make check      - Run all checks (lint + typecheck)"
	@echo "  make fix        - Fix linting issues and format"
	@echo "  make clean      - Clean cache and temporary files"
	@echo "  make run        - Run the Flask application"

check-deps:
	@echo "Checking system dependencies..."
	@if [ "$$(uname)" = "Darwin" ]; then \
		if ! command -v brew > /dev/null; then \
			echo "❌ Homebrew not found. Install from https://brew.sh"; \
			exit 1; \
		fi; \
		if ! brew list unixodbc > /dev/null 2>&1; then \
			echo "❌ unixODBC not found. Install with: brew install unixodbc"; \
			exit 1; \
		fi; \
		if ! brew list msodbcsql18 > /dev/null 2>&1; then \
			echo "⚠️  Microsoft ODBC Driver not found. Install with:"; \
			echo "   brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release"; \
			echo "   brew install msodbcsql18 mssql-tools18"; \
		fi; \
		echo "✅ All dependencies found!"; \
	else \
		echo "ℹ️  Dependency check only implemented for macOS"; \
	fi

venv:
	@if [ ! -d .venv ]; then \
		uv venv; \
		echo "Virtual environment created. Activate with:"; \
		echo "  source .venv/bin/activate  (Linux/Mac)"; \
		echo "  .venv\\Scripts\\activate     (Windows)"; \
	else \
		echo "Virtual environment already exists at .venv"; \
	fi

install: check-deps venv
	uv pip install -r requirements.txt
	@echo "✅ Installation complete!"

dev: check-deps venv
	uv pip install -r requirements.txt
	uv pip install ruff pyright
	@echo "✅ Dev installation complete!"

lint:
	@if [ ! -d .venv ]; then \
		echo "Error: Virtual environment not found. Run 'make dev' first."; \
		exit 1; \
	fi
	.venv/bin/ruff check .

format:
	@if [ ! -d .venv ]; then \
		echo "Error: Virtual environment not found. Run 'make dev' first."; \
		exit 1; \
	fi
	.venv/bin/ruff format .

typecheck:
	@if [ ! -d .venv ]; then \
		echo "Error: Virtual environment not found. Run 'make dev' first."; \
		exit 1; \
	fi
	.venv/bin/pyright

check: lint typecheck
	@echo "All checks passed!"

fix:
	@if [ ! -d .venv ]; then \
		echo "Error: Virtual environment not found. Run 'make dev' first."; \
		exit 1; \
	fi
	.venv/bin/ruff check --fix .
	.venv/bin/ruff format .

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true

run:
	@if [ ! -d .venv ]; then \
		echo "Error: Virtual environment not found. Run 'make install' first."; \
		exit 1; \
	fi
	.venv/bin/python app.py
