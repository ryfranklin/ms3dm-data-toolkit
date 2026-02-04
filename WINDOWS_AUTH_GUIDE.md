# Windows Authentication Guide

## Overview

The MS3DM Toolkit **fully supports Windows Authentication** for SQL Server connections alongside traditional SQL Server Authentication. This guide explains how to use Windows Authentication effectively.

## Features

✅ **Dual Authentication Support**
- SQL Server Authentication (username/password)
- Windows Authentication (integrated/trusted connection)

✅ **Smart UI**
- Dynamic form fields based on auth type
- Visual badges indicating auth method
- Helpful hints and warnings

✅ **Backend Support**
- Automatic connection string building
- Trusted_Connection for Windows Auth
- Username/Password for SQL Auth

## How to Use Windows Authentication

### Via Web UI

1. **Navigate to Configuration Manager**
   - Click on the "Configuration" tab
   
2. **Add New Connection**
   - Click "Add Connection" button
   
3. **Fill in Connection Details**
   - **Name**: Friendly name for your connection
   - **Server**: SQL Server hostname (e.g., `PROD-SQL-01` or `SERVER\INSTANCE`)
   - **Port**: 1433 (default) or custom port
   - **Database**: Target database name
   - **Authentication Type**: Select "Windows Authentication"
   
4. **Windows Auth Info Panel**
   - When Windows Auth is selected, you'll see a blue info panel
   - No username/password fields are shown
   - Connection uses credentials of the backend service account
   
5. **Test & Save**
   - Click "Test" to verify connection
   - Click "Create" to save

### Via YAML Configuration

Edit `config/connections.yaml`:

```yaml
connections:
  - id: prod_server
    name: Production Database
    server: PROD-SQL-01
    port: 1433
    database: ProductionDB
    auth_type: windows
    description: Production server with Windows Auth
    active: true
```

**Note:** When using `auth_type: windows`, username and password fields are not required.

## Visual Indicators

### In Connection Table

- **Windows Auth**: 🔐 Blue badge
- **SQL Auth**: 🔑 Purple badge

### In Connection Form

- **Windows Auth**: Blue info panel with requirements
- **SQL Auth**: Username and password fields with key icon

## Requirements & Limitations

### ✅ Requirements for Windows Authentication

1. **Backend Environment**
   - Must run on Windows OS
   - Cannot use Docker containers (Linux-based)
   - Service account must have SQL Server permissions

2. **SQL Server Configuration**
   - SQL Server must allow Windows Authentication mode
   - User running backend must have valid SQL login
   - Appropriate database permissions granted

3. **Network**
   - Backend must have network access to SQL Server
   - Domain trust relationship (if using domain accounts)
   - Firewall rules allowing SQL Server port (1433)

### ❌ When Windows Auth Won't Work

- ❌ Backend running in Docker (Linux containers)
- ❌ Backend running on macOS or Linux
- ❌ Cross-domain scenarios without trust
- ❌ SQL Server not configured for Windows Auth
- ❌ User lacks SQL Server permissions

## Backend Implementation

### Connection String Building

The backend automatically builds the correct connection string:

**SQL Server Authentication:**
```python
f"DRIVER={{ODBC Driver 18 for SQL Server}};"
f"SERVER={server},{port};"
f"DATABASE={database};"
f"UID={username};"
f"PWD={password};"
f"TrustServerCertificate=yes;"
```

**Windows Authentication:**
```python
f"DRIVER={{ODBC Driver 18 for SQL Server}};"
f"SERVER={server};"
f"DATABASE={database};"
f"Trusted_Connection=yes;"
f"TrustServerCertificate=yes;"
```

### Code Location

- **Backend Logic**: `backend/services/db_connector.py`
- **Frontend UI**: `frontend/src/components/ConfigManager/ConfigManager.jsx`
- **Configuration**: `config/connections.yaml`
- **Validation**: `backend/utils/config_manager.py`

## Troubleshooting

### "Login failed for user" Error

**Possible Causes:**
- User doesn't have SQL Server login
- SQL Server not configured for Windows Auth
- Backend not running as expected user

**Solutions:**
1. Verify user has SQL Server login:
   ```sql
   SELECT * FROM sys.server_principals WHERE type = 'U'
   ```
2. Check SQL Server authentication mode (must be "Mixed Mode" or "Windows")
3. Grant appropriate permissions to Windows user
4. Test connection with SQL Server Management Studio first

### "Named Pipes Provider" Error

**Possible Causes:**
- SQL Server not reachable
- Firewall blocking connection
- Wrong server name

**Solutions:**
1. Verify server name: `SERVER\INSTANCE` or just `SERVER`
2. Check firewall allows port 1433
3. Test with `telnet server 1433`
4. Verify SQL Server Browser service is running (for named instances)

### Backend in Docker

**Issue:** Windows Authentication doesn't work in Docker containers

**Solution:** 
- Use SQL Server Authentication when running in Docker
- Or run backend natively on Windows for Windows Auth

## Testing Windows Authentication

### Test via UI
1. Create Windows Auth connection
2. Click "Test" button
3. Should see green success message with SQL Server version

### Test via API
```bash
# Create connection
curl -X POST http://localhost:8000/api/config/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Windows Auth",
    "server": "localhost",
    "database": "master",
    "auth_type": "windows"
  }'

# Test connection
curl -X POST http://localhost:8000/api/config/{connection_id}/test
```

### Expected Success Response
```json
{
  "success": true,
  "message": "Connection successful. Server version: Microsoft SQL Server 2022..."
}
```

## Best Practices

### Development Environment
- ✅ Use SQL Auth for Docker-based development
- ✅ Use Windows Auth when running backend natively on Windows
- ✅ Keep separate connection configs for dev/prod

### Production Environment
- ✅ Use Windows Auth with service accounts
- ✅ Follow principle of least privilege
- ✅ Use separate SQL logins per application
- ✅ Document which service account is used
- ✅ Rotate service account passwords regularly

### Security
- ✅ Never commit passwords to version control
- ✅ Use environment variables for sensitive data
- ✅ Prefer Windows Auth over SQL Auth when possible
- ✅ Enable encryption (TrustServerCertificate setting)
- ✅ Use SQL Server auditing to track access

## Examples

### Scenario 1: Development with Docker
```yaml
# Use SQL Auth
connections:
  - name: Dev Database
    server: localhost
    database: DevDB
    auth_type: sql_auth
    username: sa
    password: DevPassword123
```

### Scenario 2: Production on Windows Server
```yaml
# Use Windows Auth
connections:
  - name: Prod Database
    server: PROD-SQL-01
    database: ProductionDB
    auth_type: windows
    description: Uses app service account
```

### Scenario 3: Named Instance
```yaml
connections:
  - name: Analytics Instance
    server: SERVER\ANALYTICS
    database: AnalyticsDB
    auth_type: windows
```

## Summary

Windows Authentication in MS3DM Toolkit provides:
- ✅ Secure, password-less authentication
- ✅ Leverages existing Windows security infrastructure
- ✅ Easy-to-use UI with smart form behavior
- ✅ Clear visual indicators and helpful hints
- ✅ Comprehensive backend support

For most production scenarios on Windows, **Windows Authentication is the recommended approach**.

---

**Related Documentation:**
- [README.md](README.md) - Main project documentation
- [database/README.md](database/README.md) - Database setup guide
- [SETUP_MACOS.md](SETUP_MACOS.md) - macOS-specific setup (SQL Auth only)
