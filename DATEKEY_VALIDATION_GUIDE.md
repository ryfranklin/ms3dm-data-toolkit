# Date Key Validation Guide

## Overview

The **Date Key Validation** check converts integer date keys (common in data warehouses) to readable dates and validates their format.

## Format

**Integer Date Keys**: `YYYYMMDD`
- Example: `20260203` = **02/03/2026**
- Example: `20250101` = **01/01/2025**
- Example: `19991231` = **12/31/1999**

## How to Use

### Step 1: Add the Check

1. Navigate to **Quality Builder**
2. Click **"Valid Date Key"** from the Date Key Validation category
3. Configure the column containing date keys

### Step 2: Configure (Optional Range)

Configure in the right panel:
- **Column Name**: Your date key column (e.g., `OrderDateKey`)
- **Minimum Date Key** (optional): Earliest valid date (e.g., `20200101` for Jan 1, 2020)
- **Maximum Date Key** (optional): Latest valid date (e.g., `20301231` for Dec 31, 2030)

### Step 3: Run Check

Click "Run Checks" to execute validation

### Step 4: Review Results

Results show:
- ✓ **Valid date keys** with sample conversions
- ✗ **Invalid date keys** with reasons:
  - NULL values
  - Not integers
  - Invalid length (not 8 digits)
  - Invalid dates (e.g., month 13, day 32)
  - Out of range (if min/max specified)

## Example: Validate Order Dates

```javascript
// Configuration
{
  "check": "Valid Date Key",
  "column": "OrderDateKey",
  "min_date": 20200101,  // Optional: No orders before 2020
  "max_date": 20301231   // Optional: No orders after 2030
}
```

**Result Display:**
```
✓ Valid Date Key Conversions (sample):
  20260203 → 02/03/2026
  20260115 → 01/15/2026
  20251225 → 12/25/2025
  20250101 → 01/01/2025

Statistics:
  Total Rows: 1,250
  Valid Date Keys: 1,245 (99.6%)
  Invalid Date Keys: 5 (0.4%)
  Success Percentage: 99.6%
```

## What Gets Validated

### ✅ Valid Date Keys
- 8 digits: `20260203` ✓
- Represents real date: `20260229` ✓ (leap year)
- Within range (if specified): `20250615` ✓

### ❌ Invalid Date Keys
- NULL values: `NULL` ✗
- Not integer: `"20260203"` ✗
- Wrong length: `2026023` (7 digits) ✗
- Invalid month: `20261332` (month 13) ✗
- Invalid day: `20260232` (Feb 32) ✗
- Out of range: `19990101` ✗ (if min is 20200101)

## Common Use Cases

### Use Case 1: Dimension Table Validation
**Scenario:** Validate date dimension has valid date keys

```
Table: DimDate
Column: DateKey
Check: Valid Date Key
Min: 20000101 (Year 2000)
Max: 20501231 (Year 2050)
```

### Use Case 2: Fact Table Date Keys
**Scenario:** Ensure fact table dates are valid and recent

```
Table: FactSales
Column: OrderDateKey
Check: Valid Date Key
Min: 20230101 (Current year minus 3)
Max: 20260231 (Current year plus 2)
```

### Use Case 3: ETL Data Quality
**Scenario:** Validate incoming data has proper date keys

```
Table: StagingOrders
Column: OrderDate
Check: Valid Date Key
(No min/max - just validate format)
```

## Creating Test Data

To test this feature, you can create a table with date keys:

```sql
-- Create a test table with date keys
CREATE TABLE TestDateKeys (
    OrderID INT,
    OrderDateKey INT,
    CustomerID INT
);

-- Insert valid date keys
INSERT INTO TestDateKeys VALUES (1, 20260203, 100);  -- Valid: 02/03/2026
INSERT INTO TestDateKeys VALUES (2, 20260115, 101);  -- Valid: 01/15/2026
INSERT INTO TestDateKeys VALUES (3, 20251225, 102);  -- Valid: 12/25/2025

-- Insert invalid date keys for testing
INSERT INTO TestDateKeys VALUES (4, 20261332, 103);  -- Invalid: Month 13
INSERT INTO TestDateKeys VALUES (5, 20260232, 104);  -- Invalid: Feb 32
INSERT INTO TestDateKeys VALUES (6, 2026023, 105);   -- Invalid: 7 digits
INSERT INTO TestDateKeys VALUES (7, NULL, 106);      -- Invalid: NULL

-- Test in Quality Builder:
-- Schema: dbo
-- Table: TestDateKeys
-- Column: OrderDateKey
-- Run Check!
```

## AdventureWorks Examples

AdventureWorks doesn't have date key columns by default, but you can create them:

```sql
-- Add date key columns to SalesOrderHeader
ALTER TABLE SalesLT.SalesOrderHeader
ADD OrderDateKey AS CAST(
    YEAR(OrderDate) * 10000 + 
    MONTH(OrderDate) * 100 + 
    DAY(OrderDate) AS INT
);

-- Now test with Quality Builder:
-- Table: SalesLT.SalesOrderHeader
-- Column: OrderDateKey
```

## Results Interpretation

### Green (Passed)
```
✓ PASSED Valid Date Key    100% (1000/1000)
All date keys are valid YYYYMMDD integers
Min Date: 2020-01-01
Max Date: 2026-12-31
```
**Action:** No action needed

### Red (Failed)
```
✗ FAILED Valid Date Key     95% (950/1000)
50 invalid date keys found
Common issues:
- 30 rows: Invalid date (20261332, etc.)
- 15 rows: Wrong length (7 digits)
- 5 rows: NULL values
```
**Action:** Review and fix invalid date keys in source data

## SQL Server Date Key Functions

Useful SQL Server functions for date keys:

```sql
-- Convert date to date key
SELECT CAST(
    YEAR(GETDATE()) * 10000 + 
    MONTH(GETDATE()) * 100 + 
    DAY(GETDATE()) AS INT
) AS DateKey;
-- Result: 20260203

-- Convert date key to date
DECLARE @DateKey INT = 20260203;
SELECT CONVERT(DATE, 
    STUFF(STUFF(CAST(@DateKey AS VARCHAR(8)), 7, 0, '-'), 5, 0, '-')
) AS ConvertedDate;
-- Result: 2026-02-03

-- Format date key as MM/DD/YYYY
SELECT FORMAT(
    CONVERT(DATE, 
        STUFF(STUFF(CAST(@DateKey AS VARCHAR(8)), 7, 0, '-'), 5, 0, '-')
    ), 
    'MM/dd/yyyy'
) AS FormattedDate;
-- Result: 02/03/2026
```

## Benefits

✅ **Automatic Conversion**: See date keys as readable dates  
✅ **Format Validation**: Catch malformed date keys  
✅ **Range Checking**: Ensure dates within valid business range  
✅ **NULL Detection**: Find missing date values  
✅ **Data Quality**: Prevent invalid dates in warehouse  
✅ **Visual Feedback**: Samples show both formats

## Tips

💡 **Standard Format**: Always use YYYYMMDD (8 digits)  
💡 **No Separators**: Store as integer, not string  
💡 **Leap Years**: Validator handles leap year logic  
💡 **Time Zones**: Date keys are timezone-agnostic  
💡 **Performance**: Integer date keys are faster than DATE type for dimensions

## Troubleshooting

### "Invalid Date (e.g., 20261332)"
- **Issue**: Month or day exceeds valid range
- **Fix**: Correct source data (month 1-12, day 1-31)

### "Invalid length (need 8 digits)"
- **Issue**: Date key has fewer/more than 8 digits
- **Fix**: Ensure format is YYYYMMDD (e.g., pad months/days: 20260203 not 202623)

### "Not an integer"
- **Issue**: Column contains non-numeric values
- **Fix**: Check for strings, decimals, or special characters

### No results showing
- **Issue**: Column name might be wrong
- **Fix**: Verify exact column name (case-sensitive)

## Integration with Data Flows

Date key validation integrates perfectly with ETL flows:

```
[Source: Orders] 
    ↓
[Quality Check: Valid Date Key] ← Check OrderDateKey
    ↓
[Transformation: Date Dimension Lookup]
    ↓
[Destination: Data Warehouse]
```

If invalid date keys are found:
1. Alert data team
2. Investigate source system
3. Fix or filter bad records
4. Re-run pipeline

## Next Steps

After validating date keys:
1. **Create Date Dimension**: Build proper date dimension table
2. **Add Relationships**: Link fact tables to date dimension
3. **Enable Time Intelligence**: Use for year-over-year analysis
4. **Schedule Checks**: Run validation daily/weekly
5. **Monitor Trends**: Track data quality over time

---

**Now available in Quality Builder!** Navigate to http://localhost:5173/quality-builder and look for the **📅 Date Key Validation** category. 🎉
