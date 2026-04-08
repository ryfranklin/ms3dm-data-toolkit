# Pipeline Management Feature

## Overview

Added comprehensive pipeline management capabilities to the Pipeline Builder, including viewing and deleting existing quality pipelines directly from the GUI.

## Features Added

### 🗂️ View Existing Pipelines

**Location:** Top of Pipeline Builder page

**Collapsible Section:**
- Click to expand/collapse
- Shows count: "Existing Pipelines (3)"
- Auto-refreshes when you create new pipelines
- Manual refresh button available

**Pipeline Information Displayed:**
- **Pipeline Name** - Full descriptive name
- **Description** - Purpose and details
- **Step Count** - Number of quality check steps
- **Filename** - YAML file name

### 🗑️ Delete Pipelines

**Delete Button:** Each pipeline has a red "🗑️ Delete" button

**Safety Features:**
- **Confirmation Dialog** - Requires confirmation before deletion
- **Clear Warning** - "This will permanently remove the pipeline file and cannot be undone"
- **Loading State** - Button shows "Deleting..." during operation
- **Success Notification** - Confirms deletion at top of page
- **Auto-Refresh** - Pipeline list updates after deletion

**What Gets Deleted:**
- YAML workflow file from `backend/dags/`
- Pipeline removed from Dagu UI (after Dagu refresh)

**What's Preserved:**
- Execution history in Dagu database
- Past quality check results
- No data is lost, only the workflow definition

### 📊 Open in Dagu

**Blue Button:** "📊 Open in Dagu"

Opens the pipeline in Dagu UI where you can:
- View workflow structure
- Start execution manually
- See execution history
- Monitor running jobs
- View detailed logs

## User Interface

### Existing Pipelines Section

```
┌─────────────────────────────────────────────────┐
│ Existing Pipelines (2)          🔄 Refresh    ▼ │
├─────────────────────────────────────────────────┤
│ Sales ETL Quality Check        [3 steps]        │
│ Validates all stages of sales ETL               │
│ File: sales_etl_quality_pipeline.yaml           │
│                 [📊 Open in Dagu] [🗑️ Delete]   │
├─────────────────────────────────────────────────┤
│ Customer Data Validation       [2 steps]        │
│ Daily customer data quality checks              │
│ File: customer_data_quality_pipeline.yaml       │
│                 [📊 Open in Dagu] [🗑️ Delete]   │
└─────────────────────────────────────────────────┘
```

### Delete Confirmation

```
┌─────────────────────────────────────────┐
│ ⚠️  Confirm Deletion                     │
├─────────────────────────────────────────┤
│ Are you sure you want to delete         │
│ "Sales ETL Quality Check"?              │
│                                         │
│ This will permanently remove the        │
│ pipeline file and cannot be undone.     │
│                                         │
│         [Cancel]      [Delete]          │
└─────────────────────────────────────────┘
```

### Success Message

```
┌─────────────────────────────────────────┐
│ ✅ Success!                              │
│ Pipeline "Sales ETL Quality Check"      │
│ deleted successfully!                   │
└─────────────────────────────────────────┘
```

## Backend API

### List Pipelines
```bash
GET /api/quality/pipelines

Response:
{
  "pipelines": [
    {
      "filename": "sales_etl_quality_pipeline.yaml",
      "name": "Sales ETL Quality Check - Quality Pipeline",
      "description": "Validates sales pipeline",
      "steps_count": 4,
      "dagu_url": "http://localhost:8080/dags/sales_etl_quality_pipeline"
    }
  ]
}
```

### Delete Pipeline
```bash
DELETE /api/quality/pipeline/{filename}

Response:
{
  "message": "Pipeline deleted successfully",
  "pipeline_name": "Sales ETL Quality Check",
  "filename": "sales_etl_quality_pipeline.yaml"
}
```

**Security:**
- Only files ending with `_quality_pipeline.yaml` can be deleted
- Protects system workflows (storage_cleanup, etc.)
- Returns 400 error for invalid filenames

## Use Cases

### Use Case 1: Remove Test Pipelines

**Scenario:** Created test pipelines during development

**Solution:**
1. Open Pipeline Builder
2. Expand "Existing Pipelines"
3. Find test pipeline
4. Click "🗑️ Delete"
5. Confirm deletion

**Result:** Test pipeline removed, production pipelines remain

### Use Case 2: Replace Old Pipeline

**Scenario:** Need to update pipeline configuration

**Workflow:**
1. Delete old pipeline
2. Create new pipeline with same name but updated steps
3. Old workflow removed, new workflow replaces it

**Result:** Clean replacement without duplicates

### Use Case 3: Clean Up After Project

**Scenario:** Project completed, pipeline no longer needed

**Solution:**
1. View existing pipelines
2. Delete project-specific pipelines
3. Keep only active pipelines

**Result:** Organized pipeline list

### Use Case 4: Audit Pipeline Inventory

**Scenario:** Review all quality pipelines

**Solution:**
1. Expand "Existing Pipelines"
2. Review each pipeline's description and steps
3. Delete deprecated pipelines
4. Document active pipelines

**Result:** Current inventory of quality checks

## Safety Features

### 1. **Confirmation Dialog**

Built-in browser confirmation prevents accidental deletion:
```javascript
if (!window.confirm(`Are you sure you want to delete "${pipelineName}"?...`)) {
  return; // Cancelled
}
```

### 2. **Filename Validation**

Backend only deletes quality pipeline files:
```python
if not filename.endswith('_quality_pipeline.yaml'):
    return jsonify({'error': 'Invalid pipeline filename'}), 400
```

**Protected Files:**
- `storage_cleanup.yaml` ✅ Protected
- `daily_quality_checks.yaml` ✅ Protected (system workflows)
- `sales_etl_quality_pipeline.yaml` ❌ Can be deleted (user-created)

### 3. **Not Found Handling**

If file doesn't exist, returns clear error:
```json
{
  "error": "Pipeline not found"
}
```

### 4. **Loading State**

Button shows "Deleting..." during operation to prevent double-clicks.

## Integration

### Dagu Sync

**After Deletion:**
1. Pipeline file removed from `backend/dags/`
2. Dagu automatically detects file removal
3. Pipeline disappears from Dagu UI (may need refresh)

**Note:** Dagu execution history preserved in database (not deleted).

### Storage Cleanup

**Quality Pipeline Files:**
- Not included in storage cleanup
- Must be manually deleted via GUI
- Intentional: Workflows are configuration, not data

**Execution Logs:**
- Cleaned up automatically (30 day retention)
- Part of Dagu logs cleanup

## Workflow

### Creating and Managing Pipelines

```
1. Create Pipeline
   ├── Fill in pipeline info
   ├── Add steps
   ├── Configure checks
   └── Click "Save Pipeline"
   
2. View Pipelines
   ├── Expand "Existing Pipelines"
   └── See all saved pipelines
   
3. Run Pipeline
   ├── Click "Open in Dagu"
   └── Start execution
   
4. Delete Pipeline
   ├── Click "Delete" button
   ├── Confirm deletion
   └── Pipeline removed
```

## Files Modified

### Backend
- ✅ `backend/api/quality.py`
  - Added `DELETE /api/quality/pipeline/<filename>` endpoint
  - Includes filename validation
  - Returns clear success/error messages

### Frontend
- ✅ `frontend/src/components/QualityBuilder/PipelineBuilder.jsx`
  - Added `existingPipelines` state
  - Added `loadExistingPipelines()` function
  - Added `deletePipeline()` function
  - Added collapsible "Existing Pipelines" section
  - Added delete confirmation
  - Added loading/error states
  - No linter errors

### Documentation
- ✅ `PIPELINE_MANAGEMENT_FEATURE.md` (this file)

## Testing

### Test Pipeline Listing

```bash
curl http://localhost:8000/api/quality/pipelines | jq
```

**Expected:** List of quality pipeline files

### Test Pipeline Deletion

```bash
# List pipelines
curl http://localhost:8000/api/quality/pipelines | jq '.pipelines[0].filename'

# Delete a pipeline
curl -X DELETE http://localhost:8000/api/quality/pipeline/test_quality_pipeline.yaml | jq

# Verify deleted
curl http://localhost:8000/api/quality/pipelines | jq
```

### Test in Browser

1. Navigate to http://localhost:3000/pipeline-builder
2. Click "Existing Pipelines (X)" to expand
3. Should see list of pipelines
4. Click "🗑️ Delete" on a test pipeline
5. Confirm deletion
6. Pipeline should disappear from list

## Error Handling

### Invalid Filename
```bash
curl -X DELETE http://localhost:8000/api/quality/pipeline/storage_cleanup.yaml
```

**Response:**
```json
{
  "error": "Invalid pipeline filename"
}
```

### File Not Found
```bash
curl -X DELETE http://localhost:8000/api/quality/pipeline/nonexistent_quality_pipeline.yaml
```

**Response:**
```json
{
  "error": "Pipeline not found"
}
```

### Frontend Error Display

Errors shown at top of page:
```
❌ Validation Error
   Failed to delete pipeline: [error message]
```

## Best Practices

### 1. **Review Before Delete**

- Click "📊 Open in Dagu" first
- Review pipeline structure
- Check execution history
- Confirm no active jobs

### 2. **Export Before Delete**

For important pipelines:
```bash
# Backup pipeline file
cp dags/important_quality_pipeline.yaml backups/
```

### 3. **Descriptive Names**

Use clear pipeline names so you know what you're deleting:
- ✅ "Sales ETL Quality Check"
- ❌ "Pipeline 1"

### 4. **Regular Cleanup**

Periodically review and remove:
- Test pipelines
- One-off validations
- Deprecated checks
- Duplicate pipelines

## Summary

✅ **View all quality pipelines** in collapsible section  
✅ **Delete pipelines** with confirmation dialog  
✅ **Open in Dagu** for execution and monitoring  
✅ **Auto-refresh** after create/delete  
✅ **Manual refresh** button available  
✅ **Safety validation** prevents deleting system workflows  
✅ **Clear success/error messages**  
✅ **No linter errors**  

Pipeline management is now fully integrated into the GUI, giving you complete control over your quality workflows without needing to manually edit files or use the command line.
