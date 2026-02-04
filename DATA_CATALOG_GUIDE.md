# Data Catalog - User Guide

## Overview

The Data Catalog is a comprehensive database discovery and documentation tool that helps you explore, understand, and document your data assets. It provides automatic schema discovery, metadata management, and powerful search capabilities.

## Features

### 1. **Schema Explorer**
- Automatically discover all databases objects (tables, views)
- Browse by schema with expandable/collapsible views
- Quick overview of table/view counts
- One-click navigation to detailed views

### 2. **Table Details**
- **Columns Tab**: View all column definitions with:
  - Data types and constraints
  - Primary key indicators
  - Nullable flags
  - Default values
  - Custom descriptions (editable)
- **Sample Data Tab**: Preview actual data (10 rows)
- **Relationships Tab**: View foreign key relationships
- **Indexes Tab**: Explore table indexes with CREATE INDEX SQL

### 3. **Metadata Management**
- Add business descriptions to tables and columns
- Tag tables for categorization
- Assign ownership
- All metadata stored persistently

### 4. **Search**
- Search across all tables and columns
- Find objects by name or description
- Quick navigation to search results

### 5. **Statistics**
- Row counts for each table
- Column counts
- Index information

## Quick Start

### Step 1: Navigate to Data Catalog
Click on "Data Catalog" in the main navigation menu.

### Step 2: Select a Connection
Use the connection dropdown in the top-right to select which database to explore.

### Step 3: Explore
The Schema Explorer will automatically discover all schemas, tables, and views. Click to expand schemas and view their contents.

### Step 4: View Details
Click on any table or view to see detailed information including columns, relationships, and sample data.

### Step 5: Document
Click "Edit Metadata" to add descriptions, tags, and ownership information.

## UI Components

### Main Interface
```
┌─────────────────────────────────────────────────┐
│  Data Catalog         [Connection Selector]     │
├─────────────────────────────────────────────────┤
│  [Schema Explorer] [Search] [Table Details]     │
├─────────────────────────────────────────────────┤
│                                                  │
│  Content Area                                    │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Schema Explorer View
- **Schemas**: Listed as expandable cards
- **Tables**: Blue icon (📊) with column count
- **Views**: Purple icon (👁️) with column count
- **Refresh**: Manual refresh button to rediscover schema

### Table Details View
- **Header**: 
  - Schema.TableName display
  - Row count badge
  - Description (editable)
  - Tags (editable)
  - Owner (editable)
- **Tabs**:
  - Columns: Full column definitions
  - Sample Data: Preview actual rows
  - Relationships: Foreign keys (text list)
  - ERD: Visual Entity-Relationship Diagram
  - Indexes: Index definitions

### Search View
- **Search Bar**: Enter keywords to find tables/columns
- **Results**: Organized by type (Tables, Columns)
- **Click to View**: Navigate directly to table details

## API Endpoints

### Backend Endpoints

```python
# Discover all database objects
POST /api/catalog/discover
Body: { "connection_id": "conn1" }

# Get table details
GET /api/catalog/table/<schema>/<table>?connection_id=conn1

# Update table metadata
POST /api/catalog/table/<schema>/<table>/metadata?connection_id=conn1
Body: {
  "description": "Customer master data",
  "owner": "DataTeam",
  "tags": ["PII", "Critical"],
  "columns": {
    "CustomerID": { "description": "Unique customer identifier" },
    "Email": { "description": "Customer email address" }
  }
}

# Search catalog
POST /api/catalog/search
Body: { "connection_id": "conn1", "query": "customer" }

# Get sample data
GET /api/catalog/sample-data/<schema>/<table>?connection_id=conn1&limit=10
```

### Frontend API Client

```javascript
import { catalogApi } from './api/client';

// Discover catalog
const catalog = await catalogApi.discover(connectionId);

// Get table details
const details = await catalogApi.getTableDetails(connectionId, 'dbo', 'Customers');

// Update metadata
await catalogApi.updateTableMetadata(connectionId, 'dbo', 'Customers', {
  description: 'Customer master data',
  tags: ['PII'],
  owner: 'DataTeam'
});

// Search
const results = await catalogApi.search(connectionId, 'customer');

// Get sample data
const sample = await catalogApi.getSampleData(connectionId, 'dbo', 'Customers', 10);
```

## Architecture

### Backend Components

1. **`backend/api/catalog.py`**
   - Flask Blueprint with catalog endpoints
   - SQL Server metadata queries using INFORMATION_SCHEMA
   - File-based metadata storage in `backend/catalog_metadata/`

2. **Database Discovery**
   - Queries INFORMATION_SCHEMA.TABLES for objects
   - Queries INFORMATION_SCHEMA.COLUMNS for column definitions
   - Queries sys.foreign_keys for relationships
   - Queries sys.indexes for index information

3. **Metadata Storage**
   - JSON files: `{connection_id}_{schema}_{table}.json`
   - Location: `backend/catalog_metadata/`
   - Excluded from git via .gitignore

### Frontend Components

1. **`DataCatalog.jsx`**
   - Main container component
   - Manages tabs and connection selection
   - Coordinates child components

2. **`SchemaExplorer.jsx`**
   - Hierarchical schema/table browser
   - Expandable schema cards
   - Discovery and refresh functionality

3. **`TableDetails.jsx`**
   - Detailed table view
   - Tabbed interface (Columns, Sample, Relationships, Indexes)
   - Inline metadata editing
   - Sample data preview

4. **`CatalogSearch.jsx`**
   - Full-text search interface
   - Results organized by type
   - Quick navigation to details

## Use Cases

### 1. New Team Member Onboarding
"What tables are available? What do they contain?"
- Open Data Catalog
- Browse Schema Explorer
- Click on tables to understand structure
- Read descriptions added by team

### 2. Finding Relevant Data
"Where is customer email stored?"
- Use Search tab
- Enter "email"
- View all columns matching "email"
- Navigate to table details

### 3. Documentation
"Document our core tables for the team"
- Navigate to table
- Click "Edit Metadata"
- Add description, tags, owner
- Add column descriptions
- Save

### 4. Understanding Relationships
"What foreign keys does this table have?"
- Navigate to table details
- Click "Relationships" tab to see text list
- Click "ERD" tab to see visual diagram
- Click on related tables in ERD to navigate

### 5. Data Profiling
"What data is actually in this table?"
- Navigate to table details
- Click "Sample Data" tab
- Review 10 sample rows

### 6. Index Management
"What indexes exist on this table?"
- Navigate to table details
- Click "Indexes" tab
- View all indexes with details
- Copy CREATE INDEX SQL for recreation or documentation

## Best Practices

### Documentation
1. **Table Descriptions**: Explain the business purpose
2. **Column Descriptions**: Define what each column represents
3. **Tags**: Use consistent tags (e.g., PII, Critical, Archive)
4. **Owner**: Assign a team or person responsible

### Example Tags
- `PII` - Contains personally identifiable information
- `Critical` - Mission-critical table
- `Archive` - Historical/archive data
- `Staging` - Temporary staging table
- `Reference` - Reference/lookup data

### Search Tips
- Use partial names: "cust" finds "customer", "customers"
- Search is case-insensitive
- Searches both table and column names

## Index Documentation

### Index Tab Features

The Indexes tab provides comprehensive index information with SQL generation:

**For Each Index, You See**:
- **Index Name**: Full index name
- **Type**: CLUSTERED, NONCLUSTERED, etc.
- **Badges**: PRIMARY KEY, UNIQUE indicators
- **Key Columns**: Columns in index with ASC/DESC
- **Included Columns**: Non-key columns (INCLUDE clause)
- **Filter Definition**: WHERE clause for filtered indexes
- **CREATE INDEX SQL**: Complete, copyable SQL statement
- **Copy Button**: One-click copy of SQL

**Example Index Display**:
```
⚡ PK_SalesOrderHeader_SalesOrderID
   [PRIMARY KEY] [CLUSTERED]                    [📋 Copy SQL]

Key Columns:
  SalesOrderID ASC

CREATE INDEX Statement:
ALTER TABLE [Sales].[SalesOrderHeader]
  ADD CONSTRAINT [PK_SalesOrderHeader_SalesOrderID]
  PRIMARY KEY CLUSTERED (SalesOrderID ASC)
```

**Non-Clustered Index Example**:
```
⚡ IX_Customer_EmailAddress
   [UNIQUE] [NONCLUSTERED]                      [📋 Copy SQL]

Key Columns:
  EmailAddress ASC

Included Columns:
  FirstName, LastName, Phone

CREATE INDEX Statement:
CREATE UNIQUE NONCLUSTERED INDEX [IX_Customer_EmailAddress]
  ON [Sales].[Customer] (EmailAddress ASC)
  INCLUDE (FirstName, LastName, Phone)
```

**Filtered Index Example**:
```
⚡ IX_Orders_ActiveOnly
   [NONCLUSTERED]                               [📋 Copy SQL]

Key Columns:
  OrderDate DESC, CustomerID ASC

Filter (Filtered Index):
  WHERE Status = 'Active'

CREATE INDEX Statement:
CREATE NONCLUSTERED INDEX [IX_Orders_ActiveOnly]
  ON [Sales].[Orders] (OrderDate DESC, CustomerID ASC)
  WHERE Status = 'Active'
```

### Using Index SQL

**Use Cases**:
1. **Recreate indexes** in different environments
2. **Document index strategy** in technical specs
3. **Script database setup** for new deployments
4. **Learn index syntax** for SQL Server
5. **Share with DBAs** for review

**Workflow**:
1. Navigate to table with indexes
2. Click "Indexes" tab
3. Review each index's purpose and columns
4. Click "Copy SQL" for any index
5. Paste into SQL script or documentation

## Technical Details

### Metadata Schema

```json
{
  "description": "Table-level description",
  "owner": "Team or person name",
  "tags": ["Tag1", "Tag2"],
  "columns": {
    "ColumnName": {
      "description": "Column-level description"
    }
  }
}
```

### SQL Queries

**Discover Schemas:**
```sql
SELECT DISTINCT schema_name
FROM INFORMATION_SCHEMA.SCHEMATA
WHERE schema_name NOT IN ('sys', 'INFORMATION_SCHEMA')
ORDER BY schema_name
```

**Get Tables:**
```sql
SELECT 
    t.TABLE_SCHEMA,
    t.TABLE_NAME,
    t.TABLE_TYPE,
    (SELECT COUNT(*) 
     FROM INFORMATION_SCHEMA.COLUMNS c 
     WHERE c.TABLE_SCHEMA = t.TABLE_SCHEMA 
     AND c.TABLE_NAME = t.TABLE_NAME) as column_count
FROM INFORMATION_SCHEMA.TABLES t
WHERE t.TABLE_SCHEMA = ?
ORDER BY t.TABLE_TYPE, t.TABLE_NAME
```

**Get Columns:**
```sql
SELECT 
    c.COLUMN_NAME,
    c.DATA_TYPE,
    c.CHARACTER_MAXIMUM_LENGTH,
    c.NUMERIC_PRECISION,
    c.NUMERIC_SCALE,
    c.IS_NULLABLE,
    c.COLUMN_DEFAULT,
    c.ORDINAL_POSITION,
    CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'YES' ELSE 'NO' END as IS_PRIMARY_KEY
FROM INFORMATION_SCHEMA.COLUMNS c
LEFT JOIN (/* primary key subquery */) pk
WHERE c.TABLE_SCHEMA = ? AND c.TABLE_NAME = ?
ORDER BY c.ORDINAL_POSITION
```

## Integration with Other Modules

### Quality Builder
Use the Data Catalog to:
- Understand table structure before creating quality checks
- Find tables that need quality validation
- Document quality expectations in table descriptions

### Pipeline Scheduler
Use the Data Catalog to:
- Identify tables for pipeline processing
- Understand data lineage
- Document ETL processes in table metadata

### Data Flows
Use the Data Catalog to:
- Explore source/target tables
- Understand column mappings
- View relationships between tables

## Troubleshooting

### "No schemas found"
- Verify database connection is working
- Check user has SELECT permission on INFORMATION_SCHEMA views
- Ensure database is not empty

### "Error discovering catalog"
- Check backend logs: `docker logs ms3dm_toolkit-backend-1`
- Verify SQL Server is accessible
- Check connection configuration

### "Metadata not saving"
- Check `backend/catalog_metadata/` directory exists
- Verify write permissions
- Check backend logs for errors

### "Sample data not loading"
- Table might be empty
- User might lack SELECT permission
- Check for special characters in table/schema names

## ERD (Entity-Relationship Diagram)

### Overview
The ERD tab provides an interactive visual representation of table relationships with automatic SQL generation:

### Features
- **Visual Layout**: Current table (blue) in center, related tables (green) arranged in circle
- **Relationship Arrows**: Lines showing foreign key relationships with SQL join conditions
- **SQL Generation**: Complete query and individual JOIN statements
- **Copy to Clipboard**: One-click copy of SQL code
- **Interactive**: Click on any related table to navigate to its details
- **Syntax Highlighting**: SQL displayed in terminal theme
- **Legend**: Clear explanation of diagram elements

### Using the ERD
1. Navigate to any table with foreign keys
2. Click the "ERD" tab (🗺️)
3. View the visual diagram showing relationships
4. **Copy complete SQL query** - Click "Copy Query" button for full SELECT with all JOINs
5. **Copy individual JOINs** - Click copy button next to any relationship
6. Hover over elements to see additional info
7. Click green tables to navigate to them

### ERD Elements
- **Blue Box**: Current table (center)
- **Green Boxes**: Referenced tables (clickable)
- **Arrows**: Point from FK column to referenced table
- **Labels**: Show FK column name and join condition (e.g., `CustomerID = CustomerID`)
- **SQL Section**: Complete query example with all JOINs
- **Individual JOINs**: Each relationship's SQL with copy button
- **Counts**: If multiple FKs to same table, count is shown

### SQL Features
The ERD automatically generates SQL code:

**Complete Query Example**:
```sql
SELECT *
FROM [Sales].[SalesOrderHeader] so
JOIN [Sales].[Customer] cu
  ON so.[CustomerID] = cu.[CustomerID]
JOIN [Sales].[SalesTerritory] st
  ON so.[TerritoryID] = st.[TerritoryID]
```

**Individual JOINs**: Each relationship shown separately with copy button

**Use the SQL**:
1. Click "Copy Query" for complete SELECT statement
2. Or copy individual JOINs as needed
3. Paste into your SQL editor
4. Modify SELECT columns and add WHERE clause

### Navigation
Click any green (referenced) table box to:
- Navigate to that table's details
- Switch to Columns tab automatically
- Explore that table's relationships

## Future Enhancements

Potential additions to the Data Catalog:
- **Column statistics**: Min/max values, distinct counts
- **Data lineage**: Track data flow between tables
- **Usage analytics**: Track which tables are queried most
- **Data quality scores**: Integration with Quality Builder
- **Export documentation**: Generate PDF/HTML documentation
- **Schema comparison**: Compare schemas across environments
- **SQL generation**: Generate common queries for tables
- **Reverse relationships**: Show tables that reference the current table (incoming FKs)
- **Multi-level ERD**: Show relationships 2-3 levels deep

## Support

For issues or questions:
1. Check backend logs: `docker logs ms3dm_toolkit-backend-1 --tail 100`
2. Check frontend console for JavaScript errors
3. Verify database connection in Configuration tab
4. Review this guide for common issues

---

**Built with**: React, Flask, SQL Server INFORMATION_SCHEMA
**Storage**: File-based JSON metadata
**Integration**: Works with all MS3DM Toolkit modules
