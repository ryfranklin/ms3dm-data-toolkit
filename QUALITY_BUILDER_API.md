# Quality Builder API Specification

## Base URL
```
http://localhost:8000/api/expectations
```

## Endpoints

### 1. List All Expectation Suites

**GET** `/api/expectations/suites`

List all saved expectation suites.

**Response:**
```json
{
  "suites": [
    {
      "suite_id": "customer-validation-v1",
      "name": "Customer Data Validation",
      "description": "Core validation for customer table",
      "connection_id": "local_adventureworks",
      "target": {
        "schema": "SalesLT",
        "table": "Customer"
      },
      "expectation_count": 6,
      "last_run": "2024-02-03T14:30:00Z",
      "last_status": "passed",
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-02-03T14:30:00Z"
    }
  ]
}
```

### 2. Get Specific Suite

**GET** `/api/expectations/suites/:suite_id`

Get detailed information about a specific suite.

**Response:**
```json
{
  "suite_id": "customer-validation-v1",
  "name": "Customer Data Validation",
  "description": "Core validation rules for customer data",
  "connection_id": "local_adventureworks",
  "target": {
    "type": "table",
    "schema": "SalesLT",
    "table": "Customer"
  },
  "expectations": [
    {
      "id": "exp_001",
      "type": "expect_column_values_to_not_be_null",
      "name": "CustomerID Not Null",
      "column": "CustomerID",
      "params": {
        "mostly": 1.0
      },
      "severity": "error",
      "on_failure": {
        "log": true,
        "alert": true,
        "stop_pipeline": true
      },
      "meta": {
        "description": "Customer ID is required",
        "owner": "data-team"
      }
    }
  ],
  "schedule": {
    "enabled": true,
    "cron": "0 */6 * * *",
    "timezone": "UTC"
  },
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-02-03T14:30:00Z"
}
```

### 3. Create New Suite

**POST** `/api/expectations/suites`

Create a new expectation suite.

**Request Body:**
```json
{
  "name": "Product Validation",
  "description": "Validate product data integrity",
  "connection_id": "local_adventureworks",
  "target": {
    "schema": "SalesLT",
    "table": "Product"
  },
  "expectations": [
    {
      "type": "expect_column_values_to_not_be_null",
      "column": "ProductID",
      "severity": "error"
    },
    {
      "type": "expect_column_values_to_be_between",
      "column": "ListPrice",
      "params": {
        "min_value": 0,
        "max_value": 10000
      },
      "severity": "warning"
    }
  ]
}
```

**Response:**
```json
{
  "suite_id": "product-validation-v1",
  "message": "Suite created successfully"
}
```

### 4. Update Suite

**PUT** `/api/expectations/suites/:suite_id`

Update an existing suite.

**Request Body:** Same as Create Suite

**Response:**
```json
{
  "message": "Suite updated successfully"
}
```

### 5. Delete Suite

**DELETE** `/api/expectations/suites/:suite_id`

Delete an expectation suite.

**Response:**
```json
{
  "message": "Suite deleted successfully"
}
```

### 6. Run Suite

**POST** `/api/expectations/suites/:suite_id/run`

Execute all expectations in a suite.

**Optional Query Parameters:**
- `sample_size` - Number of rows to sample (default: all)
- `stop_on_first_failure` - Boolean (default: false)

**Response:**
```json
{
  "result_id": "res_20240203_143015",
  "suite_id": "customer-validation-v1",
  "suite_name": "Customer Data Validation",
  "execution_time": "2024-02-03T14:30:15Z",
  "duration_seconds": 2.34,
  "status": "failed",
  "statistics": {
    "total_expectations": 6,
    "passed": 5,
    "failed": 1,
    "warnings": 0
  },
  "results": [
    {
      "expectation_id": "exp_001",
      "expectation_name": "CustomerID Not Null",
      "expectation_type": "expect_column_values_to_not_be_null",
      "status": "passed",
      "success": true,
      "observed_value": {
        "total_rows": 847,
        "null_count": 0,
        "success_percentage": 100.0
      },
      "execution_time_ms": 45
    },
    {
      "expectation_id": "exp_002",
      "expectation_name": "Age Range Check",
      "expectation_type": "expect_column_values_to_be_between",
      "status": "failed",
      "success": false,
      "observed_value": {
        "total_rows": 847,
        "failed_count": 67,
        "success_percentage": 92.1
      },
      "failed_samples": [
        {"CustomerID": 123, "Age": -1},
        {"CustomerID": 456, "Age": 150}
      ],
      "details": {
        "min_value": 0,
        "max_value": 120
      },
      "execution_time_ms": 156
    }
  ]
}
```

### 7. Run Ad-hoc Checks

**POST** `/api/expectations/run-adhoc`

Run expectations without saving as a suite (for testing).

**Request Body:**
```json
{
  "connection_id": "local_adventureworks",
  "target": {
    "schema": "SalesLT",
    "table": "Customer"
  },
  "expectations": [
    {
      "type": "expect_column_values_to_not_be_null",
      "column": "CustomerID"
    }
  ]
}
```

**Response:** Same as Run Suite

### 8. Validate Single Expectation

**POST** `/api/expectations/validate`

Test a single expectation (for UI preview).

**Request Body:**
```json
{
  "connection_id": "local_adventureworks",
  "expectation": {
    "type": "expect_column_values_to_be_between",
    "target": {
      "schema": "SalesLT",
      "table": "Customer"
    },
    "column": "Age",
    "params": {
      "min_value": 0,
      "max_value": 120
    }
  }
}
```

**Response:**
```json
{
  "success": false,
  "expectation_type": "expect_column_values_to_be_between",
  "observed_value": {
    "total_rows": 847,
    "failed_count": 67,
    "success_percentage": 92.1
  },
  "failed_samples": [
    {"Age": -1},
    {"Age": 150}
  ],
  "details": {
    "min_value": 0,
    "max_value": 120,
    "query": "SELECT * FROM [SalesLT].[Customer] WHERE Age < 0 OR Age > 120"
  },
  "execution_time_ms": 145
}
```

### 9. Get Execution History

**GET** `/api/expectations/results`

Get history of all expectation suite executions.

**Query Parameters:**
- `suite_id` - Filter by suite (optional)
- `limit` - Number of results (default: 50)
- `status` - Filter by status: passed|failed|warning (optional)

**Response:**
```json
{
  "results": [
    {
      "result_id": "res_20240203_143015",
      "suite_id": "customer-validation-v1",
      "suite_name": "Customer Data Validation",
      "execution_time": "2024-02-03T14:30:15Z",
      "duration_seconds": 2.34,
      "status": "failed",
      "passed": 5,
      "failed": 1,
      "total": 6
    }
  ],
  "total_count": 127,
  "page": 1
}
```

### 10. Get Execution Result Details

**GET** `/api/expectations/results/:result_id`

Get detailed results for a specific execution.

**Response:** Same as Run Suite response

### 11. Get Available Expectations

**GET** `/api/expectations/library`

Get catalog of all available expectation types.

**Response:**
```json
{
  "categories": {
    "column_value": {
      "name": "Column Value Checks",
      "icon": "🔢",
      "expectations": [
        {
          "id": "expect_column_values_to_not_be_null",
          "name": "Not Null",
          "icon": "❌",
          "description": "Column values should not be null",
          "parameters": [
            {
              "name": "mostly",
              "type": "number",
              "default": 1.0,
              "min": 0,
              "max": 1,
              "description": "Fraction of values that must pass"
            }
          ],
          "sql_template": "SELECT COUNT(*) FROM {table} WHERE {column} IS NULL"
        }
      ]
    }
  }
}
```

### 12. Generate Suite from Table Profile

**POST** `/api/expectations/generate`

Auto-generate expectations based on table profiling.

**Request Body:**
```json
{
  "connection_id": "local_adventureworks",
  "schema": "SalesLT",
  "table": "Customer",
  "options": {
    "include_nullability": true,
    "include_uniqueness": true,
    "include_value_ranges": true,
    "include_regex_patterns": false
  }
}
```

**Response:**
```json
{
  "suggested_expectations": [
    {
      "type": "expect_column_values_to_not_be_null",
      "column": "CustomerID",
      "confidence": 1.0,
      "reason": "No null values found in 847 rows"
    },
    {
      "type": "expect_column_values_to_be_unique",
      "column": "CustomerID",
      "confidence": 1.0,
      "reason": "All 847 values are unique"
    },
    {
      "type": "expect_column_values_to_be_between",
      "column": "Age",
      "params": {
        "min_value": 18,
        "max_value": 95
      },
      "confidence": 0.95,
      "reason": "Observed min=18, max=95 in sample"
    }
  ]
}
```

## Error Responses

All endpoints may return these error responses:

### 400 Bad Request
```json
{
  "error": "Invalid expectation type: expect_foo_bar",
  "details": "Expectation type must be one of: [...]"
}
```

### 404 Not Found
```json
{
  "error": "Suite not found: invalid-suite-id"
}
```

### 500 Internal Server Error
```json
{
  "error": "Database connection failed",
  "details": "Unable to connect to SQL Server"
}
```

## Webhook Integration (Future)

**POST** `/api/expectations/webhooks`

Configure webhooks for notifications.

**Request Body:**
```json
{
  "suite_id": "customer-validation-v1",
  "webhook_url": "https://hooks.slack.com/services/...",
  "events": ["on_failure", "on_warning"],
  "payload_template": {
    "text": "Data quality check failed: {suite_name}",
    "attachments": [
      {
        "title": "Results",
        "text": "{summary}"
      }
    ]
  }
}
```

## Client Library Example (JavaScript)

```javascript
// frontend/src/api/expectations.js
import apiClient from './client';

export const expectationsApi = {
  // List suites
  listSuites: () => apiClient.get('/api/expectations/suites'),
  
  // Get suite
  getSuite: (suiteId) => apiClient.get(`/api/expectations/suites/${suiteId}`),
  
  // Create suite
  createSuite: (data) => apiClient.post('/api/expectations/suites', data),
  
  // Update suite
  updateSuite: (suiteId, data) => apiClient.put(`/api/expectations/suites/${suiteId}`, data),
  
  // Delete suite
  deleteSuite: (suiteId) => apiClient.delete(`/api/expectations/suites/${suiteId}`),
  
  // Run suite
  runSuite: (suiteId, options = {}) => 
    apiClient.post(`/api/expectations/suites/${suiteId}/run`, options),
  
  // Run ad-hoc
  runAdhoc: (data) => apiClient.post('/api/expectations/run-adhoc', data),
  
  // Validate single
  validateExpectation: (data) => apiClient.post('/api/expectations/validate', data),
  
  // Get library
  getLibrary: () => apiClient.get('/api/expectations/library'),
  
  // Get history
  getHistory: (params = {}) => apiClient.get('/api/expectations/results', { params }),
  
  // Get result details
  getResult: (resultId) => apiClient.get(`/api/expectations/results/${resultId}`),
  
  // Generate from profile
  generateSuite: (data) => apiClient.post('/api/expectations/generate', data),
};
```

## Usage Examples

### Example 1: Quick Validation Test

```javascript
// Test a single check before adding to suite
const result = await expectationsApi.validateExpectation({
  connection_id: 'local_adventureworks',
  expectation: {
    type: 'expect_column_values_to_not_be_null',
    target: { schema: 'SalesLT', table: 'Customer' },
    column: 'CustomerID'
  }
});

if (result.success) {
  console.log('✓ No null values found!');
} else {
  console.log(`✗ Found ${result.observed_value.null_count} nulls`);
}
```

### Example 2: Create and Run Suite

```javascript
// Create suite
const suite = await expectationsApi.createSuite({
  name: 'Daily Customer Check',
  connection_id: 'local_adventureworks',
  target: { schema: 'SalesLT', table: 'Customer' },
  expectations: [
    { type: 'expect_column_values_to_not_be_null', column: 'CustomerID' },
    { type: 'expect_column_values_to_be_unique', column: 'Email' },
    { 
      type: 'expect_column_values_to_be_recent',
      column: 'ModifiedDate',
      params: { max_age_hours: 24 }
    }
  ]
});

// Run immediately
const result = await expectationsApi.runSuite(suite.suite_id);

console.log(`Status: ${result.status}`);
console.log(`Passed: ${result.statistics.passed}/${result.statistics.total_expectations}`);
```

### Example 3: Auto-Generate Suite

```javascript
// Profile table and get suggestions
const suggestions = await expectationsApi.generateSuite({
  connection_id: 'local_adventureworks',
  schema: 'SalesLT',
  table: 'Customer',
  options: { include_value_ranges: true }
});

// Review suggestions
suggestions.suggested_expectations.forEach(exp => {
  console.log(`${exp.type} on ${exp.column}`);
  console.log(`  Confidence: ${exp.confidence}`);
  console.log(`  Reason: ${exp.reason}`);
});

// Accept all high-confidence suggestions
const autoExpectations = suggestions.suggested_expectations
  .filter(exp => exp.confidence > 0.9);

// Create suite from suggestions
await expectationsApi.createSuite({
  name: 'Auto-generated Customer Validation',
  connection_id: 'local_adventureworks',
  target: { schema: 'SalesLT', table: 'Customer' },
  expectations: autoExpectations
});
```

---

This API provides a complete foundation for building the visual Quality Builder interface!
