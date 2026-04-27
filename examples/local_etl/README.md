# Local ETL Examples

Sample data files for the Local ETL workbench.

## Quick Start

1. Copy these files into your local storage directory:

```bash
cp examples/local_etl/customers.csv local_storage/
cp examples/local_etl/orders.json local_storage/
```

2. Open the app and navigate to **ETL** > **Local ETL** tab.

3. Try these queries:

```sql
-- List all customers
SELECT * FROM customers;

-- Customers in Washington state
SELECT * FROM customers WHERE state = 'WA';

-- Join customers with orders
SELECT
    c.first_name,
    c.last_name,
    o.product,
    o.quantity,
    o.price
FROM customers c
JOIN orders o ON c.customer_id = o.customer_id
ORDER BY o.order_date;

-- Revenue by customer
SELECT
    c.first_name || ' ' || c.last_name AS customer,
    COUNT(*) AS order_count,
    SUM(o.quantity * o.price) AS total_revenue
FROM customers c
JOIN orders o ON c.customer_id = o.customer_id
GROUP BY c.first_name, c.last_name
ORDER BY total_revenue DESC;
```
