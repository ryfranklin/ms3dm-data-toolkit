# Storage Cleanup Setup - Quick Reference

## Issue Fixed

The Dagu container was missing `curl` and `jq` which are needed by the storage cleanup workflow.

## Solution Applied

### 1. Installed Tools Immediately
```bash
docker exec ms3dm_dagu bash -c "apt-get update && apt-get install -y curl jq"
```
✅ curl 8.5.0 installed
✅ jq-1.7 installed

### 2. Updated Entrypoint Script
Changed from Alpine (`apk`) to Ubuntu (`apt-get`):

**File**: `dagu-entrypoint.sh`
```bash
#!/bin/bash
# Install curl and jq for DAG scripts (Ubuntu/Debian)
apt-get update && apt-get install -y curl jq

# Start Dagu
exec dagu start-all
```

### 3. Container Restart
When Dagu container is recreated, the entrypoint will automatically install curl and jq.

## How the Cleanup Works Now

### Workflow Architecture
```
Dagu Container                Backend Container
┌──────────────┐              ┌──────────────────┐
│ Storage      │              │                  │
│ Cleanup DAG  │              │ /app/            │
│              │              │  ├─ expectations_ │
│ Step 1:      │  HTTP GET    │  │   results/    │
│ Check Status ├─────────────>│  ├─ catalog_     │
│              │              │  │   metadata/   │
│ Step 2:      │  HTTP POST   │  └─ logs/        │
│ Execute      ├─────────────>│                  │
│ Cleanup      │              │ Deletes old files│
│              │<─────────────│ Returns stats    │
│ Step 3:      │  HTTP GET    │                  │
│ Verify       ├─────────────>│                  │
└──────────────┘              └──────────────────┘
```

### Workflow Steps

**Step 1: Check Storage Before**
```bash
curl -s http://backend:8000/api/storage/status | jq -r '
  "Storage: \(.total_size_mb) MB",
  "Files: \(.total_files)"
'
```

**Step 2: Execute Cleanup**
```bash
curl -s -X POST http://backend:8000/api/storage/execute-cleanup \
  -H "Content-Type: application/json" \
  -d '{"retention_days": 30}' | jq
```

**Step 3: Verify After**
```bash
curl -s http://backend:8000/api/storage/status | jq -r '
  "Storage: \(.total_size_mb) MB (after)"
'
```

## Testing

### Test Manually in Dagu UI
1. Open: http://localhost:8080/dags/storage_cleanup
2. Click "Start" button
3. Watch steps execute in real-time
4. Should complete successfully with all green checkmarks

### Test via API
```bash
# Trigger cleanup
curl -X POST http://localhost:8000/api/storage/execute-cleanup \
  -H "Content-Type: application/json" \
  -d '{"retention_days": 30}' | jq

# Check status
curl http://localhost:8000/api/storage/status | jq
```

### Test via Frontend
1. Open toolkit: http://localhost:3000
2. If cleanup prompt appears, click "▶️ Run Cleanup Now"
3. Should trigger successfully and open Dagu UI
4. Monitor execution in Dagu

## Expected Results

### Successful Execution
```json
{
  "success": true,
  "message": "Cleanup completed successfully",
  "results": {
    "before": {
      "expectations_results": {
        "size_mb": 45.2,
        "file_count": 234
      }
    },
    "after": {
      "expectations_results": {
        "size_mb": 23.1,
        "file_count": 128
      }
    },
    "actions": [
      "Removed 106 old quality result files",
      "Removed 0 old log files",
      "Compressed 3 catalog metadata files"
    ],
    "summary": {
      "storage_before_mb": 67.8,
      "storage_after_mb": 45.6,
      "space_recovered_mb": 22.2,
      "retention_days": 30
    }
  }
}
```

## Verification Commands

### Check Installed Tools
```bash
docker exec ms3dm_dagu which curl
docker exec ms3dm_dagu which jq
docker exec ms3dm_dagu curl --version
docker exec ms3dm_dagu jq --version
```

### Check Backend Reachability from Dagu
```bash
docker exec ms3dm_dagu curl -s http://backend:8000/api/storage/status
```

### Monitor Cleanup Execution
```bash
# Tail Dagu logs during execution
docker logs ms3dm_dagu -f

# Check backend logs
docker logs ms3dm_toolkit-backend-1 -f
```

## Troubleshooting

### Tools Not Found After Container Restart
**Cause**: Entrypoint didn't run or failed
**Solution**:
```bash
# Manually install again
docker exec ms3dm_dagu bash -c "apt-get update && apt-get install -y curl jq"

# Or recreate container
docker-compose up -d --force-recreate dagu
```

### "Connection Refused" to Backend
**Cause**: Backend container not running or network issue
**Solution**:
```bash
# Check backend is running
docker ps | grep backend

# Check network
docker exec ms3dm_dagu ping -c 2 backend

# Restart backend
docker-compose restart backend
```

### Cleanup Doesn't Remove Files
**Cause**: Files not old enough or retention period too long
**Solution**:
```bash
# Check file ages
docker exec ms3dm_toolkit-backend-1 find /app/expectations_results -name "*.json" -mtime +30 -ls

# Test with shorter retention (e.g., 1 day)
curl -X POST http://localhost:8000/api/storage/execute-cleanup \
  -H "Content-Type: application/json" \
  -d '{"retention_days": 1}' | jq
```

## Future Container Restarts

When you recreate the Dagu container, the entrypoint script will automatically install curl and jq:

```bash
# This will work automatically
docker-compose down dagu
docker-compose up -d dagu

# Entrypoint runs: apt-get update && apt-get install -y curl jq
# Then starts: dagu start-all
```

## Summary

✅ **curl and jq installed** in Dagu container
✅ **Entrypoint updated** to use apt-get (Ubuntu)
✅ **Workflow updated** to call backend API
✅ **Ready to test** - trigger via UI or Dagu

The storage cleanup workflow should now execute successfully!
