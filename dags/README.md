# Data Quality DAGs

This directory contains Dagu workflow definitions (DAGs) for automated data quality pipelines.

## Available DAGs

### 1. **daily_quality_checks.yaml**
**Schedule:** Daily at 2 AM  
**Purpose:** Comprehensive data quality checks on critical tables

**Checks:**
- Customer data validation (NULL, unique, email format)
- Product data validation (NULL, price range)
- Order data validation (row count, dates, freshness)

**Output:** Daily quality report in `/var/lib/dagu/logs/`

---

### 2. **datekey_validation_pipeline.yaml**
**Schedule:** Daily at 6 AM  
**Purpose:** Validate all integer date keys (YYYYMMDD format)

**Checks:**
- OrderDateKey validation (20200101 - 20301231)
- ShipDateKey validation (20200101 - 20301231)
- Date dimension integrity

**Output:** Date key validation report in `/var/lib/dagu/logs/`

---

### 3. **adhoc_table_quality_check.yaml**
**Schedule:** Manual/On-demand  
**Purpose:** Flexible quality check for any specified table

**Parameters:**
- `schema` - Database schema (default: SalesLT)
- `table` - Table name (default: Customer)
- `connection_id` - Connection ID (default: local_adventureworks)

**Usage:**
```bash
# Run via Dagu UI or API
dagu start adhoc_table_quality_check schema=SalesLT table=Product
```

**Output:** Quality profile JSON in `/var/lib/dagu/logs/`

---

### 4. **quality_monitoring_dashboard.yaml**
**Schedule:** Every 6 hours  
**Purpose:** Track data quality metrics and trends

**Features:**
- Discovers all tables automatically
- Collects statistics over time
- Trend analysis
- Quality degradation alerts
- Dashboard data generation

**Output:** 
- Statistics: `/var/lib/dagu/data/table_stats_*.json`
- Dashboard: `/var/lib/dagu/data/dashboard_latest.json`
- Trends: `/var/lib/dagu/logs/quality_trends_*.txt`

---

## DAG Structure

Each DAG file follows this structure:

```yaml
name: DAG Name
description: What this DAG does
tags:
  - category1
  - category2

schedule: "cron expression"  # Optional

params:  # Optional runtime parameters
  - name: param_name
    default: default_value

env:  # Environment variables
  - KEY: value

steps:
  - name: step_name
    description: What this step does
    command: |
      # Shell commands
    depends:  # Optional dependencies
      - previous_step
    output: VARIABLE_NAME  # Capture output

handlerOn:  # Optional handlers
  success:
    - name: on_success_action
      command: |
        # Commands to run on success
  failure:
    - name: on_failure_action
      command: |
        # Commands to run on failure
```

## Running DAGs

### Via Dagu Web UI

1. Open http://localhost:8080
2. Browse available DAGs
3. Click on a DAG to view details
4. Click "Run" to execute

### Via Dagu CLI

```bash
# List all DAGs
docker exec ms3dm_dagu dagu status

# Run a DAG
docker exec ms3dm_dagu dagu start daily_quality_checks

# Run with parameters
docker exec ms3dm_dagu dagu start adhoc_table_quality_check \
  -p "schema=SalesLT" \
  -p "table=Product"

# Stop a running DAG
docker exec ms3dm_dagu dagu stop daily_quality_checks

# View DAG history
docker exec ms3dm_dagu dagu history daily_quality_checks

# Retry failed DAG
docker exec ms3dm_dagu dagu retry daily_quality_checks
```

### Via REST API

```bash
# Trigger a DAG
curl -X POST http://localhost:8080/dags/daily_quality_checks/start

# Trigger with parameters
curl -X POST http://localhost:8080/dags/adhoc_table_quality_check/start \
  -H "Content-Type: application/json" \
  -d '{"params": {"schema": "SalesLT", "table": "Product"}}'

# Get DAG status
curl http://localhost:8080/dags/daily_quality_checks/status

# Get DAG logs
curl http://localhost:8080/dags/daily_quality_checks/logs
```

## Viewing Results

### Quality Reports
```bash
# Latest daily report
cat /Users/ryanfranklin/repos/ms3dm_toolkit/dagu/logs/quality_report_$(date +%Y%m%d).txt

# Latest date key report
cat /Users/ryanfranklin/repos/ms3dm_toolkit/dagu/logs/datekey_report_$(date +%Y%m%d).txt

# Quality trends
ls -lt /Users/ryanfranklin/repos/ms3dm_toolkit/dagu/logs/quality_trends_*.txt | head -1
```

### Dashboard Data
```bash
# Latest dashboard snapshot
cat /Users/ryanfranklin/repos/ms3dm_toolkit/dagu/data/dashboard_latest.json | jq '.'

# Historical statistics
ls /Users/ryanfranklin/repos/ms3dm_toolkit/dagu/data/table_stats_*.json
```

### Alert Logs
```bash
# Quality degradation alerts
tail -f /Users/ryanfranklin/repos/ms3dm_toolkit/dagu/logs/quality_alerts.log

# Health status log
tail -f /Users/ryanfranklin/repos/ms3dm_toolkit/dagu/logs/quality_health.log
```

## Creating New DAGs

### Template

```yaml
name: My Custom Quality Check
description: Description of what this checks
tags:
  - data-quality
  - custom

schedule: "0 3 * * *"  # 3 AM daily

env:
  - API_URL: http://backend:8000
  - CONNECTION_ID: local_adventureworks

steps:
  - name: my_check
    description: What I'm checking
    command: |
      curl -X POST ${API_URL}/api/expectations/run-adhoc \
        -H "Content-Type: application/json" \
        -d '{
          "name": "My Check",
          "connection_id": "'${CONNECTION_ID}'",
          "expectations": [
            {
              "type": "expect_column_values_to_not_be_null",
              "column": "ColumnName",
              "target": {"schema": "SchemaName", "table": "TableName"}
            }
          ]
        }'
    output: CHECK_RESULTS

  - name: report_results
    depends:
      - my_check
    command: |
      echo "Results: ${CHECK_RESULTS}" | jq '.'
```

### Best Practices

1. **Use Descriptive Names**: Make DAG and step names clear
2. **Add Dependencies**: Use `depends` to ensure correct execution order
3. **Capture Output**: Use `output` to pass data between steps
4. **Add Error Handlers**: Use `handlerOn` for failure/success actions
5. **Tag Appropriately**: Use tags for organization
6. **Document Parameters**: Add comments for any parameters
7. **Test Locally**: Run manually before scheduling

## Integration with Quality Builder

DAGs automatically integrate with the Quality Builder API:

```
Quality Builder UI → Save Suite → Generate DAG → Schedule in Dagu
```

To manually convert a Quality Builder suite to a DAG:

1. Export suite configuration from Quality Builder
2. Use the suite JSON in a DAG step's curl command
3. Schedule the DAG in Dagu

## Monitoring & Alerts

### Built-in Monitoring

- **Dagu UI**: http://localhost:8080 shows execution history
- **Logs**: All step output captured in `/var/lib/dagu/logs/`
- **Metrics**: Historical data in `/var/lib/dagu/data/`

### Custom Alerts

Add alert steps using `handlerOn`:

```yaml
handlerOn:
  failure:
    - name: send_alert
      command: |
        # Send email, Slack message, etc.
        echo "Alert: Pipeline failed at $(date)"
  
  success:
    - name: notify_success
      command: |
        echo "Success: All checks passed"
```

## Troubleshooting

### DAG Won't Run

```bash
# Check DAG syntax
docker exec ms3dm_dagu dagu validate /var/lib/dagu/dags/your_dag.yaml

# Check logs
docker logs ms3dm_dagu

# Verify permissions
ls -la /Users/ryanfranklin/repos/ms3dm_toolkit/dags/
```

### API Connection Issues

```bash
# Test backend connectivity
docker exec ms3dm_dagu curl http://backend:8000/

# Check network
docker network inspect ms3dm_toolkit_default
```

### Missing Output Files

```bash
# Check volume mounts
docker inspect ms3dm_dagu | jq '.[0].Mounts'

# Verify directories exist
ls -la /Users/ryanfranklin/repos/ms3dm_toolkit/dagu/
```

## Cron Schedule Examples

```
"0 2 * * *"     # Daily at 2 AM
"0 */6 * * *"   # Every 6 hours
"0 8 * * 1"     # Every Monday at 8 AM
"*/15 * * * *"  # Every 15 minutes
"0 0 1 * *"     # First day of month at midnight
"0 9 * * 1-5"   # Weekdays at 9 AM
```

## Next Steps

1. Review example DAGs
2. Test DAGs manually in Dagu UI
3. Customize schedules and parameters
4. Create custom DAGs for your needs
5. Set up monitoring and alerts
6. Integrate with your CI/CD pipeline

---

**Dagu UI:** http://localhost:8080  
**API Docs:** https://docs.dagu.io/  
**Support:** Check Dagu logs or UI for execution details
