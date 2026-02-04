## ✅ Dagu Integration Complete!

I've successfully integrated **Dagu workflow orchestration** into your MS3DM Toolkit for automated data quality pipelines!

### 🎯 **What Was Added**

**1. Docker Setup**
- Added Dagu service to `docker-compose.yml`
- Configured on port 8080 with persistent volumes
- Connected to your backend and SQL Server

**2. Pipeline Structure**
```
dags/                           ← DAG definitions
├── daily_quality_checks.yaml          (scheduled daily)
├── datekey_validation_pipeline.yaml   (scheduled daily)
├── adhoc_table_quality_check.yaml     (on-demand)
├── quality_monitoring_dashboard.yaml  (every 6 hours)
└── README.md                          (full documentation)

dagu/
├── data/                      ← Statistics & metrics
└── logs/                      ← Execution logs & reports
```

**3. Pre-built DAG Pipelines**
- ✅ Daily comprehensive quality checks
- ✅ Date key validation pipeline
- ✅ On-demand table quality checks
- ✅ Quality monitoring with trend analysis

### 🚀 **Getting Started**

#### 1. Start Dagu
```bash
# Start all services (including Dagu)
docker-compose up -d

# Or start just Dagu
docker-compose up -d dagu

# Check status
docker ps | grep dagu
```

#### 2. Access Dagu UI
Open your browser to: **http://localhost:8080**

You'll see:
- 📊 Dashboard with all DAGs
- ⏰ Execution history
- 📈 Performance metrics
- 🔔 Alert status

#### 3. Run Your First Pipeline
```bash
# Via UI: Click "daily_quality_checks" → "Run"

# Via CLI:
docker exec ms3dm_dagu dagu start daily_quality_checks

# Via API:
curl -X POST http://localhost:8080/dags/daily_quality_checks/start
```

### 📦 **Available Pipelines**

#### **1. Daily Quality Checks** 
**Schedule:** 2 AM daily  
**Purpose:** Validate Customer, Product, and Order data

**What it checks:**
- Customer: NULL values, unique IDs, email format
- Product: NULL values, price ranges
- Orders: Row counts, dates, freshness

**Output:** `/dagu/logs/quality_report_YYYYMMDD.txt`

---

#### **2. Date Key Validation**
**Schedule:** 6 AM daily  
**Purpose:** Validate integer date keys (your new feature!)

**What it checks:**
- OrderDateKey (20200101 - 20301231)
- ShipDateKey (20200101 - 20301231)  
- Date dimension integrity

**Output:** `/dagu/logs/datekey_report_YYYYMMDD.txt`

---

#### **3. Ad-Hoc Table Check**
**Schedule:** On-demand  
**Purpose:** Check any table on command

**Parameters:**
```bash
dagu start adhoc_table_quality_check \
  -p "schema=SalesLT" \
  -p "table=Product" \
  -p "connection_id=local_adventureworks"
```

**Output:** `/dagu/logs/quality_profile_SCHEMA_TABLE_TIMESTAMP.json`

---

#### **4. Quality Monitoring Dashboard**
**Schedule:** Every 6 hours  
**Purpose:** Track quality trends over time

**Features:**
- Auto-discovers all tables
- Collects statistics
- Trend analysis
- Quality degradation alerts

**Output:** `/dagu/data/dashboard_latest.json`

### 🛠️ **Configuration**

#### Environment Variables
All DAGs use these environment variables:

```yaml
env:
  - API_URL: http://backend:8000              # Your backend
  - CONNECTION_ID: local_adventureworks        # Database connection
```

Update in DAG files or pass as parameters.

#### Schedules
Modify cron expressions in DAG files:

```yaml
schedule: "0 2 * * *"    # 2 AM daily
schedule: "0 */6 * * *"  # Every 6 hours
schedule: "*/15 * * * *" # Every 15 minutes
# No schedule = manual/on-demand
```

### 📊 **Viewing Results**

#### Quality Reports
```bash
# Today's daily report
cat dagu/logs/quality_report_$(date +%Y%m%d).txt

# Today's date key report
cat dagu/logs/datekey_report_$(date +%Y%m%d).txt

# Latest quality trends
ls -t dagu/logs/quality_trends_*.txt | head -1 | xargs cat
```

#### Dashboard Data
```bash
# Latest statistics
cat dagu/data/dashboard_latest.json | jq '.summary'

# Historical data points
ls dagu/data/table_stats_*.json | wc -l
```

#### Execution Logs
```bash
# View Dagu container logs
docker logs ms3dm_dagu -f

# View specific DAG execution
docker exec ms3dm_dagu dagu history daily_quality_checks
```

### 🎨 **Integration with Quality Builder**

Dagu pipelines use your Quality Builder API:

```
Quality Builder UI
    ↓
Configure Checks
    ↓
Run Adhoc → Immediate results
    ↓
Create DAG → Scheduled pipeline
    ↓
Monitor in Dagu UI
```

**Example Flow:**
1. Use Quality Builder to design checks
2. Test with "Run Checks" button
3. Copy configuration to a new DAG file
4. Schedule in Dagu for automation

### 🔄 **Common Operations**

#### List All DAGs
```bash
docker exec ms3dm_dagu dagu status
```

#### Run a Pipeline
```bash
# Start execution
docker exec ms3dm_dagu dagu start daily_quality_checks

# With parameters
docker exec ms3dm_dagu dagu start adhoc_table_quality_check \
  -p "schema=SalesLT" \
  -p "table=Customer"
```

#### Stop a Running Pipeline
```bash
docker exec ms3dm_dagu dagu stop daily_quality_checks
```

#### View History
```bash
docker exec ms3dm_dagu dagu history daily_quality_checks
```

#### Retry Failed Execution
```bash
docker exec ms3dm_dagu dagu retry daily_quality_checks
```

#### Validate DAG Syntax
```bash
docker exec ms3dm_dagu dagu validate /var/lib/dagu/dags/your_dag.yaml
```

### 🔌 **REST API**

Trigger pipelines programmatically:

```bash
# Start a DAG
curl -X POST http://localhost:8080/dags/daily_quality_checks/start

# With parameters
curl -X POST http://localhost:8080/dags/adhoc_table_quality_check/start \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "schema": "SalesLT",
      "table": "Product"
    }
  }'

# Get status
curl http://localhost:8080/dags/daily_quality_checks/status

# Get logs
curl http://localhost:8080/dags/daily_quality_checks/logs

# List all DAGs
curl http://localhost:8080/dags
```

### 📝 **Creating Custom Pipelines**

1. **Create new YAML file in `dags/` directory**

```yaml
name: My Custom Pipeline
description: What this pipeline does
tags:
  - data-quality
  - custom

schedule: "0 3 * * *"  # 3 AM daily

env:
  - API_URL: http://backend:8000
  - CONNECTION_ID: local_adventureworks

steps:
  - name: run_checks
    command: |
      curl -X POST ${API_URL}/api/expectations/run-adhoc \
        -H "Content-Type: application/json" \
        -d '{
          "name": "My Checks",
          "connection_id": "'${CONNECTION_ID}'",
          "expectations": [...]
        }'
    output: RESULTS

  - name: report
    depends:
      - run_checks
    command: |
      echo "${RESULTS}" | jq '.'
```

2. **Reload Dagu to pick up new DAG**

```bash
docker restart ms3dm_dagu
```

3. **Verify it appears in UI**

Navigate to http://localhost:8080

### ⚠️ **Troubleshooting**

#### Dagu UI Not Accessible
```bash
# Check if container is running
docker ps | grep dagu

# Check logs
docker logs ms3dm_dagu

# Restart
docker-compose restart dagu
```

#### DAG Not Showing Up
```bash
# Check file exists
ls dags/

# Validate syntax
docker exec ms3dm_dagu dagu validate /var/lib/dagu/dags/your_dag.yaml

# Restart Dagu
docker restart ms3dm_dagu
```

#### API Connection Failed
```bash
# Test backend from Dagu container
docker exec ms3dm_dagu curl http://backend:8000/

# Check network
docker network inspect ms3dm_toolkit_default
```

#### Permission Denied on Logs
```bash
# Fix permissions
chmod -R 777 dagu/logs dagu/data

# Or in docker-compose, add user mapping
```

### 🎯 **Benefits**

✅ **Automated Quality Checks**: Run checks on schedule  
✅ **Orchestration**: Complex multi-step workflows  
✅ **Dependency Management**: Steps run in correct order  
✅ **Error Handling**: Automatic retries and alerts  
✅ **History & Audit**: Full execution history  
✅ **Monitoring**: Track quality trends over time  
✅ **Flexible**: Trigger manually or via API  
✅ **Lightweight**: No heavy dependencies  

### 📚 **Next Steps**

1. ✅ **Explore Dagu UI** - http://localhost:8080
2. ✅ **Run example pipelines** - Test each DAG
3. ✅ **View results** - Check logs and reports
4. ✅ **Customize schedules** - Adjust cron expressions
5. ✅ **Create custom DAGs** - Add your own pipelines
6. ✅ **Set up alerts** - Configure notifications
7. ✅ **Monitor trends** - Review dashboard data

### 🔗 **Resources**

- **Dagu UI**: http://localhost:8080
- **Dagu Docs**: https://docs.dagu.io/
- **DAG Examples**: `/dags/README.md`
- **Quality Builder**: http://localhost:5173/quality-builder

### 🎉 **You're All Set!**

Your data quality pipelines are now automated and orchestrated with Dagu. Start the services and watch your first pipeline run!

```bash
# Start everything
docker-compose up -d

# Watch logs
docker logs -f ms3dm_dagu

# Open UI
open http://localhost:8080
```

---

**Happy Data Quality Orchestration! 🚀**
