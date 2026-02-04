# Quality Builder - Quick Start Guide

## 🎉 Quality Builder is Now Live!

The visual data quality builder has been successfully implemented and is ready to use!

## How to Access

1. **Open your browser** to http://localhost:5173
2. **Click "Quality Builder"** in the navigation menu
3. Start building quality checks!

## What's Included

### ✅ **7 Essential Quality Checks**

1. **Not Null** - Ensure column values are not null
2. **Unique Values** - Verify column values are unique  
3. **Value Range** - Check values are within min/max bounds
4. **Match Pattern** - Validate values match regex patterns (email support)
5. **Row Count Range** - Verify table row count is within expected range
6. **Recent Data** - Check data freshness (within N hours)
7. **Valid Date Key** 🆕 - Validate and convert integer date keys (YYYYMMDD → MM/DD/YYYY)

### 🎨 **Visual Interface**

- **Left Panel**: Library of available checks (click to add)
- **Center Canvas**: Your configured checks
- **Right Panel**: Configure selected check parameters
- **Bottom Panel**: Execution results (appears after running checks)

## Quick Tutorial (2 minutes)

### Step 1: Set Target Table
```
Schema: SalesLT
Table:  Customer
```

### Step 2: Add Checks

**Click these checks from the left library:**

1. **Not Null** 
   - Configure: Column = `CustomerID`
   
2. **Unique Values**
   - Configure: Column = `CustomerID`
   
3. **Match Pattern**
   - Configure: Column = `EmailAddress`
   - Pattern = `email`

### Step 3: Run Checks

Click **"▶ Run 3 Checks"** button in the top right

### Step 4: View Results

Results panel appears at bottom showing:
- ✓ **PASSED** checks in green
- ✗ **FAILED** checks in red
- Success percentages
- Sample failed rows (click to expand)

## Example: Customer Table Validation

```javascript
// This is what gets executed (you don't write code!)
{
  "name": "Customer Validation",
  "connection_id": "local_adventureworks",
  "expectations": [
    {
      "type": "expect_column_values_to_not_be_null",
      "column": "CustomerID",
      "target": { "schema": "SalesLT", "table": "Customer" }
    },
    {
      "type": "expect_column_values_to_be_unique",
      "column": "CustomerID",
      "target": { "schema": "SalesLT", "table": "Customer" }
    },
    {
      "type": "expect_column_values_to_match_regex",
      "column": "EmailAddress",
      "params": { "regex": "email" },
      "target": { "schema": "SalesLT", "table": "Customer" }
    }
  ]
}
```

## Try These Scenarios

### Scenario 1: Basic Column Validation
**Goal:** Validate ProductID in Product table

1. Set Target: `SalesLT.Product`
2. Add "Not Null" check → Column: `ProductID`
3. Add "Unique Values" check → Column: `ProductID`
4. Run checks
5. **Expected:** Both pass ✓

### Scenario 2: Value Range Check
**Goal:** Validate ListPrice is reasonable

1. Set Target: `SalesLT.Product`
2. Add "Value Range" check → Column: `ListPrice`
   - Min Value: `0`
   - Max Value: `5000`
3. Run check
4. **Expected:** Shows how many products are out of range

### Scenario 3: Data Freshness
**Goal:** Check when data was last modified

1. Set Target: `SalesLT.Customer`
2. Add "Recent Data" check → Column: `ModifiedDate`
   - Max Age (hours): `24`
3. Run check
4. **Expected:** Shows age of most recent data

### Scenario 4: Row Count Validation
**Goal:** Ensure table is not empty

1. Set Target: `SalesLT.Customer`
2. Add "Row Count Range" check
   - Min Rows: `1`
   - Max Rows: `(leave empty)`
3. Run check
4. **Expected:** Pass if table has data ✓

### Scenario 5: Date Key Validation 🆕
**Goal:** Validate integer date keys and see conversions

1. Set Target: `SalesLT.DateKeyTest`
2. Add "Valid Date Key" check from Date Key Validation category
   - Column: `DateKeyValue`
   - Min Date: `20200101` (optional)
   - Max Date: `20301231` (optional)
3. Run check
4. **Expected:** 
   - Shows valid date key conversions (20260203 → 02/03/2026)
   - Identifies invalid date keys with reasons
   - Success rate around 50% (mix of valid/invalid test data)

## Features Implemented

✅ **Backend**
- REST API endpoints (`/api/expectations/*`)
- Expectation execution engine
- 6 validation check types
- Results storage (JSON files)
- Error handling

✅ **Frontend**
- Visual check library
- Drag-to-add interface
- Dynamic configuration panel
- Results visualization
- Failed row samples
- Success/failure indicators

✅ **Integration**
- Uses existing connection manager
- Works with AdventureWorks sample DB
- Full Docker support

## API Endpoints Available

```
GET    /api/expectations/library              # Get all available check types
POST   /api/expectations/validate             # Test single check
POST   /api/expectations/run-adhoc            # Run suite without saving
GET    /api/expectations/results              # Get execution history
GET    /api/expectations/results/:id          # Get specific result details
```

## Tips & Tricks

💡 **Column Names**
- Enter exact column names from your table
- Case-sensitive!
- Use square brackets for special characters: `[Column Name]`

💡 **Patterns**
- Use "email" for email validation
- Custom regex patterns coming in future updates

💡 **Row Count Checks**
- Leave Max Value empty for "at least N rows"
- Use both min/max for exact range

💡 **Multiple Checks**
- Add as many checks as you need
- They run in parallel
- Each check is independent

## Troubleshooting

### "Failed to load connections"
- Check backend is running: http://localhost:8000/health
- Verify AdventureWorks database is available

### "Table and column are required"
- Make sure you've entered a column name in the config panel
- Check spelling matches your database

### No results showing
- Wait for checks to complete (watch for ⏳ icon)
- Check browser console for errors (F12)
- Verify connection to database is working

### Backend errors
```bash
# Check backend logs
docker logs ms3dm_toolkit-backend-1 --tail 50

# Restart backend if needed
docker restart ms3dm_toolkit-backend-1
```

## What's Next?

This MVP includes 6 essential checks. Future enhancements:

📋 **Coming Soon**
- Save check suites for reuse
- Schedule automated runs
- Email/Slack alerts
- More check types (30+)
- Cross-table validation
- Custom SQL checks
- Integration with Flow Visualizer
- Export reports (PDF/CSV)

## Files Created

```
Backend:
├── api/expectations.py                   # API endpoints
├── services/expectation_engine.py        # Execution engine
└── expectations_results/                 # Results storage

Frontend:
├── components/QualityBuilder/
│   ├── QualityBuilder.jsx               # Main component
│   ├── ExpectationLibrary.jsx           # Check catalog
│   ├── CheckCanvas.jsx                  # Check list/canvas
│   ├── ConfigPanel.jsx                  # Configuration
│   └── ResultsViewer.jsx                # Results display
└── api/client.js                         # API integration (updated)
```

## Get Started Now!

1. Navigate to http://localhost:5173/quality-builder
2. Try the "Customer Table Validation" example above
3. Experiment with different checks and tables
4. Review the design docs for advanced features:
   - [QUALITY_BUILDER_DESIGN.md](QUALITY_BUILDER_DESIGN.md)
   - [QUALITY_BUILDER_IMPLEMENTATION.md](QUALITY_BUILDER_IMPLEMENTATION.md)
   - [QUALITY_BUILDER_API.md](QUALITY_BUILDER_API.md)

**Happy quality checking!** 🎉
