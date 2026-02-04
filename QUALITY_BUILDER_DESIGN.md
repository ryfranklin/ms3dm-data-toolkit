# Visual Data Quality Builder - Design Document

## Overview

A visual interface for building, configuring, and executing data quality checks on ETL pipelines, inspired by Great Expectations but integrated directly into the MS3DM Toolkit.

## User Journey

```
1. Select Target (Table/Column/Flow)
   ↓
2. Choose Expectations (from library)
   ↓
3. Configure Parameters (thresholds, rules)
   ↓
4. Test & Validate (run checks)
   ↓
5. Save Suite (for reuse)
   ↓
6. Schedule/Monitor (ongoing validation)
```

## Component Architecture

### 1. **Expectation Library** (Left Sidebar)

Visual catalog of available checks, organized by category:

#### **Column-Level Checks**
```
📊 VALUE CHECKS
├── 🔢 Expect Column Values to Be Between
├── 🎯 Expect Column Values to Be in Set
├── ❌ Expect Column Values to Not Be Null
├── 🔤 Expect Column Values to Match Regex
├── 📅 Expect Column Values to Be Date
└── 🆔 Expect Column Values to Be Unique

📈 STATISTICAL CHECKS
├── 📊 Expect Column Mean to Be Between
├── 📐 Expect Column Median to Be Between
├── 🎲 Expect Column Stdev to Be Between
├── 📏 Expect Column Min to Be Between
└── 📏 Expect Column Max to Be Between

🔤 STRING CHECKS
├── ✂️ Expect Column Value Lengths to Be Between
├── 🔡 Expect Column Values to Match String Pattern
├── 📧 Expect Column Values to Be Valid Email
├── 📱 Expect Column Values to Be Valid Phone
└── 🌐 Expect Column Values to Be Valid URL

📅 TEMPORAL CHECKS
├── 🕐 Expect Column Values to Be Recent (within N days)
├── 📆 Expect Column Values to Be Increasing
├── ⏰ Expect Column Values to Be in Business Hours
└── 📅 Expect No Gaps in Date Sequence
```

#### **Table-Level Checks**
```
📋 TABLE STRUCTURE
├── 📊 Expect Table Row Count to Be Between
├── 🔢 Expect Table Column Count to Equal
├── 📑 Expect Table Columns to Match Ordered List
├── 🗂️ Expect Table to Exist
└── 🔑 Expect Table to Have Primary Key

🔗 RELATIONSHIP CHECKS
├── 🔑 Expect Foreign Key Integrity
├── 🔗 Expect Referential Integrity
├── 👥 Expect No Orphaned Records
└── 🔄 Expect Join Results to Match
```

#### **Data Freshness Checks**
```
⏱️ FRESHNESS
├── 🕐 Expect Data Within Last N Hours
├── 📅 Expect Max Date to Be Recent
├── 📆 Expect Records Added Today
└── ⚠️ Expect No Stale Data
```

#### **Business Rule Checks**
```
💼 BUSINESS RULES
├── 🧮 Expect Compound Column Values (calc checks)
├── 🔢 Expect Sum to Equal (account balancing)
├── ⚖️ Expect Column Ratio to Be Between
└── 🎯 Expect Custom SQL to Return Zero Rows
```

### 2. **Target Selector** (Top Bar)

Visual selector for where to apply checks:

```
┌──────────────────────────────────────────────────────┐
│ Apply Checks To:                                     │
│  ○ Single Table    ○ Multiple Tables    ○ Entire Flow│
├──────────────────────────────────────────────────────┤
│ Connection: [AdventureWorks ▼]                       │
│ Schema:     [SalesLT ▼]                              │
│ Table:      [Customer ▼]                             │
│ Column:     [-- Select Column or Table-Level --]     │
└──────────────────────────────────────────────────────┘
```

### 3. **Check Builder Canvas** (Center)

Drag-and-drop interface similar to your Flow Visualizer:

```
┌─────────────────────────────────────────────────────────┐
│  Quality Check Suite: "Customer Data Validation"        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────┐                              │
│  │ 🔢 Column: CustomerID │                              │
│  │ ─────────────────────│                              │
│  │ ✓ Not Null           │                              │
│  │ ✓ Unique             │                              │
│  │ ✓ Integer Type       │                              │
│  └──────────────────────┘                              │
│            │                                            │
│            ↓                                            │
│  ┌──────────────────────┐     ┌───────────────────┐  │
│  │ 📧 Column: Email     │     │ 📅 Column: Date   │  │
│  │ ─────────────────────│     │ ──────────────────│  │
│  │ ✓ Valid Email Format │     │ ✓ Recent (<30d)   │  │
│  │ ✓ Not Null           │     │ ✓ No Future Dates │  │
│  └──────────────────────┘     └───────────────────┘  │
│            │                           │               │
│            └───────────┬───────────────┘               │
│                        ↓                                │
│              ┌─────────────────┐                       │
│              │ 📋 Table-Level  │                       │
│              │ ────────────────│                       │
│              │ ✓ Row Count > 0 │                       │
│              │ ✓ Has PK        │                       │
│              └─────────────────┘                       │
│                                                          │
│  [+ Add Check]  [▶ Run All]  [💾 Save Suite]          │
└─────────────────────────────────────────────────────────┘
```

### 4. **Configuration Panel** (Right Sidebar)

Dynamic form based on selected check:

```
┌──────────────────────────────────────┐
│ Check Configuration                  │
├──────────────────────────────────────┤
│ Type: Column Values to Be Between    │
│                                      │
│ Column: [Age ▼]                      │
│                                      │
│ Min Value: [0    ]                   │
│ Max Value: [120  ]                   │
│                                      │
│ Allow Nulls: [✓]                     │
│                                      │
│ Severity:                            │
│  ○ Warning  ● Error  ○ Critical     │
│                                      │
│ On Failure:                          │
│  [✓] Log Error                       │
│  [✓] Send Alert                      │
│  [ ] Stop Pipeline                   │
│                                      │
│ Description:                         │
│ ┌────────────────────────────────┐  │
│ │ Validate customer ages are     │  │
│ │ within reasonable range        │  │
│ └────────────────────────────────┘  │
│                                      │
│ [Apply]  [Cancel]                    │
└──────────────────────────────────────┘
```

### 5. **Results Panel** (Bottom Expandable)

Show check execution results with drill-down:

```
┌──────────────────────────────────────────────────────────────────┐
│ Execution Results - Customer Data Validation                     │
│ Run Time: 2024-02-03 14:30:15 | Duration: 2.3s | Status: FAILED │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ✓ PASSED  CustomerID Not Null           100%  (847/847 rows)    │
│ ✓ PASSED  CustomerID Unique             100%  (847 unique)      │
│ ✓ PASSED  Email Valid Format            98.5% (834/847)         │
│ ✗ FAILED  Age Between 0 and 120         92.1% (780/847)         │
│   └─ 67 rows failed: [-1, 150, 200...]  [View Details ▼]       │
│ ⚠ WARNING Date Recent (<30d)            45.2% (383/847)         │
│   └─ 464 rows older than threshold      [View Details ▼]       │
│ ✓ PASSED  Table Row Count > 0           Pass   (847 rows)       │
│                                                                   │
│ Summary: 5 Passed | 1 Failed | 1 Warning                        │
│                                                                   │
│ [📥 Export Report] [📧 Send Alert] [💾 Save Results]            │
└──────────────────────────────────────────────────────────────────┘
```

## Data Model

### Expectation Suite Structure

```json
{
  "suite_id": "customer-validation-v1",
  "name": "Customer Data Validation",
  "description": "Core validation rules for customer data",
  "connection_id": "local_adventureworks",
  "target": {
    "type": "table",
    "schema": "SalesLT",
    "table": "Customer"
  },
  "expectations": [
    {
      "id": "exp_001",
      "type": "expect_column_values_to_not_be_null",
      "column": "CustomerID",
      "severity": "error",
      "on_failure": {
        "log": true,
        "alert": true,
        "stop_pipeline": true
      },
      "meta": {
        "description": "Customer ID is required",
        "owner": "data-team"
      }
    },
    {
      "id": "exp_002",
      "type": "expect_column_values_to_be_between",
      "column": "Age",
      "params": {
        "min_value": 0,
        "max_value": 120,
        "mostly": 0.95
      },
      "severity": "error",
      "on_failure": {
        "log": true,
        "alert": true,
        "stop_pipeline": false
      }
    },
    {
      "id": "exp_003",
      "type": "expect_column_values_to_match_regex",
      "column": "Email",
      "params": {
        "regex": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
      },
      "severity": "warning"
    }
  ],
  "schedule": {
    "enabled": true,
    "cron": "0 */6 * * *",
    "timezone": "UTC"
  },
  "created_at": "2024-02-03T10:00:00Z",
  "updated_at": "2024-02-03T14:30:00Z"
}
```

### Validation Result Structure

```json
{
  "result_id": "res_20240203_143015",
  "suite_id": "customer-validation-v1",
  "execution_time": "2024-02-03T14:30:15Z",
  "duration_seconds": 2.3,
  "status": "failed",
  "statistics": {
    "total_expectations": 6,
    "passed": 5,
    "failed": 1,
    "warnings": 1
  },
  "results": [
    {
      "expectation_id": "exp_002",
      "status": "failed",
      "observed_value": {
        "total_rows": 847,
        "failed_rows": 67,
        "success_percentage": 92.1
      },
      "failed_rows_sample": [
        {"CustomerID": 123, "Age": -1},
        {"CustomerID": 456, "Age": 150},
        {"CustomerID": 789, "Age": 200}
      ],
      "metadata": {
        "query_executed": "SELECT * FROM SalesLT.Customer WHERE Age < 0 OR Age > 120",
        "execution_time_ms": 145
      }
    }
  ],
  "actions_taken": {
    "alerts_sent": ["email:data-team@company.com"],
    "pipeline_stopped": false
  }
}
```

## Integration Points

### 1. **Flow Visualizer Integration**

Add "Quality Check" nodes to flow canvas:

```javascript
// New node type in FlowVisualizer
{
  id: 'quality_check_001',
  type: 'quality_check',
  data: {
    label: 'Validate Customer Data',
    suiteId: 'customer-validation-v1',
    checkCount: 6,
    lastRunStatus: 'passed'
  },
  style: {
    background: '#fef3c7',
    border: '2px solid #f59e0b',
    borderRadius: '8px'
  }
}
```

### 2. **ETL Pipeline Integration**

Attach quality checks to specific flow steps:

```
[Source Table]
      ↓
[Quality Check: Input Validation] ← Check Suite Applied Here
      ↓
[Transformation]
      ↓
[Quality Check: Output Validation] ← Another Check Suite
      ↓
[Destination]
```

### 3. **Database Browser Integration**

Right-click context menu on tables:
- "Create Quality Checks..."
- "View Existing Checks"
- "Run Validation"

## UI Wireframes

### Main Quality Builder Interface

```
┌─────────────────────────────────────────────────────────────────────┐
│ MS3DM Toolkit - Data Quality Builder                               │
├─────────────────────────────────────────────────────────────────────┤
│ [Configuration] [Data Quality] [Data Flows]                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ ┌─────────┬──────────────────────────────────────┬──────────────┐  │
│ │ 📚      │                                      │ ⚙️           │  │
│ │ Library │          Check Canvas                │ Properties   │  │
│ │         │                                      │              │  │
│ │ Search: │  [Drag checks here]                 │ Configure    │  │
│ │ [...]   │                                      │ selected     │  │
│ │         │   ┌──────────┐                      │ check        │  │
│ │ Column  │   │ Check 1  │                      │              │  │
│ │ ├ Value │   └──────────┘                      │ Type:        │  │
│ │ ├ Stats │        ↓                            │ [........]   │  │
│ │ └ String│   ┌──────────┐                      │              │  │
│ │         │   │ Check 2  │                      │ Params:      │  │
│ │ Table   │   └──────────┘                      │ Min: [...]   │  │
│ │ ├ Count │        ↓                            │ Max: [...]   │  │
│ │ └ Schema│   ┌──────────┐                      │              │  │
│ │         │   │ Check 3  │                      │ [Apply]      │  │
│ │ Fresh   │   └──────────┘                      │              │  │
│ │ Business│                                      │              │  │
│ │         │                                      │              │  │
│ │         │  [▶ Run Checks] [💾 Save Suite]    │              │  │
│ │         │                                      │              │  │
│ └─────────┴──────────────────────────────────────┴──────────────┘  │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ 📊 Results                                          [Expand ▼] │  │
│ ├──────────────────────────────────────────────────────────────┤  │
│ │ Last Run: 2 minutes ago | Status: ✓ PASSED | 12/12 checks   │  │
│ └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Core Builder (MVP)
- [ ] Basic expectation library (10-15 common checks)
- [ ] Target selector (table/column)
- [ ] Drag-and-drop canvas
- [ ] Configuration panel
- [ ] Single check execution
- [ ] Results display

### Phase 2: Suite Management
- [ ] Save/load expectation suites
- [ ] Suite templates library
- [ ] Batch execution
- [ ] Historical results
- [ ] Export reports (JSON/CSV)

### Phase 3: Flow Integration
- [ ] Add quality check nodes to Flow Visualizer
- [ ] Link checks to ETL steps
- [ ] Pipeline failure handling
- [ ] Conditional routing based on results

### Phase 4: Advanced Features
- [ ] Custom SQL expectations
- [ ] Cross-table validation
- [ ] Threshold anomaly detection
- [ ] Machine learning-based profiling
- [ ] Automated expectation generation
- [ ] Slack/email alerting
- [ ] Scheduling & monitoring

### Phase 5: Collaboration
- [ ] Multi-user annotations
- [ ] Approval workflows
- [ ] Version control for suites
- [ ] Shared expectation library
- [ ] Documentation generation

## Tech Stack

### Frontend
```javascript
// New React components needed
components/
  QualityBuilder/
    ExpectationLibrary.jsx       // Left sidebar catalog
    CheckCanvas.jsx              // Main drag-drop area
    CheckNode.jsx                // Individual check component
    ConfigurationPanel.jsx       // Right sidebar config
    ResultsPanel.jsx             // Bottom results display
    SuiteSelector.jsx            // Load/save suites
    TemplateGallery.jsx          // Pre-built templates
```

### Backend
```python
# New API endpoints needed
backend/
  api/
    expectations.py              # CRUD for expectation suites
  services/
    expectation_engine.py        # Execute checks
    expectation_validator.py     # Validate check configs
    result_analyzer.py           # Analyze & format results
  expectations/
    column_expectations.py       # Column-level checks
    table_expectations.py        # Table-level checks
    business_expectations.py     # Custom business rules
```

### Database Schema
```sql
-- Store expectation suites
CREATE TABLE expectation_suites (
    suite_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200),
    description TEXT,
    connection_id VARCHAR(50),
    target_schema VARCHAR(100),
    target_table VARCHAR(100),
    expectations JSON,
    schedule JSON,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Store validation results
CREATE TABLE validation_results (
    result_id VARCHAR(50) PRIMARY KEY,
    suite_id VARCHAR(50),
    execution_time TIMESTAMP,
    duration_seconds DECIMAL(10,2),
    status VARCHAR(20),
    statistics JSON,
    results JSON,
    created_at TIMESTAMP
);
```

## Example Workflows

### Workflow 1: Quick Column Validation

```
1. User clicks table "Customer" in Database Browser
2. Selects "Create Quality Checks"
3. Quality Builder opens with table pre-selected
4. User drags "Not Null" check onto CustomerID column
5. User drags "Valid Email" check onto Email column
6. Clicks "Run Checks"
7. Results show: 2/2 passed
8. User saves as "Customer Basic Validation"
```

### Workflow 2: ETL Pipeline Validation

```
1. User opens existing ETL flow in Flow Visualizer
2. Clicks between "Source" and "Transformation" nodes
3. Selects "Add Quality Check"
4. Configures input validation checks
5. Adds another quality check before "Destination"
6. Configures output validation checks
7. Saves flow with embedded quality checks
8. On flow execution, checks run automatically
```

### Workflow 3: Template-Based Setup

```
1. User navigates to Quality Builder
2. Clicks "New Suite from Template"
3. Selects "SCD Type 2 Validation" template
4. System auto-generates 15 checks
5. User customizes thresholds
6. Applies to their dimension table
7. Saves and schedules for daily execution
```

## Benefits

✅ **No-Code Quality Checks**: Business analysts can create checks without SQL
✅ **Visual Understanding**: See data quality rules at a glance
✅ **Integrated Workflow**: Embedded in ETL flows
✅ **Reusable Suites**: Save and apply to multiple tables
✅ **Instant Feedback**: Run checks on-demand
✅ **Historical Tracking**: See data quality trends over time
✅ **Pipeline Protection**: Prevent bad data from flowing downstream

## Comparison to Great Expectations

| Feature | Great Expectations | MS3DM Quality Builder |
|---------|-------------------|----------------------|
| Visual Interface | Limited (JSON editing) | ✅ Full drag-and-drop UI |
| ETL Integration | Manual | ✅ Native flow integration |
| Learning Curve | Steep (Python required) | ✅ Easy (no-code) |
| Custom Checks | Python code | ✅ Visual + SQL option |
| Results Display | HTML reports | ✅ Interactive dashboard |
| Scheduling | External (Airflow) | ✅ Built-in |
| Real-time Testing | No | ✅ Yes (on-demand) |
| Version Control | Git (JSON files) | ✅ Built-in + Git option |

## Next Steps

To get started building this module:

1. **Prototype Phase 1** components
2. **Design API contracts** for backend
3. **Create sample expectation library** (10 checks)
4. **Build simple canvas** for drag-and-drop
5. **Implement execution engine** for basic checks
6. **Add results visualization**
7. **User testing** with real ETL scenarios

---

**Related Documents:**
- [README.md](README.md) - Main project documentation
- [Flow Visualizer Design](frontend/src/components/FlowVisualizer/) - Existing canvas implementation
- [Quality Dashboard](frontend/src/components/QualityDashboard/) - Current quality check UI
