#!/bin/bash

# Fix pyodbc installation on macOS
# This script ensures pyodbc is compiled with proper ODBC support

set -e

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "🔧 Fixing pyodbc installation for macOS..."
echo "📁 Working directory: $SCRIPT_DIR"
echo ""

# Check if unixODBC is installed
echo "📦 Checking for unixODBC..."
if ! brew list unixodbc &> /dev/null; then
    echo "❌ unixODBC not found. Installing..."
    brew install unixodbc
else
    echo "✅ unixODBC is installed"
fi

# Check for Microsoft ODBC Driver
echo "📦 Checking for Microsoft ODBC Driver..."
if ! brew list msodbcsql18 &> /dev/null; then
    echo "⚠️  Microsoft ODBC Driver not found. Installing..."
    brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release
    brew install msodbcsql18 mssql-tools18
else
    echo "✅ Microsoft ODBC Driver is installed"
fi

# Remove old virtual environment
echo ""
echo "🗑️  Removing old virtual environment..."
rm -rf .venv

# Create new virtual environment
echo "🔨 Creating new virtual environment..."
uv venv

# Set environment variables for compilation
echo "🔧 Setting up compilation environment..."
export LDFLAGS="-L/opt/homebrew/opt/unixodbc/lib"
export CPPFLAGS="-I/opt/homebrew/opt/unixodbc/include"

# Install dependencies without pyodbc first
echo "📥 Installing base dependencies..."
uv pip install Flask==3.0.0 Flask-CORS==4.0.0 PyYAML==6.0.1 python-dotenv==1.0.0

# Force compile pyodbc from source with proper flags
echo "🔨 Compiling pyodbc with ODBC support..."
echo "   This may take a few minutes..."
uv pip install --no-binary :all: --reinstall pyodbc==5.0.1

echo ""
echo "✅ Installation complete!"
echo ""
echo "🧪 Testing pyodbc import..."
if .venv/bin/python -c "import pyodbc; print('✅ pyodbc imported successfully!')"; then
    echo ""
    echo "🚀 Now try: make run"
else
    echo "❌ pyodbc import failed. Please check the errors above."
    exit 1
fi
