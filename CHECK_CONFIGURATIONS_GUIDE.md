# Quality Check Configurations Guide

## Overview

Each quality check in the Pipeline Builder now supports detailed configuration to specify exactly what to validate. This guide explains the configuration options for each check type.

## Check Configuration Options

### 1. Not Null ✅

**Purpose:** Validate that specified columns don't contain NULL values

**Configuration:**
- **Columns** (multi-select dropdown, required)
  - Select one or more columns to check
  - Filtered from available table columns
  - Hold Ctrl/Cmd to select multiple

**Example:**
```
Columns: CustomerID, EmailAddress, OrderDate
```

**Use Case:** Ensure critical fields are always populated

---

### 2. Unique Values 🔑

**Purpose:** Validate that specified columns contain only unique values

**Configuration:**
- **Columns** (multi-select dropdown, required)
  - Select columns that should have unique values
  - Can check multiple columns independently
  - Hold Ctrl/Cmd to select multiple

**Example:**
```
Columns: Email, SSN, AccountNumber
```

**Use Case:** Prevent duplicate records, validate primary keys

---

### 3. Value Range 📊

**Purpose:** Validate numeric column values fall within expected range

**Configuration:**
- **Column** (dropdown, required)
  - Select a numeric column
  - Filtered to show only numeric types (int, decimal, float, etc.)
- **Min Value** (number input, optional)
  - Minimum acceptable value
- **Max Value** (number input, optional)
  - Maximum acceptable value

**Example:**
```
Column: Age
Min Value: 0
Max Value: 120
```

**Use Cases:**
- Age validation (0-120)
- Price validation (> 0)
- Percentage validation (0-100)
- Quantity validation (>= 0)

---

### 4. Value Set 📋

**Purpose:** Validate column values match an allowed set of values

**Configuration:**
- **Column** (dropdown, required)
  - Select column to validate
- **Allowed Values** (text input, required)
  - Comma-separated list of valid values
  - Case-sensitive

**Example:**
```
Column: Status
Allowed Values: Active, Inactive, Pending, Archived
```

**Use Cases:**
- Status fields
- Category validation
- Enum-type columns
- Lookup values

---

### 5. Row Count 📈

**Purpose:** Validate table has expected number of rows

**Configuration:**
- **Min Row Count** (number input, optional)
  - Minimum expected rows
- **Max Row Count** (number input, optional)
  - Maximum expected rows

**Example:**
```
Min Row Count: 100
Max Row Count: 10000
```

**Use Cases:**
- Detect data loss (fewer rows than expected)
- Detect duplication (more rows than expected)
- Validate daily loads (expect ~1000 rows/day)
- Empty table detection (min: 1)

---

### 6. Data Freshness ⏰

**Purpose:** Validate data has been updated recently

**Configuration:**
- **Datetime Column** (dropdown, required)
  - Select a datetime/timestamp column
  - Filtered to show only datetime types
- **Threshold (hours)** (number input, required, default: 24)
  - Maximum age of data in hours
  - Most recent record must be within this window

**Example:**
```
Column: LastUpdatedDate
Threshold: 24
```

**Use Cases:**
- Validate ETL ran successfully
- Detect stale data
- Monitor real-time feeds
- Ensure daily loads completed

---

### 7. Referential Integrity 🔗

**Purpose:** Validate foreign key references exist in parent table

**Configuration:**
- **Foreign Key Column** (dropdown, required)
  - Column in current table
- **Reference Table** (text input, required)
  - Parent table in format: schema.table
  - Example: `dbo.Customers`
- **Reference Column** (text input, required)
  - Primary key column in parent table
  - Example: `CustomerID`

**Example:**
```
Foreign Key Column: CustomerID
Reference Table: dbo.Customers
Reference Column: CustomerID
```

**Use Cases:**
- Prevent orphaned records
- Validate FK constraints
- Ensure data consistency across tables
- Check after bulk loads

---

### 8. Pattern Match 🔍

**Purpose:** Validate text column values match expected format using regex

**Configuration:**
- **Column** (dropdown, required)
  - Select a text/varchar column
  - Filtered to show only text types
- **Regex Pattern** (text input, required)
  - Regular expression pattern
  - Must be valid regex syntax

**Example Patterns:**

**Email:**
```
Column: EmailAddress
Pattern: ^\S+@\S+\.\S+$
```

**Phone (US):**
```
Column: PhoneNumber
Pattern: ^\d{3}-\d{3}-\d{4}$
```

**SKU Format:**
```
Column: ProductSKU
Pattern: ^[A-Z]{2}\d{4}$
```

**ZIP Code:**
```
Column: ZipCode
Pattern: ^\d{5}(-\d{4})?$
```

**SSN:**
```
Column: SSN
Pattern: ^\d{3}-\d{2}-\d{4}$
```

**Use Cases:**
- Email format validation
- Phone number format
- SKU/product code format
- Postal code validation
- Custom business formats

---

## Configuration UI Features

### Smart Column Filtering

Dropdowns automatically filter columns by data type:

- **Numeric checks** (Value Range) → Show only numeric columns
- **Datetime checks** (Freshness) → Show only datetime columns
- **Text checks** (Pattern) → Show only text/varchar columns
- **All checks** (Not Null, Unique, etc.) → Show all columns

### Multi-Select Support

Some checks support multiple columns:
- **Not Null** - Check multiple columns at once
- **Unique** - Validate uniqueness of multiple columns

Use Ctrl (Windows) or Cmd (Mac) to select multiple columns.

### Visual Feedback

- Selected checks are highlighted in blue
- Configuration panels appear below selected checks
- Required fields marked with *
- Helper text provides examples and guidance

## Complete Example: Sales Order Validation

```yaml
Step: "Validate Sales Orders"
Table: fact.SalesOrders

Checks:
  1. Not Null
     Columns: OrderID, CustomerID, OrderDate, TotalAmount
  
  2. Unique
     Columns: OrderID
  
  3. Value Range
     Column: TotalAmount
     Min: 0
     Max: 1000000
  
  4. Value Set
     Column: OrderStatus
     Allowed Values: New, Processing, Shipped, Delivered, Cancelled
  
  5. Row Count
     Min: 50
     Max: 5000
  
  6. Data Freshness
     Column: OrderDate
     Threshold: 24
  
  7. Referential Integrity
     Foreign Key: CustomerID
     Reference Table: dim.Customers
     Reference Column: CustomerID
  
  8. Pattern Match
     Column: OrderNumber
     Pattern: ^ORD-\d{8}$
```

## Validation Rules

The Pipeline Builder validates your configuration:

### Required Field Validation
- ✅ Multi-select checks (Not Null, Unique): At least 1 column
- ✅ Single-select checks (Value Range, etc.): 1 column required
- ✅ Value Set: Allowed values required
- ✅ Freshness: Threshold hours required
- ✅ Referential Integrity: All 3 fields required
- ✅ Pattern Match: Regex pattern required

### Error Messages
Clear error messages show which step and check needs attention:
```
Step 2 - Not Null: At least one column is required
Step 3 - Value Range: Column is required
Step 4 - Pattern Match: Regex pattern is required
```

## Best Practices

### 1. Start with Critical Checks

Begin with must-have validations:
1. Not Null on key columns
2. Unique on IDs
3. Row Count to detect issues

Add advanced checks (patterns, ranges) after baseline is stable.

### 2. Use Appropriate Checks

Match check type to data type:
- **IDs** → Not Null + Unique
- **Amounts** → Not Null + Value Range
- **Status** → Not Null + Value Set
- **Dates** → Not Null + Freshness
- **Foreign Keys** → Not Null + Referential Integrity
- **Codes** → Not Null + Pattern Match

### 3. Set Realistic Ranges

Don't set ranges too strict:
- ❌ Age: 18-65 (excludes valid ages)
- ✅ Age: 0-120 (realistic human ages)

- ❌ Daily Orders: 1000 (exact match fails often)
- ✅ Daily Orders: 800-1200 (allows variation)

### 4. Test Patterns First

Test regex patterns before using:
```bash
# Test in SQL first
SELECT * FROM table 
WHERE column NOT LIKE pattern
```

Or use online regex testers.

### 5. Document Patterns

Add comments explaining pattern format:
```
Pattern: ^[A-Z]{2}\d{4}$
Explanation: 2 uppercase letters + 4 digits (e.g., AB1234)
```

## Common Patterns Library

### Email
```
^\S+@\S+\.\S+$
```

### Phone (US)
```
^\d{3}-\d{3}-\d{4}$
```

### Phone (International)
```
^\+?[1-9]\d{1,14}$
```

### ZIP Code (US)
```
^\d{5}(-\d{4})?$
```

### SSN
```
^\d{3}-\d{2}-\d{4}$
```

### Credit Card
```
^\d{4}-?\d{4}-?\d{4}-?\d{4}$
```

### Date (YYYY-MM-DD)
```
^\d{4}-\d{2}-\d{2}$
```

### URL
```
^https?://[^\s/$.?#].[^\s]*$
```

### IPv4
```
^(\d{1,3}\.){3}\d{1,3}$
```

## Tips & Tricks

### Multiple Column Checks

Use Not Null for multiple columns instead of creating separate checks:
```
✅ Good: 1 Not Null check with [Col1, Col2, Col3]
❌ Bad: 3 separate Not Null checks
```

### Freshness for ETL Monitoring

Set freshness threshold based on ETL schedule:
- Daily ETL → Threshold: 26 hours (allows 2hr delay)
- Hourly ETL → Threshold: 2 hours
- Real-time → Threshold: 0.5 hours (30 min)

### Referential Integrity vs Foreign Keys

- Database FK constraints → Prevent bad inserts
- RI checks → Validate existing data, detect orphans

Use both: FK constraints + RI checks for comprehensive validation.

### Pattern Complexity

Start simple, add complexity:
1. Basic: `^\d{5}$` (any 5 digits)
2. Better: `^[0-9]{5}$` (explicit range)
3. Best: `^[0-9]{5}(-[0-9]{4})?$` (ZIP+4 optional)

## Summary

✅ **8 check types with detailed configuration**
✅ **Smart dropdown filtering by data type**
✅ **Multi-select support for batch checks**
✅ **Comprehensive validation before save**
✅ **Helper text and examples**
✅ **Pattern library for common formats**

The configuration system ensures your quality checks are precise, maintainable, and easy to understand. Each check validates exactly what you specify, with clear errors when configuration is incomplete.
