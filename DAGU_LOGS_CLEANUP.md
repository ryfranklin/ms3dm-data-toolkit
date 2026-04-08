# Dagu Logs Cleanup - Implementation Summary

## Overview

Added **Dagu workflow execution logs** to the storage cleanup system to automatically remove old workflow logs and prevent disk space buildup.

## What Was Added

### 1. **Dagu Logs Monitoring**

Added `dagu_logs` to monitored directories:

```python
MONITORED_DIRS = {
    'expectations_results': '...',
    'catalog_metadata': '...',
    'logs': '...',
    'dagu_logs': os.path.join(..., 'dagu', 'logs'),  # NEW
}
```

**Location:** `backend/dagu/logs/` (mounted from `./dagu/logs`)

### 2. **Cleanup Logic**

Added dedicated cleanup for Dagu workflow logs:

```python
# Cleanup old Dagu workflow logs
if os.path.exists(MONITORED_DIRS['dagu_logs']):
    deleted_count = 0
    cutoff_time = datetime.now().timestamp() - (retention_days * 86400)
    
    for root, dirs, files in os.walk(MONITORED_DIRS['dagu_logs']):
        for filename in files:
            # Clean up Dagu log files (.log, .dat files)
            if filename.endswith(('.log', '.dat', '.tmp')):
                filepath = os.path.join(root, filename)
                try:
                    if os.path.getmtime(filepath) < cutoff_time:
                        os.remove(filepath)
                        deleted_count += 1
                except Exception:
                    pass
    
    results['actions'].append(f'Removed {deleted_count} old Dagu workflow log files')
```

**File Types Cleaned:**
- `.log` files - Workflow execution logs
- `.dat` files - Dagu data files
- `.tmp` files - Temporary workflow files

### 3. **Retention Policy**

**Dagu Workflow Logs:** Deleted after **30 days**

Same retention as application logs:
- Recent workflows available for debugging
- Historical workflows cleaned up
- Prevents unbounded growth

## Monitored Directories Summary

| Directory | Purpose | Retention | Cleanup |
|-----------|---------|-----------|---------|
| `expectations_results/` | Quality check results | 30 days | ✅ Deleted |
| `logs/` | Application logs | 30 days | ✅ Deleted |
| `dagu/logs/` | Workflow execution logs | 30 days | ✅ **NEW** |
| `catalog_metadata/` | Business documentation | Permanent | ❌ Preserved |

## What Gets Cleaned

### Dagu Log Files

Dagu generates logs for each workflow execution:

**Example Files:**
```
dagu/logs/
├── storage_cleanup/
│   ├── 2024-01-15-run-abc123.log
│   ├── 2024-01-16-run-def456.log
│   └── 2024-01-17-run-ghi789.log
├── customer_pipeline/
│   ├── 2024-01-15-run-xyz123.log
│   └── execution.dat
└── temp-files/
    └── workflow-123.tmp
```

**After 30 days:** Old log files are automatically deleted

### Why Clean Dagu Logs?

1. **Storage Growth** - Each workflow run generates logs
2. **Multiple Pipelines** - Many workflows = many log files
3. **Historical Data** - Old execution logs rarely needed
4. **Debugging** - Recent logs (< 30 days) still available

### Storage Impact

**Typical Dagu Log Growth:**
- Per workflow run: 10-100 KB
- Daily workflows: ~3 MB/month
- Multiple pipelines: 10-30 MB/month

**Example:**
```
10 pipelines × 3 runs/day × 30 KB/log × 30 days = ~27 MB/month
```

Without cleanup: **324 MB/year per pipeline set**

## Verification

### Check Monitored Directories

```bash
curl http://localhost:8000/api/storage/status | jq '.directories | keys'
```

**Expected Output:**
```json
[
  "catalog_metadata",
  "dagu_logs",          ← NEW
  "expectations_results",
  "logs"
]
```

### Check Cleanup Actions

```bash
curl http://localhost:8000/api/storage/cleanup-info | jq '.actions'
```

**Expected Output:**
```json
[
  "Remove quality check results older than 30 days",
  "Remove application log files older than 30 days",
  "Remove Dagu workflow logs older than 30 days",  ← NEW
  "Preserve catalog metadata ..."
]
```

### Check Current Dagu Logs Size

```bash
curl http://localhost:8000/api/storage/status | jq '.directories.dagu_logs'
```

**Example Output:**
```json
{
  "path": "/app/dagu/logs",
  "size_mb": 15.3,
  "file_count": 234,
  "oldest_file_age_days": 45
}
```

### Manual Cleanup Test

```bash
# Trigger cleanup manually
curl -X POST http://localhost:8000/api/storage/execute-cleanup | jq
```

**Look for:**
```json
{
  "actions": [
    "Removed 0 old quality result files",
    "Removed 0 old application log files",
    "Removed 12 old Dagu workflow log files",  ← Check count
    "Catalog metadata preserved"
  ]
}
```

## Files Modified

### Backend
- ✅ `backend/api/storage.py`
  - Added `dagu_logs` to `MONITORED_DIRS`
  - Added Dagu log cleanup logic
  - Updated cleanup action descriptions

### Documentation
- ✅ `STORAGE_MANAGEMENT.md`
  - Updated monitored directories list
  - Updated retention policies
  - Updated cleanup steps

### Infrastructure
- ✅ Created `dagu/logs/.gitkeep`
  - Ensures directory exists in Git
  - Logs themselves are .gitignored

## Storage Dashboard

The Storage Warning component now shows Dagu logs:

```
📊 Storage Dashboard
┌──────────────────────────────────────┐
│ Total Storage: 125.4 MB              │
│ Status: Warning                      │
│                                      │
│ Breakdown:                           │
│ • expectations_results: 45 MB        │
│ • catalog_metadata: 2 MB             │
│ • logs: 8 MB                         │
│ • dagu_logs: 15 MB          ← NEW   │
└──────────────────────────────────────┘
```

## Dagu UI Integration

Dagu has its own log viewing:
- Recent logs viewable in Dagu UI
- Execution history for debugging
- Our cleanup removes old files, not execution records

**In Dagu UI:**
```
http://localhost:8080/dags/storage_cleanup
  ├── Executions (in database) ← Kept
  └── Log Files (on disk) ← Cleaned after 30 days
```

## Best Practices

### 1. **Keep Recent Logs**

30 days is appropriate for:
- Recent troubleshooting
- Debugging failed runs
- Audit requirements
- Performance analysis

### 2. **Archive Important Logs**

For critical workflows, export logs before cleanup:

```bash
# Export specific workflow logs
docker cp ms3dm_dagu:/var/lib/dagu/logs/critical_pipeline ./archive/
```

### 3. **Monitor Storage**

Check Dagu logs size periodically:
```bash
du -sh dagu/logs/
```

If growing too fast, consider:
- Reduce logging verbosity
- Shorter retention period
- More frequent cleanup

### 4. **Cleanup Schedule**

Dagu workflow runs:
- **Schedule:** Weekly (Sunday 2 AM)
- **Manual:** Via Storage Warning component
- **API:** POST `/api/storage/execute-cleanup`

## Troubleshooting

### Issue: Dagu Logs Not Being Cleaned

**Check 1:** Verify directory exists
```bash
ls -la dagu/logs/
```

**Check 2:** Check file ages
```bash
find dagu/logs -name "*.log" -mtime +30 -ls
```

**Check 3:** Check permissions
```bash
docker exec ms3dm_toolkit-backend-1 ls -la /app/dagu/logs/
```

### Issue: Too Many Logs Remaining

**Cause:** Files not old enough

**Solution:** Adjust retention period:
```bash
# Use shorter retention (e.g., 7 days)
curl -X POST http://localhost:8000/api/storage/execute-cleanup \
  -H "Content-Type: application/json" \
  -d '{"retention_days": 7}'
```

### Issue: Dagu Can't Find Logs

**Cause:** Cleaned too aggressively

**Solution:**
- Use longer retention (60 days)
- Archive important logs before cleanup
- Increase cleanup frequency to smaller batches

## Comparison: Before vs After

### Before
```
Storage Monitored:
- Quality results ✅
- Application logs ✅
- Catalog metadata ✅

Issues:
- Dagu logs growing unbounded ❌
- No visibility into Dagu log size ❌
- Manual cleanup required ❌
```

### After
```
Storage Monitored:
- Quality results ✅
- Application logs ✅
- Catalog metadata ✅
- Dagu workflow logs ✅ NEW

Benefits:
- Automatic Dagu log cleanup ✅
- Dashboard shows Dagu log size ✅
- Consistent retention policy ✅
```

## Summary

✅ **Dagu logs now monitored** in storage dashboard  
✅ **Automatic cleanup** after 30 days  
✅ **Consistent with other logs** (same retention)  
✅ **Backend restarted** with new configuration  
✅ **Documentation updated**  

**Expected Outcome:**
- Dagu logs cleaned automatically
- Recent logs (< 30 days) always available
- Prevents unbounded storage growth
- Consistent retention across all log types

The storage cleanup workflow now handles all log types comprehensively, ensuring your local toolkit doesn't fill up with old workflow execution logs over time.
