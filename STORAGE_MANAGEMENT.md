# Storage Management System

## Overview
The MS3DM Toolkit now includes an automatic storage management system that monitors disk usage, provides warnings when storage is filling up, and includes an automated cleanup job to maintain optimal performance.

## Components

### 1. Backend Storage API (`backend/api/storage.py`)
Monitors storage usage across three key directories:
- `expectations_results/` - Quality check results
- `catalog_metadata/` - Table documentation
- `logs/` - Application logs

**Endpoints**:
- `GET /api/storage/status` - Current storage usage
- `GET /api/storage/cleanup-info` - Cleanup job details
- `GET /api/storage/recommendations` - Storage optimization suggestions

### 2. Dagu Cleanup Workflow (`dags/storage_cleanup.yaml`)
Automated job that runs weekly (Sunday 2 AM) to:
- Remove quality check results older than 30 days
- Remove log files older than 30 days
- Compress catalog metadata older than 7 days
- Report storage usage before and after cleanup

### 3. Frontend Warning Component (`frontend/src/components/StorageWarning/StorageWarning.jsx`)
Visual alert system that:
- Appears at the top of all pages when storage exceeds thresholds
- Shows current usage and file counts
- Links directly to Dagu cleanup job
- Can be dismissed for current session
- Auto-refreshes every 5 minutes

## Storage Thresholds

### Warning Level (100 MB)
- Yellow banner displayed
- Recommends running cleanup
- Shows estimated recoverable space

### Critical Level (500 MB)
- Red banner displayed
- Urgent cleanup recommended
- Highlights potential performance impact

### Healthy (< 100 MB)
- No warning displayed
- System operating normally

## Visual Design

### Warning State (100-500 MB)
```
┌───────────────────────────────────────────────────────┐
│ ⚠️  Storage Warning                      ▶ More      │
│                                                       │
│ Storage usage: 156 MB across 523 files               │
│ Estimated recoverable space: 78 MB                   │
│                                                       │
│ [🧹 View Cleanup Job] [🔄 Refresh] [Dismiss]        │
└───────────────────────────────────────────────────────┘
```

### Critical State (> 500 MB)
```
┌───────────────────────────────────────────────────────┐
│ 🚨  Critical Storage Alert               ▶ More      │
│                                                       │
│ Storage usage: 523 MB across 1,847 files             │
│ Estimated recoverable space: 261 MB                  │
│                                                       │
│ [🧹 View Cleanup Job] [🔄 Refresh] [Dismiss]        │
└───────────────────────────────────────────────────────┘
```

### Expanded View
```
┌───────────────────────────────────────────────────────┐
│ ⚠️  Storage Warning                      ▼ Less      │
│                                                       │
│ Storage usage: 156 MB across 523 files               │
│ Estimated recoverable space: 78 MB                   │
│                                                       │
│ Storage Breakdown:                                    │
│ expectations_results: 89 MB (412 files, oldest: 45d) │
│ catalog_metadata:     51 MB (98 files, oldest: 32d)  │
│ logs:                 16 MB (13 files, oldest: 28d)  │
│                                                       │
│ Automatic Cleanup Job:                                │
│ Schedule: Weekly on Sunday at 2 AM                    │
│ Retention: 30 days                                    │
│ • Remove quality check results older than 30 days    │
│ • Remove log files older than 30 days                │
│ • Compress catalog metadata older than 7 days        │
│                                                       │
│ [🧹 View Cleanup Job] [🔄 Refresh] [Dismiss]        │
└───────────────────────────────────────────────────────┘
```

## Cleanup Workflow Details

### Schedule
- **Frequency**: Weekly
- **Day**: Sunday
- **Time**: 2:00 AM
- **Timezone**: Server local time

### Retention Policy
- **Quality Results**: 30 days
- **Log Files**: 30 days
- **Catalog Metadata**: Compressed after 7 days, never deleted

### Cleanup Steps
1. **Check Storage** - Report current usage
2. **Cleanup Old Results** - Remove JSON files older than 30 days
3. **Cleanup Old Logs** - Remove log files older than 30 days
4. **Compress Metadata** - gzip old catalog files
5. **Report Storage** - Show space recovered
6. **Send Notification** - Log completion

### Example Execution
```bash
# Manual execution via Dagu UI
curl -X POST http://localhost:8080/api/v2/dags/storage_cleanup/start

# Or via Dagu CLI (if available)
dagu start storage_cleanup
```

## User Workflow

### When Warning Appears
1. **Notice Banner** - Yellow or red alert at top of page
2. **Click "More"** - View detailed breakdown
3. **Review Usage** - See which directories are largest
4. **Click "View Cleanup Job"** - Opens Dagu interface
5. **Run Job** - Execute cleanup manually if needed
6. **Verify** - Click "Refresh" to see updated storage

### Running Manual Cleanup
1. Click **"View Cleanup Job"** in warning banner
2. Dagu opens in new window
3. Click **"Start"** button in Dagu UI
4. Monitor execution logs
5. Job completes (typically 10-30 seconds)
6. Return to toolkit and click **"Refresh"**
7. Warning should disappear if below threshold

## API Reference

### GET /api/storage/status
Returns current storage usage.

**Response**:
```json
{
  "status": "warning",
  "total_size_mb": 156.23,
  "total_files": 523,
  "directories": {
    "expectations_results": {
      "path": "/app/expectations_results",
      "size_bytes": 93421568,
      "size_mb": 89.11,
      "file_count": 412,
      "oldest_file_days": 45,
      "exists": true
    },
    "catalog_metadata": {
      "path": "/app/catalog_metadata",
      "size_bytes": 53477376,
      "size_mb": 50.98,
      "file_count": 98,
      "oldest_file_days": 32,
      "exists": true
    },
    "logs": {
      "path": "/app/logs",
      "size_bytes": 16777216,
      "size_mb": 16.00,
      "file_count": 13,
      "oldest_file_days": 28,
      "exists": true
    }
  },
  "thresholds": {
    "warning": 100,
    "critical": 500
  },
  "estimated_recoverable_mb": 78.12,
  "cleanup_recommended": true,
  "timestamp": "2026-02-04T06:49:05.123456"
}
```

### GET /api/storage/cleanup-info
Returns information about the cleanup job.

**Response**:
```json
{
  "dag_name": "storage_cleanup",
  "dagu_url": "http://localhost:8080/dags/storage_cleanup",
  "schedule": "Weekly on Sunday at 2 AM",
  "retention_days": 30,
  "description": "Automatically cleans up old files to reduce storage usage",
  "actions": [
    "Remove quality check results older than 30 days",
    "Remove log files older than 30 days",
    "Preserve catalog metadata (never cleaned up - contains valuable business documentation)"
  ]
}
```

### GET /api/storage/recommendations
Returns actionable recommendations for storage optimization.

**Response**:
```json
{
  "recommendations": [
    {
      "severity": "warning",
      "directory": "expectations_results",
      "message": "expectations_results is using 89.11 MB",
      "action": "Consider running cleanup job to remove old files"
    },
    {
      "severity": "info",
      "directory": "expectations_results",
      "message": "expectations_results has files older than 45 days",
      "action": "Run cleanup to remove outdated files"
    }
  ],
  "total_recommendations": 2
}
```

## Configuration

### Adjusting Thresholds
Edit `backend/api/storage.py`:
```python
STORAGE_THRESHOLDS = {
    'warning': 100,   # Warning at 100MB
    'critical': 500,  # Critical at 500MB
}
```

### Changing Retention Period
Edit `dags/storage_cleanup.yaml`:
```yaml
env:
  - RETENTION_DAYS: "30"  # Keep files from last 30 days
```

### Modifying Schedule
Edit `dags/storage_cleanup.yaml`:
```yaml
schedule: "0 2 * * 0"  # Cron format: minute hour day month weekday
# Examples:
# Daily at 2 AM:    "0 2 * * *"
# Every 6 hours:    "0 */6 * * *"
# Monthly (1st):    "0 2 1 * *"
```

## Monitoring & Maintenance

### Check Storage Status
```bash
# Via API
curl http://localhost:8000/api/storage/status | jq

# Via Docker
docker exec ms3dm_toolkit-backend-1 du -sh /app/expectations_results /app/catalog_metadata /app/logs
```

### View Cleanup Logs
```bash
# In Dagu UI
http://localhost:8080/dags/storage_cleanup

# Or check Dagu logs
docker logs ms3dm_toolkit-dagu-1 | grep storage_cleanup
```

### Manual Cleanup Commands
```bash
# Remove old quality results
docker exec ms3dm_toolkit-backend-1 find /app/expectations_results -name "*.json" -type f -mtime +30 -delete

# Compress old metadata
docker exec ms3dm_toolkit-backend-1 find /app/catalog_metadata -name "*.json" -type f -mtime +7 -exec gzip {} \;

# Check disk usage
docker exec ms3dm_toolkit-backend-1 df -h
```

## Troubleshooting

### Warning Won't Dismiss
- Dismissal is per-session only
- Clears when browser tab/window closes
- Reappears if storage still high on refresh

### Cleanup Job Fails
**Check**:
1. Dagu container is running: `docker ps | grep dagu`
2. Directories exist: `docker exec ms3dm_toolkit-backend-1 ls -la /app`
3. Permissions: Files should be writable
4. Disk space: `docker exec ms3dm_toolkit-backend-1 df -h`

**Common Issues**:
- **gzip not found**: Install in Dagu container
- **Permission denied**: Check file ownership
- **No space left**: Manually delete some files first

### Storage Still High After Cleanup
1. Check if files are actually old enough (>30 days)
2. Verify retention period setting
3. Check for large individual files
4. Consider adjusting thresholds

### API Not Responding
```bash
# Check backend logs
docker logs ms3dm_toolkit-backend-1 --tail 50

# Test endpoint directly
curl http://localhost:8000/api/storage/status

# Restart backend if needed
docker-compose restart backend
```

## Best Practices

### For Users
1. **Don't Ignore Warnings** - Act when alerts appear
2. **Run Cleanup Weekly** - Even if automated schedule exists
3. **Review Before Deleting** - Check what will be removed
4. **Keep Recent Data** - 30-day retention is recommended
5. **Export Important Results** - Before cleanup if needed

### For Administrators
1. **Monitor Trends** - Track storage growth over time
2. **Adjust Thresholds** - Based on actual usage patterns
3. **Review Retention** - Balance storage vs. data needs
4. **Test Cleanup** - Verify job runs successfully
5. **Document Changes** - Note any configuration modifications

## Performance Impact

### Storage Levels
- **< 100 MB**: No impact
- **100-500 MB**: Minimal impact
- **> 500 MB**: Potential slowdown in file operations
- **> 1 GB**: Significant performance degradation

### Cleanup Impact
- **Duration**: 10-60 seconds typical
- **CPU**: Low (file I/O bound)
- **Downtime**: None (runs in background)
- **Risk**: Low (only deletes old files)

## Future Enhancements

### Planned Features
1. **Automatic Cleanup** - Trigger on threshold breach
2. **Email Notifications** - Alert admins of critical storage
3. **Storage Analytics** - Charts showing usage over time
4. **Selective Cleanup** - Choose which directories to clean
5. **Backup Before Delete** - Optional archive to S3/backup
6. **Smart Retention** - ML-based retention policies
7. **Archive Old Results** - Move to cheaper storage instead of deleting
8. **Cloud Storage** - Offload old files to cloud

## Security Considerations

### File Deletion
- Only deletes files in monitored directories
- Respects retention period (30 days default)
- Cannot delete system or application files
- Logs all deletions for audit trail

### Permissions
- Backend runs as non-root user
- Limited to `/app` directory
- No access to host filesystem
- Docker isolation provides additional security

## Integration

### With Quality Builder
- Results are stored in `expectations_results/`
- Cleanup removes old test results
- Recent results (< 30 days) preserved
- Historical trends maintained

### With Data Catalog
- Metadata stored in `catalog_metadata/`
- Compressed but never deleted
- Documentation always available
- gzip files readable by backend

### With Pipeline Scheduler
- Dagu logs managed separately
- Cleanup job appears in Dagu UI
- Can be triggered from scheduler
- Execution history preserved

## Summary

The Storage Management System provides:
- ✅ **Automatic monitoring** of storage usage
- ✅ **Visual warnings** when thresholds exceeded
- ✅ **Automated cleanup** job (weekly schedule)
- ✅ **Manual trigger** option via Dagu
- ✅ **Detailed breakdown** of storage by directory
- ✅ **Configurable** thresholds and retention
- ✅ **Safe deletion** with retention policies
- ✅ **Performance optimization** through cleanup

This ensures the MS3DM Toolkit maintains optimal performance while preventing storage-related issues.
