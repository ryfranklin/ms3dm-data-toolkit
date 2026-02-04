# 🚀 Dagu Quick Start - Data Quality Pipelines

## Start Dagu in 3 Steps

### 1. Start the Services
```bash
docker-compose up -d
```

### 2. Open Dagu UI
```
http://localhost:8080
```

### 3. Run Your First Pipeline
Click on **"daily_quality_checks"** → Click **"Run"**

---

## What You Get

### 📊 **4 Pre-Built Pipelines**

1. **Daily Quality Checks** (2 AM daily)
   - Validates Customer, Product, and Order data
   - Email format, NULL checks, price ranges
   
2. **Date Key Validation** (6 AM daily)
   - Validates YYYYMMDD date keys
   - Checks OrderDateKey, ShipDateKey, Date Dimension

3. **Ad-Hoc Table Check** (On-demand)
   - Check any table instantly
   - Pass schema/table as parameters

4. **Quality Monitoring** (Every 6 hours)
   - Tracks quality trends
   - Auto-discovers all tables
   - Generates dashboard data

---

## Quick Commands

### View All DAGs
```bash
docker exec ms3dm_dagu dagu status
```

### Run a Pipeline
```bash
docker exec ms3dm_dagu dagu start daily_quality_checks
```

### Check with Custom Table
```bash
docker exec ms3dm_dagu dagu start adhoc_table_quality_check \
  -p "schema=SalesLT" \
  -p "table=Product"
```

### View Execution History
```bash
docker exec ms3dm_dagu dagu history daily_quality_checks
```

### Stop a Running Pipeline
```bash
docker exec ms3dm_dagu dagu stop daily_quality_checks
```

---

## View Results

### Quality Reports
```bash
# Today's daily quality report
cat dagu/logs/quality_report_$(date +%Y%m%d).txt

# Date key validation report
cat dagu/logs/datekey_report_$(date +%Y%m%d).txt

# Quality trends
ls -t dagu/logs/quality_trends_*.txt | head -1 | xargs cat
```

### Dashboard Data
```bash
# Latest dashboard snapshot
cat dagu/data/dashboard_latest.json | jq '.summary'

# Count historical data points
ls dagu/data/table_stats_*.json | wc -l
```

---

## REST API

### Trigger Pipeline
```bash
curl -X POST http://localhost:8080/dags/daily_quality_checks/start
```

### With Parameters
```bash
curl -X POST http://localhost:8080/dags/adhoc_table_quality_check/start \
  -H "Content-Type: application/json" \
  -d '{"params": {"schema": "SalesLT", "table": "Product"}}'
```

### Get Status
```bash
curl http://localhost:8080/dags/daily_quality_checks/status
```

---

## Create Your Own Pipeline

### 1. Create YAML File
```bash
nano dags/my_custom_checks.yaml
```

### 2. Basic Template
```yaml
name: My Custom Quality Checks
description: What this pipeline does
schedule: "0 3 * * *"  # 3 AM daily

env:
  - API_URL: http://backend:8000
  - CONNECTION_ID: local_adventureworks

steps:
  - name: run_my_checks
    command: |
      curl -X POST ${API_URL}/api/expectations/run-adhoc \
        -H "Content-Type: application/json" \
        -d '{
          "name": "My Checks",
          "connection_id": "'${CONNECTION_ID}'",
          "expectations": [
            {
              "type": "expect_column_values_to_not_be_null",
              "column": "YourColumn",
              "target": {"schema": "YourSchema", "table": "YourTable"}
            }
          ]
        }'
    output: RESULTS

  - name: show_results
    depends:
      - run_my_checks
    command: |
      echo "${RESULTS}" | jq '.statistics'
```

### 3. Restart Dagu
```bash
docker restart ms3dm_dagu
```

### 4. Run It
```bash
docker exec ms3dm_dagu dagu start my_custom_checks
```

---

## Schedule Format (Cron)

```
"0 2 * * *"     # Daily at 2 AM
"0 */6 * * *"   # Every 6 hours
"0 8 * * 1"     # Every Monday at 8 AM
"*/15 * * * *"  # Every 15 minutes
"0 0 1 * *"     # First day of month
"0 9 * * 1-5"   # Weekdays at 9 AM
```

Leave blank for manual/on-demand execution.

---

## Troubleshooting

### Dagu UI Not Loading
```bash
# Check if running
docker ps | grep dagu

# Check logs
docker logs ms3dm_dagu

# Restart
docker restart ms3dm_dagu
```

### DAG Not Showing
```bash
# Validate syntax
docker exec ms3dm_dagu dagu validate /var/lib/dagu/dags/your_dag.yaml

# Restart to reload
docker restart ms3dm_dagu
```

### API Connection Failed
```bash
# Test from Dagu container
docker exec ms3dm_dagu curl http://backend:8000/
```

---

## Integration with Quality Builder

### Workflow
```
1. Design checks in Quality Builder UI
   ↓
2. Test with "Run Checks" button
   ↓
3. Copy configuration to DAG file
   ↓
4. Schedule in Dagu
   ↓
5. Monitor in Dagu UI
```

### Example
```yaml
# From Quality Builder:
{
  "type": "expect_column_values_to_not_be_null",
  "column": "CustomerID",
  "target": {"schema": "SalesLT", "table": "Customer"}
}

# To DAG:
- name: check_customer_id
  command: |
    curl -X POST ${API_URL}/api/expectations/run-adhoc \
      -H "Content-Type: application/json" \
      -d '{
        "expectations": [{
          "type": "expect_column_values_to_not_be_null",
          "column": "CustomerID",
          "target": {"schema": "SalesLT", "table": "Customer"}
        }]
      }'
```

---

## Key Features

✅ **Automated Scheduling** - Run checks on cron schedule  
✅ **Dependency Management** - Steps run in order  
✅ **Error Handling** - Automatic retries and alerts  
✅ **Output Capture** - Pass data between steps  
✅ **History & Audit** - Full execution history  
✅ **REST API** - Trigger programmatically  
✅ **Web UI** - Visual monitoring and control  
✅ **Lightweight** - No database or message broker needed  

---

## Next Steps

1. ✅ **Explore UI** - Browse DAGs and history
2. ✅ **Run examples** - Test each pipeline
3. ✅ **View reports** - Check generated reports
4. ✅ **Customize** - Adjust schedules and parameters
5. ✅ **Create custom** - Build your own pipelines
6. ✅ **Monitor** - Track quality over time

---

## Resources

- **Dagu UI**: http://localhost:8080
- **Quality Builder**: http://localhost:5173/quality-builder
- **Full Guide**: [DAGU_INTEGRATION_GUIDE.md](DAGU_INTEGRATION_GUIDE.md)
- **DAG Examples**: [dags/README.md](dags/README.md)
- **Dagu Docs**: https://docs.dagu.io/

---

**You're ready to orchestrate data quality! 🎉**

```bash
docker-compose up -d && open http://localhost:8080
```
