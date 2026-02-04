# MS3DM Toolkit - Backend

Flask-based REST API for the MS3DM Toolkit.

## Tech Stack

- **Python**: 3.11+
- **Package Manager**: UV (fast Python package installer)
- **Web Framework**: Flask 3.0
- **Database**: SQL Server (via pyodbc)
- **Code Quality**: Ruff (linting & formatting) + Pyright (type checking)

## Development Setup

### Prerequisites

- Python 3.11+
- UV package manager: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **macOS**: Homebrew and unixODBC
  ```bash
  # Install Homebrew if not already installed
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  
  # Install unixODBC (required for pyodbc)
  brew install unixodbc
  
  # Install Microsoft ODBC Driver for SQL Server
  brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release
  brew install msodbcsql18 mssql-tools18
  ```
- **Linux**: SQL Server ODBC drivers (auto-installed in Docker)
- **Windows**: SQL Server ODBC drivers usually pre-installed

### Installation

```bash
# Check system dependencies (macOS only)
make check-deps

# Install dependencies (creates venv automatically, checks deps)
make install

# Install with dev dependencies (ruff, pyright)
make dev

# Or manually with uv
uv venv                           # Create venv
uv pip install -r requirements.txt # Install dependencies
uv pip install ruff pyright       # Install dev tools
```

**Note:** You don't need to activate the virtual environment! The Makefile commands automatically use `.venv/bin/python` and `.venv/bin/ruff`.

**macOS First-Time Setup:**
If you get a pyodbc import error, you need system dependencies:
```bash
brew install unixodbc
brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release
brew install msodbcsql18
```

### Running the Server

```bash
# Run Flask development server
make run

# Or directly
python app.py
```

Server runs on http://localhost:8000

**Note:** Port 8000 is used instead of 5000 to avoid conflicts with AirPlay Receiver on macOS.

## Code Quality

### Linting with Ruff

```bash
# Check for issues
make lint

# Auto-fix issues
ruff check --fix .

# Format code
make format
```

### Type Checking with Pyright

```bash
# Run type checker
make typecheck
```

### Run All Checks

```bash
# Lint + type check
make check

# Fix all auto-fixable issues
make fix
```

## Project Structure

```
backend/
├── app.py              # Flask application entry point
├── pyproject.toml      # UV dependencies and tool config
├── Makefile           # Development commands
├── api/               # API endpoints (blueprints)
│   ├── config.py      # Connection management
│   ├── quality.py     # Data quality checks
│   └── flows.py       # Data flow documentation
├── services/          # Business logic
│   ├── db_connector.py    # SQL Server connection
│   ├── quality_checker.py # Quality validation
│   └── flow_analyzer.py   # Flow analysis
└── utils/             # Utilities
    ├── config_manager.py  # YAML config handler
    └── validators.py      # Input validation
```

## API Endpoints

### Health Check
- `GET /health` - Service health status
- Example: http://localhost:8000/health

### Configuration API (`/api/config`)
- `GET /` - List all connections
- `POST /` - Create connection
- `GET /:id` - Get connection details
- `PUT /:id` - Update connection
- `DELETE /:id` - Delete connection
- `POST /:id/test` - Test connection

### Quality API (`/api/quality`)
- `POST /run-checks` - Execute quality checks
- `GET /results/:id` - Get check results
- `GET /history` - List check history
- `POST /configure` - Configure checks

### Flows API (`/api/flows`)
- `GET /` - List all flows
- `POST /` - Create flow
- `GET /:id` - Get flow details
- `PUT /:id` - Update flow
- `DELETE /:id` - Delete flow
- `GET /:id/lineage` - Get lineage graph
- `POST /discover` - Auto-discover relationships
- `GET /schema/:connection_id` - Browse schema
- `GET /schema/:connection_id/metadata/:schema/:object` - Get object metadata

## Configuration

### Environment Variables

```bash
FLASK_ENV=development
FLASK_DEBUG=1
SQL_SERVER_HOST=sqlserver
SQL_SERVER_PORT=1433
SQL_SERVER_USER=sa
SQL_SERVER_PASSWORD=YourStrong@Passw0rd
```

### Ruff Configuration

See `pyproject.toml` for linting rules:
- Line length: 100 characters
- Python 3.11 target
- Enabled: pycodestyle, pyflakes, isort, bugbear, pyupgrade

### Pyright Configuration

See `pyproject.toml` for type checking:
- Basic type checking mode
- Python 3.11
- Excludes test files and venv

## Makefile Commands

```bash
make help       # Show all commands
make install    # Install dependencies
make dev        # Install dev dependencies
make lint       # Run ruff linter
make format     # Format code
make typecheck  # Run pyright
make check      # Run all checks
make fix        # Fix and format
make clean      # Clean cache files
make run        # Run Flask server
```

## Testing

```bash
# Run type checker
make typecheck

# Run linter
make lint

# Fix auto-fixable issues
make fix
```

## Docker

The backend runs in a Docker container with:
- Python 3.11 slim image
- SQL Server ODBC drivers
- UV package manager
- Auto-reloading enabled in development

Build and run:
```bash
docker-compose up --build backend
```
