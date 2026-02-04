#!/bin/bash

# Wait for SQL Server to be ready
sleep 30s

# Download AdventureWorksLT2022 backup
echo "Downloading AdventureWorksLT2022 backup..."
curl -L -o /tmp/AdventureWorksLT2022.bak \
  https://github.com/Microsoft/sql-server-samples/releases/download/adventureworks/AdventureWorksLT2022.bak

# Restore database
echo "Restoring AdventureWorksLT2022..."
/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P $SA_PASSWORD -C -Q \
  "RESTORE DATABASE AdventureWorksLT2022 
   FROM DISK = '/tmp/AdventureWorksLT2022.bak' 
   WITH MOVE 'AdventureWorksLT2022_Data' TO '/var/opt/mssql/data/AdventureWorksLT2022.mdf',
        MOVE 'AdventureWorksLT2022_Log' TO '/var/opt/mssql/data/AdventureWorksLT2022_log.ldf',
        REPLACE"

# Create a sample reporting table for testing data flows
/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P $SA_PASSWORD -C -d AdventureWorksLT2022 -Q \
  "IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'reporting')
   BEGIN
     EXEC('CREATE SCHEMA reporting')
   END
   
   IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'reporting.CustomerSummary'))
   BEGIN
     CREATE TABLE reporting.CustomerSummary (
       CustomerID INT,
       TotalOrders INT,
       TotalAmount DECIMAL(18,2),
       LastOrderDate DATETIME,
       CreatedAt DATETIME DEFAULT GETDATE()
     )
   END"

echo "AdventureWorksLT2022 database initialized successfully!"
