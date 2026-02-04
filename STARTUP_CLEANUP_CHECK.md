# Startup Cleanup Check

## Overview
For local installations where the machine isn't running 24/7, the MS3DM Toolkit now checks on startup if the storage cleanup job needs to be run and prompts the user with a one-click option to execute it.

## The Problem
- **Scheduled cleanup** runs Sunday at 2 AM
- **Local users** may not have machine on at that time
- **Result**: Cleanup never runs, storage accumulates
- **Solution**: Check on startup and prompt user

## How It Works

### 1. Last Run Tracking
Backend maintains a timestamp file (`last_cleanup.json`) that records:
- When cleanup was last run
- Who/what triggered it (user or schedule)

### 2. Startup Check
When user opens the toolkit:
1. Frontend loads and checks cleanup status
2. Backend calculates days since last run
3. If > 7 days (or never run), shows prompt
4. User sees blue "Cleanup Recommended" banner

### 3. One-Click Execution
User clicks **"▶️ Run Cleanup Now"**:
1. Frontend calls backend API
2. Backend triggers Dagu workflow
3. Dagu executes cleanup steps
4. Backend records run timestamp
5. User sees Dagu UI to monitor
6. After completion, prompt disappears

## Visual Prompts

### Cleanup Overdue (> 7 days)
```
┌──────────────────────────────────────────────────────┐
│ 🧹  Cleanup Recommended              ▼ More     ✕   │
│                                                      │
│ Last cleanup: 12 days ago (recommended: every 7 days)│
│ Current storage: 87 MB across 423 files             │
│ Estimated recoverable: 43 MB                         │
│                                                      │
│ [▶️ Run Cleanup Now] [🗂️ View in Dagu] [🔄] [Dismiss]│
└──────────────────────────────────────────────────────┘
```

### Never Run
```
┌──────────────────────────────────────────────────────┐
│ 🧹  Cleanup Recommended              ▼ More     ✕   │
│                                                      │
│ Cleanup job has never been run (recommended: every 7 days)│
│ Current storage: 156 MB across 687 files            │
│ Estimated recoverable: 78 MB                         │
│                                                      │
│ [▶️ Run Cleanup Now] [🗂️ View in Dagu] [🔄] [Dismiss]│
└──────────────────────────────────────────────────────┘
```

### Storage Warning + Overdue
If storage is also high, shows storage warning with cleanup info:
```
┌──────────────────────────────────────────────────────┐
│ ⚠️  Storage Warning                  ▼ More     ✕   │
│                                                      │
│ Storage usage: 234 MB across 1,234 files            │
│ Estimated recoverable space: 117 MB                 │
│ Last cleanup: 15 days ago                           │
│                                                      │
│ [▶️ Run Cleanup Now] [🗂️ View in Dagu] [🔄] [Dismiss]│
└──────────────────────────────────────────────────────┘
```

## Priority Logic

The system shows prompts in this priority order:

1. **Critical Storage (> 500 MB)** - Red alert, immediate action
2. **Storage Warning (> 100 MB)** - Yellow alert, cleanup recommended
3. **Cleanup Overdue (> 7 days)** - Blue prompt, routine maintenance
4. **Healthy (< 100 MB, < 7 days)** - No prompt shown

## API Enhancements

### Backend: `backend/api/storage.py`

#### New Functions
```python
def get_last_cleanup_run():
    """Get timestamp of last cleanup run"""
    
def set_last_cleanup_run():
    """Record current time as last cleanup run"""
    
def is_cleanup_overdue():
    """Check if cleanup hasn't run in 7+ days"""
```

#### Enhanced Endpoint: GET `/api/storage/cleanup-info`
Now returns:
```json
{
  "dag_name": "storage_cleanup",
  "dagu_url": "http://localhost:8080/dags/storage_cleanup",
  "schedule": "Weekly on Sunday at 2 AM",
  "retention_days": 30,
  "last_run": "2026-01-28T14:32:15.123456",
  "days_since_last_run": 7,
  "overdue": true,
  "recommended_interval_days": 7
}
```

#### New Endpoint: POST `/api/storage/trigger-cleanup`
Triggers cleanup job and records timestamp.

**Response (Success)**:
```json
{
  "success": true,
  "message": "Cleanup job triggered successfully",
  "dagu_url": "http://localhost:8080/dags/storage_cleanup",
  "note": "Check Dagu UI to monitor execution"
}
```

**Response (Failure)**:
```json
{
  "success": false,
  "message": "Could not connect to Dagu. Please trigger manually.",
  "dagu_url": "http://localhost:8080/dags/storage_cleanup",
  "error": "Connection refused"
}
```

### Frontend: `StorageWarning.jsx`

#### New Features
1. **Overdue Detection**: Checks `cleanupInfo.overdue`
2. **One-Click Trigger**: `handleTriggerCleanup()` function
3. **Status Display**: Shows days since last run
4. **Priority Logic**: Shows most urgent alert first

#### New Button: "Run Cleanup Now"
```jsx
<button onClick={handleTriggerCleanup} disabled={triggering}>
  {triggering ? '⏳ Starting...' : '▶️ Run Cleanup Now'}
</button>
```

**Behavior**:
1. Click button
2. Shows "⏳ Starting..." while triggering
3. Calls backend API to trigger Dagu
4. Opens Dagu UI in new window
5. Shows success/failure alert
6. Auto-refreshes status after 3 seconds

## User Workflows

### Scenario 1: First Time Startup
```
User starts toolkit for first time
  ↓
Blue "Cleanup Recommended" banner appears
  ↓
Banner says "Cleanup job has never been run"
  ↓
User clicks "▶️ Run Cleanup Now"
  ↓
Cleanup executes (probably finds nothing to clean)
  ↓
Timestamp recorded
  ↓
Banner disappears
```

### Scenario 2: Returning After 10 Days
```
User hasn't used toolkit in 10 days
  ↓
Starts toolkit
  ↓
Blue banner: "Last cleanup: 10 days ago"
  ↓
User clicks "▶️ Run Cleanup Now"
  ↓
Cleanup removes old files
  ↓
Space recovered
  ↓
Banner shows refreshed status
```

### Scenario 3: Daily User
```
User uses toolkit daily
  ↓
Last cleanup was 3 days ago
  ↓
No banner shown (healthy)
  ↓
After 7 days, banner appears
  ↓
User runs cleanup
  ↓
Another 7 days of no prompts
```

### Scenario 4: Cleanup Fails to Trigger
```
User clicks "▶️ Run Cleanup Now"
  ↓
Backend can't reach Dagu
  ↓
Alert: "Could not trigger automatically"
  ↓
Dagu UI opens anyway
  ↓
User clicks "Start" in Dagu manually
  ↓
Cleanup runs successfully
```

## Configuration

### Adjust Overdue Threshold
Edit `backend/api/storage.py`:
```python
def is_cleanup_overdue():
    """Check if cleanup hasn't run in recommended interval"""
    last_run = get_last_cleanup_run()
    if last_run is None:
        return True
    
    days_since = (datetime.now() - last_run).days
    return days_since >= 7  # Change this number
```

### Tracker File Location
```python
CLEANUP_TRACKER_FILE = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), 
    'last_cleanup.json'
)
```

**File Format** (`backend/last_cleanup.json`):
```json
{
  "last_run": "2026-02-04T14:32:15.123456",
  "triggered_by": "api"
}
```

## Dagu Workflow Integration

### Updated Workflow
The Dagu workflow (`storage_cleanup.yaml`) now includes a final step:

```yaml
- name: update_tracker
  description: Update last run timestamp in backend
  command: |
    curl -X POST http://backend:8000/api/storage/trigger-cleanup \
      -H "Content-Type: application/json"
  depends:
    - send_notification
```

**Purpose**: 
- Records timestamp even when run on schedule
- Ensures "last run" is accurate regardless of trigger method
- Prevents prompt from showing after successful scheduled run

## Advantages for Local Users

### Before (Scheduled Only)
- ❌ User machine off on Sunday 2 AM
- ❌ Cleanup never runs
- ❌ Storage accumulates over weeks/months
- ❌ Eventually hits limits or slows down
- ❌ User unaware of problem

### After (Startup Check)
- ✅ Prompt appears on startup if overdue
- ✅ One click to run cleanup
- ✅ Works regardless of schedule
- ✅ User aware of maintenance needs
- ✅ Storage stays clean with minimal effort

## Technical Details

### Persistence
- Last run timestamp stored in `backend/last_cleanup.json`
- Survives container restarts
- Mounted as volume (if configured)
- Excluded from git via `.gitignore`

### Reliability
- If trigger fails, user can still run manually
- Dagu UI always opens for visibility
- Multiple execution methods (API, schedule, manual)
- Graceful degradation if Dagu unreachable

### Performance
- Startup check adds ~200ms to initial load
- No impact on subsequent page loads
- Refresh check every 5 minutes (configurable)
- Dismissible for current session

## Testing

### Test Overdue Prompt
```bash
# Delete tracker file to simulate "never run"
docker exec ms3dm_toolkit-backend-1 rm -f /app/last_cleanup.json

# Restart frontend to see prompt
# Visit http://localhost:3000
```

### Test With Old Timestamp
```bash
# Set last run to 10 days ago
docker exec ms3dm_toolkit-backend-1 bash -c 'echo "{\"last_run\":\"$(date -d "10 days ago" -Iseconds)\",\"triggered_by\":\"test\"}" > /app/last_cleanup.json'

# Refresh page to see prompt
```

### Test Trigger Functionality
```bash
# Ensure Dagu is running
docker ps | grep dagu

# Click "Run Cleanup Now" in UI
# Should trigger job and open Dagu

# Verify in backend logs
docker logs ms3dm_toolkit-backend-1 | grep trigger-cleanup
```

## Monitoring

### Check Last Run
```bash
# Via API
curl http://localhost:8000/api/storage/cleanup-info | jq '.last_run, .days_since_last_run'

# Via file
docker exec ms3dm_toolkit-backend-1 cat /app/last_cleanup.json
```

### View Trigger History
```bash
# Backend logs
docker logs ms3dm_toolkit-backend-1 | grep "trigger-cleanup"

# Dagu execution history
# Visit http://localhost:8080/dags/storage_cleanup
```

## Best Practices

### For Users
1. **Run when prompted** - Takes 30 seconds
2. **Don't always dismiss** - Address the issue
3. **Check Dagu UI** - Verify completion
4. **Refresh after** - Confirm cleanup worked

### For Administrators
1. **Adjust threshold** - Based on user patterns
2. **Monitor trends** - Track cleanup frequency
3. **Review logs** - Ensure triggers succeed
4. **Test regularly** - Verify workflow works

## Troubleshooting

### Prompt Won't Go Away
**Cause**: Cleanup not actually running or completing
**Solution**: 
1. Check Dagu UI for execution status
2. Verify cleanup workflow completes all steps
3. Check backend logs for errors
4. Manually verify files are being deleted

### "Run Now" Doesn't Work
**Cause**: Backend can't reach Dagu
**Solution**:
1. Verify Dagu container is running: `docker ps | grep dagu`
2. Check network connectivity between containers
3. Use "View in Dagu" and run manually
4. Check backend logs for specific error

### Timestamp Not Updating
**Cause**: Tracker file not writable or update step failing
**Solution**:
1. Check file permissions: `docker exec ms3dm_toolkit-backend-1 ls -la /app/last_cleanup.json`
2. Verify Dagu workflow includes `update_tracker` step
3. Check Dagu logs for curl errors

## Summary

The startup cleanup check solves the "local user" problem by:
- ✅ **Detecting** when cleanup is overdue
- ✅ **Prompting** user at startup
- ✅ **Simplifying** execution to one click
- ✅ **Recording** runs automatically
- ✅ **Preventing** storage accumulation
- ✅ **Maintaining** clean system without relying on schedules

This ensures local users get the same benefits as 24/7 server installations, with minimal friction and maximum visibility.
