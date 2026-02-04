# Catalog Metadata Protection

## Overview

Catalog metadata is **permanently protected** from automatic cleanup to preserve valuable business documentation.

## What is Catalog Metadata?

Catalog metadata is stored in `backend/catalog_metadata/` and contains:

- **Table Descriptions** - Business purpose and context for each table
- **Column Descriptions** - Business meaning and usage of each column
- **Owners** - Data stewards and responsible teams
- **Tags** - Classification and categorization (PII, Financial, etc.)
- **Custom Business Metadata** - Any additional documentation

## Why It's Protected

### 1. **Valuable Business Knowledge**
Catalog metadata represents **human-curated business knowledge** that cannot be recreated automatically. Users spend time documenting their databases, and this documentation is critical for:
- Team onboarding
- Data governance
- Compliance audits
- Cross-team collaboration

### 2. **Small Storage Footprint**
Unlike quality results or logs, catalog metadata files are:
- Extremely small (typically < 10 KB per table)
- Infrequently modified
- Not generated in high volume

**Example Storage:**
```
100 tables × 5 KB metadata = 500 KB total
Even 1000 tables = ~5 MB

Compare to:
- Quality results: Can grow to hundreds of MB
- Logs: Can reach GB in production
```

### 3. **Single Source of Truth**
The catalog metadata files are the **only copy** of this documentation. Unlike database schema (which is in SQL Server) or quality results (which can be regenerated), catalog metadata exists only in these JSON files.

### 4. **Cannot Be Regenerated**
If catalog metadata is deleted or compressed:
- Business descriptions are lost forever
- No automated way to recreate them
- Represents lost institutional knowledge
- Teams must re-document everything manually

## Storage Cleanup Policy

### What Gets Cleaned Up

| Type | Location | Cleanup Policy | Reason |
|------|----------|----------------|--------|
| **Quality Results** | `backend/expectations_results/` | Delete after 30 days | Regenerable, high volume |
| **Application Logs** | `backend/logs/` | Delete after 30 days | Debugging history, high volume |
| **Catalog Metadata** | `backend/catalog_metadata/` | **NEVER** | Irreplaceable business docs |

### Cleanup Script Protection

The storage cleanup workflow (`backend/api/storage.py` → `/execute-cleanup` endpoint) explicitly:

1. **Skips catalog metadata** - No compression, no deletion
2. **Monitors storage** - Tracks size for reporting only
3. **Documents preservation** - Logs "Catalog metadata preserved"

```python
# NOTE: Catalog metadata is NEVER cleaned up or compressed
# It contains valuable business documentation (table descriptions, owners, tags)
# that users manually enter and should be preserved permanently.
results['actions'].append('Catalog metadata preserved (never cleaned up)')
```

## Storage Monitoring

While catalog metadata is never cleaned up, it **is monitored** for:
- Size reporting in storage dashboard
- File count statistics
- Health checks

This monitoring helps track overall storage usage without modifying the files.

## Backup Recommendations

Even though catalog metadata is protected from cleanup, we recommend:

### 1. **Version Control** (Recommended)
```bash
# Add catalog metadata to Git
git add backend/catalog_metadata/*.json
git commit -m "Update table documentation"
git push
```

**Benefits:**
- Track changes over time
- See who updated what
- Rollback if needed
- Collaboration history

### 2. **Regular Backups**
```bash
# Backup to external location
tar -czf catalog-metadata-backup-$(date +%Y%m%d).tar.gz backend/catalog_metadata/

# Or use rsync
rsync -av backend/catalog_metadata/ /backup/location/catalog_metadata/
```

**Schedule:**
- Weekly backups recommended
- Monthly archives for long-term storage
- Test restore process periodically

### 3. **Export as Documentation**
```bash
# Export Data Dictionary as HTML/CSV/Markdown
# Use the Data Catalog UI → Data Dictionary → Export
```

**Benefits:**
- Shareable documentation
- Human-readable format
- Archive-friendly
- Offline access

## What If Metadata Was Lost?

If catalog metadata is accidentally deleted:

### Immediate Actions

1. **Check Git history** (if versioned)
   ```bash
   git log backend/catalog_metadata/
   git checkout HEAD~1 backend/catalog_metadata/
   ```

2. **Restore from backup**
   ```bash
   tar -xzf catalog-metadata-backup-YYYYMMDD.tar.gz
   ```

3. **Check container volumes**
   ```bash
   docker volume ls
   # Metadata might be in a volume backup
   ```

### Prevention

The cleanup script now **prevents this scenario** by:
- Never touching catalog metadata files
- Documenting this policy in code comments
- Logging preservation in cleanup results

## File Structure

Catalog metadata files are organized by table:

```
backend/catalog_metadata/
├── .gitkeep
├── schema1_table1.json
├── schema1_table2.json
├── schema2_table1.json
└── ...
```

Each file contains:
```json
{
  "schema": "SalesLT",
  "table": "Customer",
  "description": "Central customer information...",
  "owner": "Sales Team",
  "tags": ["pii", "customer-data"],
  "columns": {
    "CustomerID": {
      "description": "Unique customer identifier"
    },
    "EmailAddress": {
      "description": "Primary email for customer communication"
    }
  }
}
```

## Development vs Production

### Development Environment
- Metadata can be experimental
- Safe to test different descriptions
- Easy to reset if needed

### Production Environment
- Metadata should be backed up
- Consider version control
- Document ownership
- Regular export for disaster recovery

## Compliance & Governance

For organizations with strict governance requirements:

### Audit Trail
- Git commits provide full audit trail
- Track who changed what and when
- Review changes before merging

### Access Control
- Limit who can edit metadata
- Use Git branch protection
- Require reviews for changes

### Retention Policy
```
Catalog Metadata Retention: PERMANENT
- Never automatically deleted
- Backed up with application data
- Versioned in source control
- Exported for documentation
```

## Summary

✅ **Catalog metadata is permanently protected**
✅ **Never compressed or deleted by cleanup**
✅ **Monitored but not modified**
✅ **Small storage footprint (~KB per table)**
✅ **Contains irreplaceable business knowledge**
✅ **Should be backed up/versioned**

The storage cleanup workflow safely removes temporary files (quality results, logs) while preserving your valuable documentation. Your table descriptions, owners, tags, and business metadata are safe and will never be automatically removed.

## Verification

To verify catalog metadata is protected:

1. **Check cleanup endpoint**
   ```bash
   curl http://localhost:8000/api/storage/cleanup-info | jq
   ```
   Should show: "Preserve catalog metadata (never cleaned up...)"

2. **Run cleanup manually**
   ```bash
   curl -X POST http://localhost:8000/api/storage/execute-cleanup | jq
   ```
   Results should show: "Catalog metadata preserved"

3. **Check files after cleanup**
   ```bash
   ls -la backend/catalog_metadata/
   # All .json files should still exist (no .gz files)
   ```

Your documentation is safe! 🛡️
