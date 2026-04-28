# MS3DM Workbench

A lightweight Python data platform for local data analysis with SQL Server. Features include connection management, data quality checks, and visual data flow documentation.

## Features

✅ **Interactive Configuration Manager**
- Add/edit/test SQL Server connections
- Windows Authentication and SQL Server Authentication support
- Connection validation

✅ **Comprehensive Data Quality Checks**
- NULL value analysis with configurable thresholds
- Schema validation against expected structure
- Sequence gap detection (dates, IDs)
- Data freshness monitoring
- On-demand execution with results history

✅ **Visual Data Flow Documentation**
- Drag-and-drop flow builder with React Flow
- Database schema browser
- Auto-discovery of relationships (FKs, views, stored procedures)
- End-to-end pipeline tracking
- YAML-based storage for version control

✅ **Modern UI/UX**
- React SPA with fast navigation
- TailwindCSS responsive design
- Interactive visualizations

## Install (end users — Windows desktop)

Single-folder install, no Docker required.

### Prerequisites
- **Microsoft ODBC Driver 18 for SQL Server** — [download from Microsoft](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server). One-time install. Same driver Excel and Power BI use, so it's normally pre-approved on managed laptops.
- A SQL Server you can connect to (your existing BI server is fine — the app will create its own metadata database there).

### Install

1. Download the latest `ms3dm-toolkit-windows-x64.zip` from the [Releases page](../../releases).
2. Extract the zip to any folder you have write access to (e.g. `C:\Tools\ms3dm-toolkit`).
3. Double-click `ms3dm-toolkit.exe`.
4. Your browser opens to the first-run setup screen — enter your SQL Server host, port, username, and password. The app creates its `ms3dm_metadata` database automatically.

The app stores its config (including the metadata SQL credentials) at `%APPDATA%\ms3dm-toolkit\config.json`. Delete that file to re-trigger the setup wizard.

---

## Build a Windows release (developers)

```powershell
# On a Windows machine with Python 3.11+ and Node 18+
.\build.ps1
# Output: dist\ms3dm-toolkit-windows-x64.zip
```

Or push a tag to let GitHub Actions build it for you:

```bash
git tag v1.0.0 && git push origin v1.0.0
# .github/workflows/release.yml builds on windows-latest and attaches the
# zip to a draft GitHub Release. No Windows machine needed.
```

To smoke-test the PyInstaller spec on macOS without a Windows VM, run `./build.sh` — produces a non-Windows binary that exercises the same code path.

---

## Quick Start with Docker (developers)

### Prerequisites
- Docker and Docker Compose
- 4GB+ RAM available for containers

### Start the Platform

```bash
# Clone the repository
cd ms3dm_toolkit

# Start all services (SQL Server, Backend, Frontend)
docker-compose up --build

# First run: SQL Server will download and restore AdventureWorksLT (~2-3 minutes)
# Watch logs: docker-compose logs -f sqlserver

# Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# API Health: http://localhost:8000/health
```

### Stop the Platform

```bash
# Stop services
docker-compose down

# Remove volumes (fresh database on next start)
docker-compose down -v
```

## Sample Database

The platform includes AdventureWorksLT2022 sample database:
- **847 Customers** with addresses
- **295 Products** with categories
- **32 Sales Orders** with line items
- **Multiple foreign key relationships**
- **Custom reporting schema** for testing data flows

**Connection Details:**
- Server: localhost,1433
- Username: sa
- Password: YourStrong@Passw0rd
- Database: AdventureWorksLT2022

**API Endpoints:**
- Backend API: http://localhost:8000
- Frontend: http://localhost:5173

## Development without Docker

### Prerequisites

- Python 3.11+
- Node.js 20+
- UV package manager: `curl -LsSf https://astral.sh/uv/install.sh | sh`

**macOS Users - Additional Setup:**
```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install unixODBC (required for pyodbc)
brew install unixodbc

# Install Microsoft ODBC Driver for SQL Server
brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release
brew install msodbcsql18 mssql-tools18
```

### Backend Setup

```bash
cd backend

# Install dependencies (creates venv automatically)
make install

# Or install with dev tools (ruff, pyright)
make dev

# Run Flask server (no activation needed!)
make run

# Or manually
uv venv                           # Create venv
uv pip install -r requirements.txt # Install
.venv/bin/python app.py           # Run
```

Backend runs on http://localhost:8000

**Note:** Port 8000 is used instead of 5000 to avoid conflicts with AirPlay Receiver on macOS.

**Note:** The Makefile automatically uses the virtual environment, so you don't need to activate it manually!

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend runs on http://localhost:5173

## Code Quality

### Backend (Python)

The backend uses modern Python tooling:
- **UV**: Fast package manager and installer
- **Ruff**: Lightning-fast linter and formatter
- **Pyright**: Static type checker

```bash
# Run all checks
cd backend
make check

# Fix auto-fixable issues
make fix

# Individual commands
make lint       # Run ruff linter
make format     # Format code with ruff
make typecheck  # Run pyright type checker
```

### Using Makefiles

Root-level Makefile for common tasks:

```bash
# Docker commands
make up         # Start all services
make down       # Stop services
make logs       # View logs
make clean      # Remove volumes

# Development
make install    # Install all dependencies
make dev        # Install dev dependencies
make check      # Run all checks
make fix        # Fix all issues
```

Backend-specific commands:

```bash
cd backend
make help       # Show all available commands
make install    # Install dependencies
make lint       # Check code quality
make format     # Format code
make typecheck  # Type checking
make run        # Start Flask server
```

## Project Structure

```
ms3dm_toolkit/
├── backend/                 # Flask API
│   ├── app.py              # Main application
│   ├── api/                # API endpoints
│   ├── services/           # Business logic
│   └── utils/              # Utilities
├── frontend/               # React SPA
│   └── src/
│       ├── components/     # React components
│       └── api/            # API client
├── config/                 # Connection configurations
├── flows/                  # Data flow definitions
├── database/               # SQL Server initialization
└── docker-compose.yml      # Docker orchestration
```

## Usage Guide

### 1. Configuration Manager

**Add a Connection:**
1. Navigate to Configuration tab
2. Click "Add Connection"
3. Fill in connection details:
   - Name: Friendly name
   - Server: hostname or IP
   - Database: database name
   - Auth Type: Windows or SQL Server
   - Credentials (if SQL Auth)
4. Test connection
5. Save

**Pre-configured Connection:**
- "Local AdventureWorks (Docker)" is ready to use

### 2. Data Quality Dashboard

**Run Quality Checks:**
1. Navigate to Data Quality tab
2. Select a connection
3. Choose check types:
   - NULL Value Analysis
   - Schema Validation
   - Data Gap Detection
   - Freshness Checks
4. Click "Run Checks"
5. View results in tabs

**Review History:**
- Recent checks are listed at the bottom
- Click to load historical results

### 3. Data Flow Visualizer

**Create a Flow:**
1. Navigate to Data Flows tab
2. Click "New Flow"
3. Enter flow metadata (name, description, owner)
4. Select a connection from dropdown
5. Drag tables from Database Browser to canvas
6. Add transformations from Node Palette
7. Connect nodes by drawing edges
8. Click nodes to edit properties
9. Save flow

**Load Existing Flow:**
- Select from "Load Flow..." dropdown
- Edit and save changes

**Auto-Discovery:**
- Click "Discover Relationships"
- View detected foreign keys, views, and procedures
- Get suggested flow templates

## API Endpoints

### Configuration API
- `GET /api/config/` - List connections
- `POST /api/config/` - Create connection
- `PUT /api/config/:id` - Update connection
- `DELETE /api/config/:id` - Delete connection
- `POST /api/config/:id/test` - Test connection

### Quality API
- `POST /api/quality/run-checks` - Execute checks
- `GET /api/quality/results/:id` - Get results
- `GET /api/quality/history` - List check history

### Flows API
- `GET /api/flows/` - List flows
- `POST /api/flows/` - Create flow
- `PUT /api/flows/:id` - Update flow
- `DELETE /api/flows/:id` - Delete flow
- `POST /api/flows/discover` - Auto-discover relationships
- `GET /api/flows/schema/:connection_id` - Browse schema

## Configuration Files

### Connection Configuration
`config/connections.yaml`:

**SQL Server Authentication:**
```yaml
connections:
  - id: my_connection
    name: My Database
    server: localhost
    port: 1433
    database: MyDB
    auth_type: sql_auth
    username: sa
    password: password
    description: My database connection
    active: true
```

**Windows Authentication:**
```yaml
connections:
  - id: my_windows_connection
    name: Production Database
    server: PROD-SQL-01
    port: 1433
    database: ProductionDB
    auth_type: windows
    description: Uses Windows integrated authentication
    active: true
```

**Note:** Windows Authentication requires:
- Backend must run on Windows with appropriate domain/network access
- User running the application must have SQL Server permissions
- Not supported when running backend in Docker (Linux containers)

### Data Flow Definition
`flows/data_flows.yaml`:
```yaml
flows:
  - id: customer_pipeline
    name: Customer Reporting Pipeline
    description: Aggregate customer metrics
    source_tables:
      - schema: dbo
        table: Customers
    transformations:
      - step: 1
        type: join
        description: Join with orders
    destination:
      schema: reporting
      table: CustomerMetrics
```

## Troubleshooting

### SQL Server Container Issues

**Container fails to start:**
- Check Docker logs: `docker-compose logs sqlserver`
- Ensure port 1433 is not in use
- Verify 4GB+ RAM available

**Database not initializing:**
- Check init script logs: `docker-compose logs sqlserver`
- Script runs on first start only
- Force reinit: `docker-compose down -v && docker-compose up --build`

### Connection Issues

**Cannot connect from host machine:**
- Use `localhost,1433` as server address
- Verify SQL Server container is running
- Check firewall settings

**Cannot connect from backend container:**
- Use `sqlserver` as hostname (service name)
- Check `docker-compose.yml` environment variables

**Windows Authentication not working:**
- Verify backend is running on Windows (not in Docker)
- Check that the user has SQL Server login permissions
- Ensure SQL Server allows Windows Authentication
- Test with SQL Server Management Studio first
- Use format: `SERVER\INSTANCE` or just `SERVER` for default instance

### Frontend Issues

**API calls failing:**
- Verify backend is running
- Check VITE_API_URL environment variable
- Check browser console for CORS errors

## Contributing

This is a self-contained local data platform. Modifications should maintain the lightweight, analyst-friendly design.

## License

MIT License - feel free to use and modify for your needs.

## Support

For issues or questions:
1. Check troubleshooting section
2. Review Docker logs: `docker-compose logs`
3. Verify all services are healthy: `docker-compose ps`

---

**Built with:** Flask, React, TailwindCSS, React Flow, SQL Server, Docker
