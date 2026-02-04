-- Add Date Key Demo Data to AdventureWorks
-- This script adds computed date key columns and a test table for demonstration

USE AdventureWorksLT2022;
GO

-- 1. Add OrderDateKey to SalesOrderHeader (computed column)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('SalesLT.SalesOrderHeader') 
    AND name = 'OrderDateKey'
)
BEGIN
    ALTER TABLE SalesLT.SalesOrderHeader
    ADD OrderDateKey AS CAST(
        YEAR(OrderDate) * 10000 + 
        MONTH(OrderDate) * 100 + 
        DAY(OrderDate) AS INT
    );
    PRINT 'Added OrderDateKey column to SalesOrderHeader';
END
ELSE
BEGIN
    PRINT 'OrderDateKey column already exists';
END
GO

-- 2. Add ShipDateKey to SalesOrderHeader
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('SalesLT.SalesOrderHeader') 
    AND name = 'ShipDateKey'
)
BEGIN
    ALTER TABLE SalesLT.SalesOrderHeader
    ADD ShipDateKey AS CAST(
        YEAR(ShipDate) * 10000 + 
        MONTH(ShipDate) * 100 + 
        DAY(ShipDate) AS INT
    );
    PRINT 'Added ShipDateKey column to SalesOrderHeader';
END
ELSE
BEGIN
    PRINT 'ShipDateKey column already exists';
END
GO

-- 3. Create a test table with various date key scenarios
IF OBJECT_ID('SalesLT.DateKeyTest', 'U') IS NOT NULL
    DROP TABLE SalesLT.DateKeyTest;
GO

CREATE TABLE SalesLT.DateKeyTest (
    TestID INT IDENTITY(1,1) PRIMARY KEY,
    DateKeyValue INT,
    Description VARCHAR(100),
    ExpectedResult VARCHAR(20)
);
GO

-- Insert test data with valid and invalid date keys
INSERT INTO SalesLT.DateKeyTest (DateKeyValue, Description, ExpectedResult) VALUES
-- Valid date keys
(20260203, 'Today - February 3, 2026', 'VALID'),
(20260101, 'New Year 2026', 'VALID'),
(20251225, 'Christmas 2025', 'VALID'),
(20240229, 'Leap Day 2024', 'VALID'),
(20250704, 'Independence Day 2025', 'VALID'),
(20251031, 'Halloween 2025', 'VALID'),
(20200101, 'Start of decade', 'VALID'),
(20300515, 'Future date', 'VALID'),

-- Invalid date keys
(20261332, 'Invalid month (13)', 'INVALID'),
(20260232, 'Invalid day in Feb (32)', 'INVALID'),
(20260431, 'Invalid day in April (31)', 'INVALID'),
(2026023, 'Too few digits (7)', 'INVALID'),
(202602031, 'Too many digits (9)', 'INVALID'),
(NULL, 'NULL date key', 'INVALID'),
(0, 'Zero value', 'INVALID'),
(99999999, 'Out of range high', 'INVALID'),
(19000101, 'Very old date', 'VALID'),
(20260230, 'Invalid Feb 30', 'INVALID');
GO

-- 4. Create a simple date dimension for testing
IF OBJECT_ID('SalesLT.DimDate', 'U') IS NOT NULL
    DROP TABLE SalesLT.DimDate;
GO

CREATE TABLE SalesLT.DimDate (
    DateKey INT PRIMARY KEY,
    FullDate DATE,
    Year INT,
    Quarter INT,
    Month INT,
    MonthName VARCHAR(20),
    Day INT,
    DayOfWeek INT,
    DayName VARCHAR(20),
    IsWeekend BIT,
    IsHoliday BIT
);
GO

-- Populate with sample dates (2024-2026)
DECLARE @StartDate DATE = '2024-01-01';
DECLARE @EndDate DATE = '2026-12-31';

WITH DateRange AS (
    SELECT @StartDate AS DateValue
    UNION ALL
    SELECT DATEADD(DAY, 1, DateValue)
    FROM DateRange
    WHERE DateValue < @EndDate
)
INSERT INTO SalesLT.DimDate (DateKey, FullDate, Year, Quarter, Month, MonthName, Day, DayOfWeek, DayName, IsWeekend, IsHoliday)
SELECT 
    CAST(YEAR(DateValue) * 10000 + MONTH(DateValue) * 100 + DAY(DateValue) AS INT) AS DateKey,
    DateValue AS FullDate,
    YEAR(DateValue) AS Year,
    DATEPART(QUARTER, DateValue) AS Quarter,
    MONTH(DateValue) AS Month,
    DATENAME(MONTH, DateValue) AS MonthName,
    DAY(DateValue) AS Day,
    DATEPART(WEEKDAY, DateValue) AS DayOfWeek,
    DATENAME(WEEKDAY, DateValue) AS DayName,
    CASE WHEN DATEPART(WEEKDAY, DateValue) IN (1, 7) THEN 1 ELSE 0 END AS IsWeekend,
    0 AS IsHoliday -- Can be updated for specific holidays
FROM DateRange
OPTION (MAXRECURSION 0);
GO

PRINT 'Date dimension created with ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' records';
GO

-- 5. View sample data
PRINT '';
PRINT '=== Sample Valid Date Keys ===';
SELECT TOP 10 
    DateKeyValue,
    FORMAT(CONVERT(DATE, 
        STUFF(STUFF(CAST(DateKeyValue AS VARCHAR(8)), 7, 0, '-'), 5, 0, '-')
    ), 'MM/dd/yyyy') AS ConvertedDate,
    Description
FROM SalesLT.DateKeyTest
WHERE ExpectedResult = 'VALID'
ORDER BY DateKeyValue;

PRINT '';
PRINT '=== Sample Invalid Date Keys ===';
SELECT 
    DateKeyValue,
    Description,
    CASE 
        WHEN DateKeyValue IS NULL THEN 'NULL value'
        WHEN TRY_CONVERT(INT, DateKeyValue) IS NULL THEN 'Not an integer'
        WHEN LEN(CAST(DateKeyValue AS VARCHAR(20))) != 8 THEN 'Invalid length'
        WHEN TRY_CONVERT(DATE, 
            STUFF(STUFF(CAST(DateKeyValue AS VARCHAR(8)), 7, 0, '-'), 5, 0, '-')
        ) IS NULL THEN 'Invalid date'
        ELSE 'Valid'
    END AS ValidationIssue
FROM SalesLT.DateKeyTest
WHERE ExpectedResult = 'INVALID';

PRINT '';
PRINT '=== Date Keys in SalesOrderHeader ===';
SELECT TOP 5
    SalesOrderID,
    OrderDate,
    OrderDateKey,
    FORMAT(CONVERT(DATE, 
        STUFF(STUFF(CAST(OrderDateKey AS VARCHAR(8)), 7, 0, '-'), 5, 0, '-')
    ), 'MM/dd/yyyy') AS FormattedDate
FROM SalesLT.SalesOrderHeader
ORDER BY OrderDate DESC;

GO

PRINT '';
PRINT '===================================';
PRINT 'Date Key Demo Data Setup Complete!';
PRINT '===================================';
PRINT '';
PRINT 'Try these in Quality Builder:';
PRINT '';
PRINT '1. Validate SalesOrderHeader date keys:';
PRINT '   Table: SalesLT.SalesOrderHeader';
PRINT '   Column: OrderDateKey';
PRINT '';
PRINT '2. Test various scenarios:';
PRINT '   Table: SalesLT.DateKeyTest';
PRINT '   Column: DateKeyValue';
PRINT '';
PRINT '3. Validate date dimension:';
PRINT '   Table: SalesLT.DimDate';
PRINT '   Column: DateKey';
PRINT '   Min Date: 20240101';
PRINT '   Max Date: 20261231';
GO
