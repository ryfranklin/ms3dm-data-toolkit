# macOS Setup Guide

This guide covers setting up the MS3DM Toolkit on macOS.

## Prerequisites Installation

### 1. Install Homebrew

If you don't have Homebrew installed:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Install unixODBC (Required for pyodbc)

```bash
brew install unixodbc
```

**Why needed?** The `pyodbc` Python package requires the unixODBC library to connect to databases. Without it, you'll see errors like `symbol not found '_SQLAllocHandle'`.

### 3. Install Microsoft ODBC Driver for SQL Server

```bash
# Add Microsoft's tap
brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release

# Install ODBC driver
brew install msodbcsql18 mssql-tools18
```

### 4. Install UV Package Manager

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 5. Install Node.js (for frontend)

```bash
brew install node@20
```

## Quick Start

Now you can install and run the platform:

```bash
cd ms3dm_toolkit

# Check that all dependencies are installed
cd backend && make check-deps

# Install Python dependencies
make install

# Install frontend dependencies
cd ../frontend && npm install

# Return to root and start with Docker
cd ..
make up
```

## Troubleshooting

### Error: "symbol not found '_SQLAllocHandle'"

**Solution:** Install unixODBC
```bash
brew install unixodbc
```

### Error: "No module named 'flask'"

**Solution:** Virtual environment not activated or dependencies not installed
```bash
cd backend
make install
```

### Error: "Unable to connect to SQL Server"

**Solutions:**
1. Check Docker is running: `docker ps`
2. Check SQL Server container: `docker-compose logs sqlserver`
3. Wait for database initialization (~2-3 minutes first time)
4. Verify connection details in `config/connections.yaml`

### Port 5000 Already in Use

**Solution:** The platform now uses port 8000 for the backend to avoid conflicts with macOS AirPlay Receiver.
- Backend API: http://localhost:8000
- Frontend: http://localhost:5173

### ODBC Driver Not Found

**Solution:** Install Microsoft ODBC Driver
```bash
brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release
brew install msodbcsql18
```

## Verify Installation

```bash
# Check unixODBC
brew list unixodbc

# Check ODBC driver
brew list msodbcsql18

# Check UV
uv --version

# Check Python
python3 --version

# Check Node
node --version
```

## Next Steps

Once all prerequisites are installed, follow the main README.md for running the platform:

```bash
# Start all services with Docker
make up

# Or run locally without Docker
cd backend
make run

# In another terminal
cd frontend
npm run dev
```
