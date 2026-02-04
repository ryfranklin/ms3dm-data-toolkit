FROM python:3.11-slim

# Install ODBC drivers for SQL Server and uv
RUN apt-get update && apt-get install -y \
    curl gnupg2 apt-transport-https ca-certificates \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && curl -fsSL https://packages.microsoft.com/config/debian/12/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && echo "deb [signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 unixodbc-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

WORKDIR /app

# Copy pyproject.toml for dependency installation
COPY pyproject.toml .
COPY requirements.txt .

# Install dependencies with uv (fallback to requirements.txt for compatibility)
RUN uv pip install --system -r requirements.txt

COPY . .
EXPOSE 8000
CMD ["python", "app.py"]
