# Data Quality Pipeline Builder Guide

## Overview

The **Pipeline Builder** enables you to create multi-step data quality workflows that execute checks across multiple tables in sequence. Perfect for validating entire data pipelines from raw loading tables through to final fact tables.

## Key Features

### 🔗 Multi-Step Workflows
- Chain multiple quality checks together
- Execute checks in specific order
- Handle dependencies between steps

### ➕ Dynamic Step Management
- Add/remove steps with +/- buttons
- Reorder steps with ▲▼ controls
- Configure each step independently

### 🎯 Flexible Configuration
- Select database, schema, table for each step
- Choose multiple checks per table
- Set failure behavior (continue or stop)

### 📊 Dagu Integration
- Generates Dagu YAML workflows automatically
- Workflows appear in Dagu UI immediately
- Manual or scheduled execution

## Use Case: Data Pipeline Quality Check

**Scenario:** Sales ETL pipeline with multiple stages

```
Pipeline: "Sales ETL Quality Check"
├── Step 1: Check loading table (raw data validation)
│   ├── Table: raw.sales_staging
│   └── Checks: not_null, row_count
│
├── Step 2: Check staging table (transformation validation)
│   ├── Table: staging.sales_cleaned
│   └── Checks: not_null, unique, value_range
│
├── Step 3: Check dimension tables (reference data)
│   ├── Table: dim.Customer
│   └── Checks: unique, not_null, referential_integrity
│
└── Step 4: Check fact tables (final data quality)
    ├── Table: fact.Sales
    └── Checks: not_null, referential_integrity, freshness
```

## How to Use

### 1. Navigate to Pipeline Builder

```
Main Navigation → Pipeline Builder
```

### 2. Create Pipeline

#### A. Pipeline Information

**Pipeline Name** (required)
- Descriptive name for your workflow
- Example: "Sales ETL Quality Check"

**Description** (optional)
- Explain the purpose of this pipeline
- Example: "Validates data quality across all stages of the sales ETL process"

#### B. Add Quality Check Steps

Click **"➕ Add Step"** to add a new check step.

For each step, configure:

**Step Name** (required)
- Descriptive name for this check
- Example: "Check Loading Table", "Validate Dimensions"

**Connection** (required)
- Select database connection
- Must be configured in Config Manager

**Schema** (required)
- Database schema containing the table
- Populated after connection selection

**Table** (required)
- Target table for quality checks
- Populated after schema selection

**Quality Checks** (select at least one)
- ☑️ **Not Null** - Column values must not be null
- ☑️ **Unique Values** - Column values must be unique
- ☑️ **Value Range** - Numeric values within expected range
- ☑️ **Value Set** - Values in allowed set
- ☑️ **Row Count** - Expected row count range
- ☑️ **Data Freshness** - Recent data updates
- ☑️ **Referential Integrity** - Foreign keys valid
- ☑️ **Pattern Match** - Regex pattern validation

**On Failure**
- **Continue to next step** - Log error, continue pipeline
- **Stop pipeline** - Halt execution on first failure

### 3. Manage Steps

**Reorder Steps:**
- Click ▲ to move step up
- Click ▼ to move step down
- Steps execute in displayed order

**Remove Steps:**
- Click "✕ Remove" button
- Must have at least 1 step

### 4. Save Pipeline

Click **"💾 Save Pipeline"** button.

Pipeline is saved as Dagu workflow and available immediately.

### 5. Run Pipeline

**Option 1: Via Dagu UI**
1. Click "📊 View Pipelines in Dagu"
2. Find your pipeline
3. Click "Start" button

**Option 2: Via API**
```bash
curl -X POST http://localhost:8080/api/v2/dags/sales_etl_quality_pipeline/start
```

**Option 3: Schedule**
Edit the generated YAML file to add a cron schedule:
```yaml
schedule: "0 2 * * *"  # Daily at 2 AM
```

## Available Quality Checks

### Completeness Checks

**Not Null**
- Validates columns don't contain NULL values
- Critical for required fields
- Example: Customer ID, Order Date

### Uniqueness Checks

**Unique Values**
- Validates no duplicate values
- Essential for primary keys
- Example: Email addresses, SKUs

### Validity Checks

**Value Range**
- Numeric values within expected bounds
- Example: Age 0-120, Price > 0

**Value Set**
- Values match allowed options
- Example: Status in ['Active', 'Inactive']

**Pattern Match**
- Values match regex pattern
- Example: Email format, Phone format

### Volume Checks

**Row Count**
- Table has expected row count
- Detects data loss or duplication
- Example: Expect 1000-2000 daily orders

### Timeliness Checks

**Data Freshness**
- Data updated within time window
- Detects stale data
- Example: Updated within last 24 hours

### Consistency Checks

**Referential Integrity**
- Foreign keys reference valid records
- Prevents orphaned records
- Example: OrderID exists in Orders table

## Example Pipelines

### Example 1: Simple Data Load Validation

**Pipeline:** "Daily Customer Load"

**Step 1: Validate Loaded Data**
- Table: `staging.customers_daily`
- Checks: not_null (CustomerID), row_count, freshness
- On Failure: Stop pipeline

### Example 2: Multi-Stage ETL

**Pipeline:** "Product Catalog ETL"

**Step 1: Check Raw Extract**
- Table: `raw.products_staging`
- Checks: not_null, row_count
- On Failure: Stop pipeline

**Step 2: Validate Transformations**
- Table: `staging.products_cleaned`
- Checks: not_null, unique (SKU), value_range (Price)
- On Failure: Stop pipeline

**Step 3: Verify Dimensions**
- Table: `dim.Product`
- Checks: unique, not_null, pattern (SKU format)
- On Failure: Stop pipeline

**Step 4: Check Fact Table**
- Table: `fact.ProductSales`
- Checks: referential_integrity, row_count
- On Failure: Continue

### Example 3: Data Warehouse Refresh

**Pipeline:** "DW Nightly Refresh Quality"

**Step 1: Dimension - Customer**
- Table: `dim.Customer`
- Checks: unique, not_null, freshness
- On Failure: Continue

**Step 2: Dimension - Product**
- Table: `dim.Product`
- Checks: unique, not_null
- On Failure: Continue

**Step 3: Dimension - Date**
- Table: `dim.Date`
- Checks: row_count, unique
- On Failure: Continue

**Step 4: Fact - Sales**
- Table: `fact.Sales`
- Checks: not_null, referential_integrity, row_count
- On Failure: Stop pipeline

## Generated Dagu Workflow

When you save a pipeline, a Dagu YAML file is generated:

### File Location
```
backend/dags/[pipeline_name]_quality_pipeline.yaml
```

### Example Output
```yaml
name: Sales ETL Quality Check - Quality Pipeline
description: Validates data quality across all stages
schedule: ''  # Manual trigger
params: RETENTION_DAYS=30

steps:
  - name: check_loading_table
    description: Run quality checks on raw.sales_staging
    command: |
      echo "=== Check Loading Table ==="
      echo "Table: raw.sales_staging"
      echo "Checks: not_null,row_count"
      
      RESPONSE=$(curl -s -X POST http://backend:8000/api/quality/run-checks \
        -H "Content-Type: application/json" \
        -d '{"connection_id": "local", "schema": "raw", "table": "sales_staging", "checks": ["not_null","row_count"]}')
      
      if echo "$RESPONSE" | jq -e '.check_id' > /dev/null 2>&1; then
        echo "✅ Quality checks passed!"
        CHECK_ID=$(echo "$RESPONSE" | jq -r '.check_id')
        echo "Check ID: $CHECK_ID"
      else
        echo "❌ Quality checks failed"
        exit 1
      fi
  
  - name: check_staging_table
    description: Run quality checks on staging.sales_cleaned
    command: |
      # ... similar structure ...
    depends:
      - check_loading_table
  
  # ... more steps ...
  
  - name: pipeline_summary
    description: Display pipeline completion summary
    command: |
      echo "✅ Pipeline completed successfully!"
    depends:
      - check_fact_tables
```

## Monitoring & Execution

### Dagu UI

Navigate to: http://localhost:8080

**Features:**
- View all pipelines
- Start/stop execution
- Monitor progress in real-time
- View logs for each step
- See execution history

### Execution Flow

```
Pipeline Start
  ↓
Step 1 Execute
  ↓ (success)
Step 2 Execute
  ↓ (success)
Step 3 Execute
  ↓ (failure, on_failure=stop)
Pipeline Stopped ❌
```

**OR:**

```
Pipeline Start
  ↓
Step 1 Execute
  ↓ (success)
Step 2 Execute
  ↓ (failure, on_failure=continue)
  ↓ (logged, continue)
Step 3 Execute
  ↓ (success)
Pipeline Complete ✅
```

### Check Results

Each step generates a check result with ID:

```bash
# View specific check result
curl http://localhost:8000/api/quality/results/{check_id}
```

Results include:
- Check ID and timestamp
- Connection and table info
- Pass/fail status for each check
- Detailed error messages
- Summary statistics

## Best Practices

### 1. **Order Steps Logically**

Follow data flow:
```
Raw → Staging → Dimensions → Facts
```

### 2. **Use "Stop on Failure" for Critical Checks**

Early stages should stop on failure:
- Loading table validation: **Stop**
- Staging transformation: **Stop**
- Dimension updates: **Continue**
- Fact table loads: **Continue**

Rationale: No point checking facts if raw data failed.

### 3. **Group Related Checks**

One step per table:
- ✅ Good: "Check Customer Dimension" with multiple checks
- ❌ Bad: Separate steps for each check type

### 4. **Name Steps Descriptively**

- ✅ Good: "Validate Sales Staging Table"
- ❌ Bad: "Step 1", "Check"

### 5. **Document in Description**

Include context in pipeline description:
```
"Validates all stages of the nightly sales ETL process.
Runs after ETL completion, before dashboard refresh.
Alerts on failure via email (configured in Dagu)."
```

### 6. **Start Simple**

Begin with essential checks:
1. Not Null on key columns
2. Row count validation
3. Freshness checks

Add more checks after baseline is stable.

### 7. **Test Pipelines**

1. Create pipeline
2. Run manually in Dagu
3. Verify all steps execute
4. Check logs for errors
5. Add schedule only after validation

## Troubleshooting

### Issue: Step Fails Immediately

**Possible Causes:**
- Connection not available
- Table doesn't exist
- Schema/table permissions

**Solution:**
```bash
# Test connection
curl http://localhost:8000/api/connections

# Test table access
curl http://localhost:8000/api/catalog/discover \
  -d '{"connection_id": "local"}'
```

### Issue: Pipeline Not Appearing in Dagu

**Cause:** Dagu caches workflow list

**Solution:**
1. Refresh Dagu UI (F5)
2. Or restart Dagu: `docker-compose restart dagu`

### Issue: Checks Timeout

**Cause:** Large tables take time

**Solution:**
- Add timeout to Dagu step
- Sample data instead of full scan
- Run during off-peak hours

### Issue: Too Many False Positives

**Cause:** Thresholds too strict

**Solution:**
- Adjust check parameters
- Use value ranges instead of exact values
- Allow small percentage of nulls

## Integration with Other Features

### Data Catalog

Use catalog to:
- Browse tables for pipeline
- View table metadata
- Understand relationships
- Export documentation

### Quality Builder

Use for:
- Single table checks
- Ad-hoc validation
- Testing check logic
- One-off analysis

### Scheduler

Use for:
- Scheduling pipelines
- Managing dependencies
- Monitoring execution
- Historical tracking

## API Reference

### Create Pipeline
```bash
POST /api/quality/pipeline

{
  "name": "Sales ETL Quality Check",
  "description": "Validates sales pipeline",
  "steps": [
    {
      "order": 1,
      "name": "Check Loading",
      "connection_id": "local",
      "schema": "raw",
      "table": "sales_staging",
      "checks": ["not_null", "row_count"],
      "on_failure": "stop"
    }
  ]
}
```

### List Pipelines
```bash
GET /api/quality/pipelines
```

### Get Available Checks
```bash
GET /api/quality/available-checks
```

## Summary

The Pipeline Builder enables you to:

✅ **Create multi-step quality workflows**
✅ **Validate entire data pipelines**
✅ **Chain checks in logical order**
✅ **Handle failures gracefully**
✅ **Generate Dagu workflows automatically**
✅ **Monitor execution in real-time**
✅ **Reuse pipelines across projects**

Perfect for ensuring data quality across complex ETL processes, from raw ingestion through to analytics-ready tables.
