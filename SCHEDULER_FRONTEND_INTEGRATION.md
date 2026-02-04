# Pipeline Scheduler - Frontend Integration

## 🎯 Overview

The **Pipeline Scheduler** is a fully integrated frontend module that provides a visual interface for managing Dagu-powered data quality pipelines directly within the MS3DM Toolkit. No need to switch to a separate Dagu UI!

## ✨ Features

### 📋 **1. Pipeline Dashboard**
View and manage all your scheduled data quality pipelines in one place:

- **Visual Pipeline Cards** - See all pipelines at a glance
- **Real-time Status** - Success/Failed/Running indicators
- **Schedule Display** - Human-readable cron expressions
- **Quick Actions** - Trigger, stop, and view details
- **Tag Support** - Organize pipelines with custom tags

### 📊 **2. Execution History**
Monitor pipeline runs with detailed execution tracking:

- **Split-view Interface** - List of executions + log viewer
- **Detailed Logs** - View complete execution logs in real-time
- **Duration Tracking** - See how long each run took
- **Status Timeline** - Track success/failure patterns over time

### ➕ **3. Visual Pipeline Builder**
Create new scheduled pipelines without writing YAML:

- **Form-Based Configuration** - Simple UI for pipeline setup
- **Schedule Presets** - Common schedules (hourly, daily, weekly)
- **Custom Cron Support** - Advanced scheduling with custom expressions
- **Live YAML Preview** - See generated YAML in real-time
- **Connection Integration** - Select from existing database connections
- **Suite Selection** - Use existing quality check suites

## 🚀 Quick Start

### **Access the Scheduler**

1. Navigate to **http://localhost:5173/scheduler** in your browser
2. Or click **"Scheduler"** in the top navigation menu

### **View Existing Pipelines**

The **Pipelines** tab shows all your DAGs:

```
📋 Pipelines Tab
├── daily_quality_checks (Daily at midnight)
├── datekey_validation_pipeline (Daily at 1:00 AM)
├── adhoc_table_quality_check (Manual only)
└── quality_monitoring_dashboard (Every 6 hours)
```

Each card displays:
- Pipeline name and description
- Current status (Success/Failed/Running)
- Schedule information
- Last run time
- Next scheduled run
- Duration of last execution

### **Trigger a Pipeline**

1. Find the pipeline card
2. Click the **"▶ Run"** button
3. The pipeline will execute immediately
4. Watch the status update in real-time

### **View Execution History**

1. Click the **"Execution History"** tab
2. See a list of all recent pipeline runs
3. Click any execution to view detailed logs
4. Logs appear in a terminal-style viewer on the right

### **Create a New Pipeline**

1. Click the **"Create Pipeline"** tab
2. Fill out the form:
   - **Pipeline Name**: Use alphanumeric, dashes, dots, underscores only
   - **Description**: What does this pipeline do?
   - **Schedule**: Choose a preset or enter custom cron
   - **Database Connection**: Select from existing connections
   - **Quality Suite**: Optionally select an existing suite
3. Watch the YAML preview update in real-time
4. Click **"✓ Create Pipeline"**
5. The DAG file is automatically created in `./dags/`

## 📁 Architecture

### **Frontend Components**

```
frontend/src/components/Scheduler/
├── PipelineScheduler.jsx   # Main container component
├── DagList.jsx              # Pipeline grid view with cards
├── ExecutionHistory.jsx     # Execution timeline + log viewer
└── PipelineBuilder.jsx      # Visual pipeline creation form
```

### **API Integration**

**New API Client** (`frontend/src/api/client.js`):

```javascript
export const schedulerApi = {
  listDags: () => daguClient.get('/dags'),
  getDag: (dagId) => daguClient.get(`/dags/${dagId}`),
  triggerDag: (dagId) => daguClient.post(`/dags/${dagId}/start`),
  stopDag: (dagId) => daguClient.post(`/dags/${dagId}/stop`),
  getExecutions: () => ...,
  getLogs: (dagId, executionId) => ...,
  createDag: (yamlContent) => ...,
  deleteDag: (dagId) => ...
}
```

**Backend API** (`backend/api/scheduler.py`):

```
POST   /api/scheduler/create-dag     # Create new DAG YAML file
DELETE /api/scheduler/dags/:id       # Delete a DAG file
GET    /api/scheduler/dags           # List all DAG files
GET    /api/scheduler/dags/:id       # Get specific DAG config
```

### **Data Flow**

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   React     │ ───> │   API Client │ ───> │  Dagu API    │
│ Components  │      │ (scheduler)  │      │ (port 8080)  │
└─────────────┘      └──────────────┘      └──────────────┘
                            │
                            v
                     ┌──────────────┐
                     │  Backend API │
                     │ (create DAG) │
                     └──────────────┘
                            │
                            v
                     ┌──────────────┐
                     │  ./dags/     │
                     │  *.yaml      │
                     └──────────────┘
```

## 🎨 UI Components Deep Dive

### **1. PipelineScheduler.jsx**

Main container with tabbed interface:

```jsx
const tabs = [
  { id: 'pipelines', label: 'Pipelines', icon: '📋' },
  { id: 'history', label: 'Execution History', icon: '📊' },
  { id: 'builder', label: 'Create Pipeline', icon: '➕' },
];
```

Features:
- Tab navigation
- Global refresh button
- Link to native Dagu UI (opens in new tab)
- Error handling and display

### **2. DagList.jsx**

Grid of pipeline cards with:

```jsx
// Status badges
✓ Success  (green)
✗ Failed   (red)
▶ Running  (blue)
⏳ Pending (yellow)

// Actions per card
▶ Run      // Trigger pipeline
⏹ Stop     // Stop running pipeline
▶ Details  // Expand for more info
```

**Expandable Details:**
- DAG ID
- Tags (data-quality, automated, etc.)
- Number of steps
- Full configuration

### **3. ExecutionHistory.jsx**

Split-screen interface:

**Left Panel** (Execution List):
- Chronological list of all runs
- Click to select and view logs
- Color-coded status indicators
- Duration and step count

**Right Panel** (Log Viewer):
- Dark terminal-style background
- Syntax-free log output
- Auto-scroll to new logs
- Loading states

### **4. PipelineBuilder.jsx**

Form-based pipeline creation:

**Left Panel** (Configuration):
- Pipeline name (validated)
- Description (optional)
- Schedule selector with presets:
  - Manual only
  - Every hour
  - Daily at midnight
  - Daily at 1:00 AM
  - Every 6 hours
  - Weekly
  - Custom cron
- Database connection dropdown
- Quality suite selector

**Right Panel** (YAML Preview):
- Live-updating YAML
- Syntax highlighting (monospace font)
- Copy to clipboard button
- Shows final file that will be created

## 🔧 Schedule Presets

Pre-configured cron expressions for common schedules:

| Preset | Cron Expression | Description |
|--------|----------------|-------------|
| Manual | (none) | No automatic schedule |
| Hourly | `0 */1 * * *` | Every hour on the hour |
| Daily | `0 0 * * *` | Every day at midnight |
| Daily 1am | `0 1 * * *` | Every day at 1:00 AM |
| Every 6h | `0 */6 * * *` | Every 6 hours |
| Weekly | `0 0 * * 0` | Every Sunday at midnight |
| Custom | (user input) | Custom cron expression |

## 📊 Example Workflows

### **Workflow 1: Create Hourly Quality Check**

```
1. Navigate to Scheduler → Create Pipeline
2. Enter:
   - Name: hourly_customer_validation
   - Description: Validate customer data every hour
   - Schedule: Every hour
   - Connection: Local AdventureWorks
   - Suite: Customer Validation Suite
3. Review YAML preview
4. Click "Create Pipeline"
5. Pipeline appears in Pipelines tab
6. Automatically runs every hour
```

### **Workflow 2: Manually Trigger Ad-Hoc Check**

```
1. Navigate to Scheduler → Pipelines
2. Find "adhoc_table_quality_check" card
3. Click "▶ Run"
4. Pipeline executes immediately
5. Switch to "Execution History" tab
6. Click the new execution to view logs
7. Monitor progress in real-time
```

### **Workflow 3: Monitor Daily Pipeline**

```
1. Navigate to Scheduler → Pipelines
2. Find "daily_quality_checks" card
3. View:
   - Status: ✓ Success
   - Last Run: 12:00 AM today
   - Next Run: 12:00 AM tomorrow
   - Duration: 22.5s
4. Click "▶ Details" for more info
5. See all 4 steps executed
6. Check tags: data-quality, automated
```

## 🎯 Integration with Quality Builder

The Scheduler seamlessly integrates with the Quality Builder:

1. **Create Checks** in Quality Builder
2. **Save as Suite** with a name
3. **Create Pipeline** in Scheduler
4. **Select Suite** in Pipeline Builder
5. **Set Schedule** (hourly, daily, etc.)
6. **Pipeline Runs** automatically using those checks

## 🔐 Security & Access

- **Port 8080**: Dagu native UI (full access)
- **Port 5173**: MS3DM Toolkit frontend (integrated view)
- **Port 8000**: Backend API (DAG file management)

All components run in Docker:
- `ms3dm_dagu` container for Dagu scheduler
- `ms3dm_backend` container for API
- `ms3dm_frontend` container for React app

## 📝 Generated Pipeline YAML

When you create a pipeline through the UI, it generates a complete Dagu YAML file:

```yaml
name: my_quality_pipeline
description: Data quality pipeline
schedule: "0 0 * * *"
tags:
  - data-quality
  - automated

env:
  - CONNECTION_ID: local_adventureworks
  - SUITE_NAME: customer_validation

steps:
  - name: run_quality_checks
    command: |
      curl -X POST http://backend:8000/api/expectations/run-suite \
        -H "Content-Type: application/json" \
        -d '{
          "suite_name": "${SUITE_NAME}",
          "connection_id": "${CONNECTION_ID}"
        }' \
        -o /tmp/results.json
    
  - name: check_results
    command: |
      failures=$(jq '.statistics.failed' /tmp/results.json)
      if [ "$failures" -gt 0 ]; then
        echo "❌ $failures check(s) failed"
        exit 1
      else
        echo "✅ All checks passed"
      fi
    depends:
      - run_quality_checks

handlerOn:
  failure:
    command: |
      echo "Pipeline failed at $(date)"
  success:
    command: |
      echo "Pipeline completed successfully at $(date)"
```

## 🚨 Error Handling

The frontend handles various error scenarios:

1. **Dagu Not Running**:
   - Shows empty state
   - Link to check `localhost:8080`
   - Suggest checking Docker

2. **Invalid Pipeline Name**:
   - Real-time validation
   - Error message before creation
   - Helpful format hints

3. **Duplicate Pipeline**:
   - 409 Conflict error
   - Suggests using different name

4. **Pipeline Creation Failure**:
   - Displays backend error message
   - Form remains populated for retry

5. **Log Fetch Failure**:
   - Shows error in log viewer
   - Suggests refreshing

## 🎉 Benefits

### **For End Users:**
- ✅ No context switching between tools
- ✅ Unified interface for quality checks + scheduling
- ✅ Visual pipeline creation (no YAML knowledge needed)
- ✅ Real-time monitoring and logs
- ✅ Mobile-responsive design

### **For Developers:**
- ✅ Clean API separation (frontend ↔ backend ↔ Dagu)
- ✅ Reusable React components
- ✅ Type-safe API client
- ✅ Comprehensive error handling
- ✅ Easy to extend with new features

## 🔜 Future Enhancements

Potential additions:
- 📧 Email notifications on failure
- 📱 Slack/Teams integration
- 📈 Pipeline performance charts
- 🔄 Pipeline versioning
- 👥 User permissions/RBAC
- 🌐 Multi-tenant support
- 📦 Pipeline templates library
- 🧪 Test mode (dry-run)

## 📚 Related Documentation

- [DAGU_INTEGRATION_GUIDE.md](./DAGU_INTEGRATION_GUIDE.md) - Dagu setup & Docker config
- [DAGU_QUICK_START.md](./DAGU_QUICK_START.md) - Quick start guide for Dagu
- [dags/README.md](./dags/README.md) - Pre-built pipeline documentation
- [QUALITY_BUILDER_QUICKSTART.md](./QUALITY_BUILDER_QUICKSTART.md) - Quality check creation

---

**Need Help?**
- Check Dagu UI: http://localhost:8080
- View backend API: http://localhost:8000
- Frontend dev server: http://localhost:5173/scheduler
