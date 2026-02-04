# Data Dictionary Guide

## Overview

The Data Dictionary feature provides comprehensive, documentation-style views of all database tables and columns with rich metadata. It's designed to serve as the single source of truth for understanding your database schema.

## Features

### 📊 Comprehensive Documentation

The Data Dictionary displays:
- **All tables** across all schemas with detailed column information
- **Data types** and nullability constraints
- **Primary and Foreign Keys** with relationship indicators
- **Business metadata** (descriptions, owners, tags)
- **Relationship mappings** showing how tables connect

### 🔍 Advanced Filtering & Search

**Schema Filter**
- View all schemas or filter to a specific schema
- Quickly narrow down to relevant tables

**Search Functionality**
- Search across table names, descriptions, and column names
- Finds matches in both technical names and business descriptions
- Real-time filtering as you type

**Example Searches:**
- `Customer` - Finds all tables/columns related to customers
- `email` - Finds all email-related fields
- `address` - Locates address information across the database

### 📥 Export Capabilities

Export your data dictionary in multiple formats:

#### **HTML Document**
- Professional, styled documentation
- Includes statistics dashboard
- Color-coded keys and constraints
- Printable and shareable
- Clickable table of contents
- Perfect for stakeholder presentations

**Use Cases:**
- Executive documentation
- Team onboarding materials
- Audit compliance reports
- Client deliverables

#### **CSV Spreadsheet**
- Flat file with all column metadata
- One row per column
- Includes: Schema, Table, Column, Data Type, Keys, Descriptions
- Easy to filter and analyze in Excel/Google Sheets
- Great for data analysis and reporting

**Use Cases:**
- Data profiling analysis
- Impact analysis for schema changes
- Business intelligence metadata imports
- Data governance tracking

#### **Markdown**
- Clean, readable text format
- Compatible with Git/GitHub
- Can be versioned with code
- Easy to convert to other formats (PDF, HTML)
- Great for documentation sites (MkDocs, Docusaurus)

**Use Cases:**
- Version-controlled documentation
- GitHub wikis
- Technical documentation sites
- Developer reference materials

### 🎯 Interactive Views

**Expandable Tables**
- Click table names to expand/collapse column details
- "Expand All" / "Collapse All" quick controls
- Only show what you need to see

**Relationship Indicators**
- Primary Keys highlighted in yellow
- Foreign Keys highlighted in green
- Relationship summary showing all FK connections
- References displayed as: `column → referenced_table.referenced_column`

**Color Coding:**
- 🟡 **Yellow badges** - Primary Keys (PK)
- 🟢 **Green badges** - Foreign Keys (FK)
- 🔴 **Red text** - Nullable columns
- ✅ **Green text** - Non-nullable columns

### 📈 Statistics Dashboard

Real-time statistics show:
- **Total Schemas** - Number of database schemas
- **Total Tables** - All tables in selected scope
- **Total Columns** - Sum of all columns
- **Total Relationships** - Count of foreign key relationships

These stats update dynamically based on your filters and search.

## How to Use

### Basic Workflow

1. **Navigate to Data Dictionary Tab**
   - Open Data Catalog from main navigation
   - Click the "📚 Data Dictionary" tab

2. **Select Connection**
   - Choose your database connection from the dropdown
   - Dictionary automatically loads all metadata

3. **Browse or Search**
   - Use the search box to find specific tables/columns
   - Filter by schema if you know which schema you need
   - Expand tables to see full column details

4. **Export Documentation**
   - Choose your export format (HTML, CSV, or Markdown)
   - Click "📥 Export Dictionary"
   - File downloads automatically

### Advanced Use Cases

#### Use Case 1: Onboarding New Team Members

**Scenario:** New data analyst joins the team and needs to understand the database schema.

**Solution:**
1. Export as **HTML Document**
2. Share the professional, formatted document
3. New hire can search for specific tables
4. Relationships help them understand data flow

**Benefits:**
- Self-service documentation
- Reduces repetitive questions
- Professional presentation
- Always up-to-date

#### Use Case 2: Impact Analysis for Schema Changes

**Scenario:** Need to modify the `Customers` table and want to know what will be affected.

**Solution:**
1. Search for `Customers` in the dictionary
2. Expand the table to see all columns
3. Review the "🔗 Relationships" section
4. Identify all FK references to this table
5. Export as **CSV** for detailed analysis

**Benefits:**
- Quickly identify dependencies
- Plan migration strategy
- Minimize breaking changes
- Document impact in spreadsheet

#### Use Case 3: Data Governance Documentation

**Scenario:** Compliance audit requires documentation of all PII fields and their owners.

**Solution:**
1. Filter to relevant schemas (e.g., `CustomerData`)
2. Search for common PII terms (`email`, `SSN`, `address`)
3. Export as **CSV**
4. Use spreadsheet to add audit columns
5. Track data stewardship and compliance

**Benefits:**
- Comprehensive audit trail
- Easy to track ownership
- CSV format integrates with governance tools
- Historical versioning

#### Use Case 4: Developer Reference

**Scenario:** Development team needs up-to-date schema documentation in their Git repository.

**Solution:**
1. Export as **Markdown**
2. Commit to repository at `docs/database/schema.md`
3. Link from README or developer wiki
4. Re-export when schema changes
5. Version control tracks changes over time

**Benefits:**
- Documentation lives with code
- Git diffs show schema changes
- Easy to review in pull requests
- Always available to developers

#### Use Case 5: Client Deliverable

**Scenario:** Need to provide database documentation to a client or partner.

**Solution:**
1. Filter to relevant schemas (exclude internal schemas)
2. Ensure all tables have descriptions
3. Export as **HTML Document**
4. Professional, branded documentation
5. Email or host on web server

**Benefits:**
- Professional appearance
- No database access needed for client
- Preserves privacy (only shows metadata)
- Shareable and printable

## Metadata Best Practices

### Table Descriptions

Good table descriptions explain the **business purpose**, not just the technical name:

❌ **Bad:** "Stores customer data"
✅ **Good:** "Central repository for all customer information including contact details, preferences, and account status. Updated by CRM sync nightly."

### Column Descriptions

Good column descriptions include:
- **Business meaning** - What does this field represent?
- **Valid values** - What are acceptable values/ranges?
- **Calculation logic** - For derived fields, how is it calculated?
- **Data source** - Where does this data come from?

**Examples:**

❌ **Bad:** "Customer email"
✅ **Good:** "Primary email address for customer communication. Must be unique. Validated on entry. Used for password resets and marketing campaigns."

❌ **Bad:** "Status code"
✅ **Good:** "Order status code. Valid values: PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED. Updated by warehouse system."

### Owners & Tags

**Owners:**
- Assign a data steward or team responsible for the table
- Use email addresses or team names
- Examples: `data-team@company.com`, `Sales Analytics Team`

**Tags:**
- Use consistent taxonomy across tables
- Common tags: `PII`, `Financial`, `Audit`, `Deprecated`, `Critical`
- Tags enable filtering and governance
- Keep tags lowercase and hyphenated: `customer-data`, `sensitive-pii`

## Export Format Comparison

| Feature | HTML | CSV | Markdown |
|---------|------|-----|----------|
| **Visual Appeal** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Data Analysis** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **Version Control** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Shareability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Printable** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Searchable** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Tool Integration** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **File Size** | Medium | Small | Small |

### When to Use Each Format

**Use HTML when:**
- Presenting to non-technical stakeholders
- Creating client deliverables
- Need professional appearance
- Want clickable navigation
- Printing documentation

**Use CSV when:**
- Analyzing data in spreadsheets
- Importing to other tools
- Tracking compliance/governance
- Performing bulk metadata updates
- Integrating with BI tools

**Use Markdown when:**
- Version controlling documentation
- Publishing to Git/GitHub
- Building documentation sites
- Developer-focused documentation
- Need plain text format

## Integration with Other Features

### Schema Explorer
- Browse visually, then export via Dictionary
- Dictionary provides more complete view
- Explorer better for navigation

### Table Details
- Detailed view of single table
- Use for editing metadata
- Dictionary shows all tables at once

### Search
- Quick lookup of specific items
- Dictionary provides comprehensive export
- Search better for finding, Dictionary for documenting

### ERD
- Visual relationship diagram
- Dictionary shows relationships in table format
- Use together for complete understanding

## Tips & Tricks

### Tip 1: Progressive Disclosure
- Start collapsed (default view)
- Expand only relevant sections
- Use search to find specific items
- Keep view manageable

### Tip 2: Regular Exports
- Export monthly for documentation archives
- Track schema evolution over time
- Include export date in filename
- Store in shared documentation repository

### Tip 3: Metadata Enrichment Workflow
1. Export dictionary as CSV
2. Add descriptions in spreadsheet (easier bulk editing)
3. Re-import or manually update via Table Details
4. Re-export for distribution

### Tip 4: Schema-Specific Exports
- Filter to single schema before export
- Creates focused documentation
- Useful for team-specific docs
- Smaller, more relevant files

### Tip 5: Combine with Screenshots
- Export HTML
- Take screenshots of key sections
- Include in presentations
- Annotate for training materials

## Keyboard Shortcuts

- **Ctrl/Cmd + F** - Focus search box (browser native)
- **Escape** - Clear search
- **Tab** - Navigate between controls

## Troubleshooting

### Issue: Tables showing "No description"

**Solution:** 
- Click "Table Details" for a specific table
- Add descriptions in edit mode
- Save metadata
- Return to Data Dictionary - descriptions now appear

### Issue: Export file is too large

**Solutions:**
- Filter to specific schema before export
- Use CSV format (smaller than HTML)
- Search for specific tables only
- Consider exporting schemas separately

### Issue: Foreign keys not showing

**Possible Causes:**
- FKs not defined in database (only app-level relationships)
- Permissions issue reading system tables
- Schema not fully loaded

**Solution:**
- Check database for actual FK constraints
- Verify connection permissions
- Reload the catalog

### Issue: Columns showing no data types

**Cause:** Metadata not loaded for some tables

**Solution:**
- Refresh the Data Dictionary tab
- Check backend logs for errors
- Verify table access permissions

## Summary

The Data Dictionary is your **single source of truth** for database schema documentation. Use it to:

✅ **Document** your database comprehensively  
✅ **Onboard** new team members quickly  
✅ **Analyze** schema for impact analysis  
✅ **Govern** data with ownership and tags  
✅ **Share** professional documentation  
✅ **Export** in multiple formats for different needs  

Keep your metadata up-to-date, and the Data Dictionary becomes an invaluable tool for your entire organization.
