# Database Setup

This directory contains initialization scripts for the SQL Server container.

## AdventureWorksLT2022

The `init/01-adventureworks.sh` script automatically:
1. Downloads the AdventureWorksLT2022 backup file from Microsoft's GitHub
2. Restores the database to the SQL Server container
3. Creates a custom `reporting` schema with a `CustomerSummary` table for testing data flows

## First Run

On first `docker-compose up`, the SQL Server container will:
- Start SQL Server 2022 Developer Edition
- Wait approximately 30 seconds for the service to be ready
- Download and restore AdventureWorksLT2022 (~2-3 minutes total)

Check progress with:
```bash
docker-compose logs -f sqlserver
```

## Connection Details

- **Server:** localhost,1433
- **Username:** sa
- **Password:** YourStrong@Passw0rd
- **Database:** AdventureWorksLT2022

## Sample Data Included

- **847 Customers** with addresses
- **295 Products** with categories and descriptions
- **32 Sales Orders** with line items
- **Multiple foreign key relationships** for testing discovery
- **Custom reporting.CustomerSummary table** for testing transformations

## Troubleshooting

### Database Not Found After Container Restart

If you restart the Docker container and get "Login failed... database 'AdventureWorksLT2022'" errors:

**Quick Fix:**
```bash
# Download and restore the database manually
cd /tmp
curl -L -o AdventureWorksLT2022.bak \
  https://github.com/Microsoft/sql-server-samples/releases/download/adventureworks/AdventureWorksLT2022.bak

# Copy to container and restore
docker cp AdventureWorksLT2022.bak ms3dm_sqlserver:/tmp/
docker exec ms3dm_sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'YourStrong@Passw0rd' -C -Q \
  "RESTORE DATABASE AdventureWorksLT2022 FROM DISK = '/tmp/AdventureWorksLT2022.bak' 
   WITH MOVE 'AdventureWorksLT2022_Data' TO '/var/opt/mssql/data/AdventureWorksLT2022.mdf',
        MOVE 'AdventureWorksLT2022_Log' TO '/var/opt/mssql/data/AdventureWorksLT2022_log.ldf',
        REPLACE"

# Create reporting schema
docker exec ms3dm_sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'YourStrong@Passw0rd' -C -d AdventureWorksLT2022 -Q \
  "IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'reporting')
   BEGIN EXEC('CREATE SCHEMA reporting') END;
   IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'reporting.CustomerSummary'))
   BEGIN CREATE TABLE reporting.CustomerSummary (
     CustomerID INT, TotalOrders INT, TotalAmount DECIMAL(18,2),
     LastOrderDate DATETIME, CreatedAt DATETIME DEFAULT GETDATE()) END"
```

**Why this happens:** SQL Server uses persistent volumes, but when stopped with `docker-compose down -v` or if the volume is corrupted, the database needs to be restored again.
