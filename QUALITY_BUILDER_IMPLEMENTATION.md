# Quality Builder - Implementation Roadmap

## Quick Start Implementation (2-3 Days)

### Day 1: Basic UI Structure

#### 1. Create Component Structure
```bash
frontend/src/components/QualityBuilder/
├── QualityBuilder.jsx           # Main container
├── ExpectationLibrary.jsx       # Left sidebar with checks
├── CheckCanvas.jsx              # Center drag-drop area
├── ConfigPanel.jsx              # Right sidebar config
├── ResultsViewer.jsx            # Bottom results panel
└── expectationTemplates.js      # Check definitions
```

#### 2. Expectation Templates Data Structure
```javascript
// frontend/src/components/QualityBuilder/expectationTemplates.js
export const EXPECTATION_CATEGORIES = {
  column_value: {
    name: 'Column Value Checks',
    icon: '🔢',
    expectations: [
      {
        id: 'expect_column_values_to_not_be_null',
        name: 'Not Null',
        icon: '❌',
        description: 'Column values should not be null',
        params: [
          { name: 'mostly', type: 'number', default: 1.0, min: 0, max: 1 }
        ],
        sqlTemplate: 'SELECT COUNT(*) as null_count FROM {table} WHERE {column} IS NULL'
      },
      {
        id: 'expect_column_values_to_be_unique',
        name: 'Unique Values',
        icon: '🆔',
        description: 'Column values should be unique',
        params: [
          { name: 'mostly', type: 'number', default: 1.0, min: 0, max: 1 }
        ],
        sqlTemplate: 'SELECT {column}, COUNT(*) FROM {table} GROUP BY {column} HAVING COUNT(*) > 1'
      },
      {
        id: 'expect_column_values_to_be_between',
        name: 'Value Range',
        icon: '📊',
        description: 'Column values within min/max range',
        params: [
          { name: 'min_value', type: 'number', required: true },
          { name: 'max_value', type: 'number', required: true },
          { name: 'mostly', type: 'number', default: 1.0, min: 0, max: 1 }
        ],
        sqlTemplate: 'SELECT * FROM {table} WHERE {column} < {min_value} OR {column} > {max_value}'
      },
      {
        id: 'expect_column_values_to_be_in_set',
        name: 'In Value Set',
        icon: '🎯',
        description: 'Column values must be in allowed set',
        params: [
          { name: 'value_set', type: 'array', required: true },
          { name: 'mostly', type: 'number', default: 1.0 }
        ],
        sqlTemplate: 'SELECT * FROM {table} WHERE {column} NOT IN ({value_set})'
      },
      {
        id: 'expect_column_values_to_match_regex',
        name: 'Match Pattern',
        icon: '🔤',
        description: 'Column values match regex pattern',
        params: [
          { name: 'regex', type: 'string', required: true },
          { name: 'mostly', type: 'number', default: 1.0 }
        ],
        sqlTemplate: "SELECT * FROM {table} WHERE {column} NOT LIKE '{regex}'"
      }
    ]
  },
  column_stats: {
    name: 'Statistical Checks',
    icon: '📈',
    expectations: [
      {
        id: 'expect_column_mean_to_be_between',
        name: 'Mean Range',
        icon: '📊',
        description: 'Column mean within range',
        params: [
          { name: 'min_value', type: 'number', required: true },
          { name: 'max_value', type: 'number', required: true }
        ],
        sqlTemplate: 'SELECT AVG(CAST({column} AS FLOAT)) as mean_value FROM {table}'
      },
      {
        id: 'expect_column_stdev_to_be_between',
        name: 'Std Dev Range',
        icon: '📐',
        description: 'Standard deviation within range',
        params: [
          { name: 'min_value', type: 'number', required: true },
          { name: 'max_value', type: 'number', required: true }
        ],
        sqlTemplate: 'SELECT STDEV({column}) as stdev_value FROM {table}'
      }
    ]
  },
  table_checks: {
    name: 'Table-Level Checks',
    icon: '📋',
    expectations: [
      {
        id: 'expect_table_row_count_to_be_between',
        name: 'Row Count Range',
        icon: '🔢',
        description: 'Table row count within range',
        params: [
          { name: 'min_value', type: 'number', required: true },
          { name: 'max_value', type: 'number', required: false }
        ],
        sqlTemplate: 'SELECT COUNT(*) as row_count FROM {table}'
      },
      {
        id: 'expect_table_columns_to_match_ordered_list',
        name: 'Schema Match',
        icon: '📑',
        description: 'Table columns match expected list',
        params: [
          { name: 'column_list', type: 'array', required: true }
        ],
        sqlTemplate: 'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = {schema} AND TABLE_NAME = {table} ORDER BY ORDINAL_POSITION'
      }
    ]
  },
  freshness: {
    name: 'Data Freshness',
    icon: '⏱️',
    expectations: [
      {
        id: 'expect_column_values_to_be_recent',
        name: 'Recent Data',
        icon: '🕐',
        description: 'Data updated within threshold',
        params: [
          { name: 'column', type: 'string', required: true },
          { name: 'max_age_hours', type: 'number', default: 24 }
        ],
        sqlTemplate: 'SELECT MAX({column}) as max_date, DATEDIFF(HOUR, MAX({column}), GETDATE()) as age_hours FROM {table}'
      }
    ]
  }
};
```

### Day 2: Execution Engine

#### Backend API Structure
```python
# backend/api/expectations.py
from flask import Blueprint, request, jsonify
from services.expectation_engine import ExpectationEngine

expectations_bp = Blueprint('expectations', __name__)
engine = ExpectationEngine()

@expectations_bp.route('/suites', methods=['GET'])
def list_suites():
    """List all expectation suites"""
    suites = engine.list_suites()
    return jsonify({'suites': suites}), 200

@expectations_bp.route('/suites', methods=['POST'])
def create_suite():
    """Create new expectation suite"""
    data = request.json
    suite_id = engine.create_suite(data)
    return jsonify({'suite_id': suite_id}), 201

@expectations_bp.route('/suites/<suite_id>', methods=['GET'])
def get_suite(suite_id):
    """Get specific suite"""
    suite = engine.get_suite(suite_id)
    if not suite:
        return jsonify({'error': 'Suite not found'}), 404
    return jsonify(suite), 200

@expectations_bp.route('/suites/<suite_id>/run', methods=['POST'])
def run_suite(suite_id):
    """Execute expectation suite"""
    try:
        result = engine.run_suite(suite_id)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@expectations_bp.route('/expectations/validate', methods=['POST'])
def validate_single():
    """Validate single expectation (for testing)"""
    data = request.json
    result = engine.validate_expectation(
        connection_id=data['connection_id'],
        expectation=data['expectation']
    )
    return jsonify(result), 200
```

```python
# backend/services/expectation_engine.py
import uuid
from datetime import datetime
from typing import Dict, List, Any
from services.db_connector import DBConnector
from utils.config_manager import ConfigManager

class ExpectationEngine:
    def __init__(self):
        self.config_manager = ConfigManager()
    
    def validate_expectation(self, connection_id: str, expectation: Dict) -> Dict:
        """Execute a single expectation and return results"""
        connection = self.config_manager.get_connection(connection_id)
        db = DBConnector(connection)
        
        exp_type = expectation['type']
        params = expectation.get('params', {})
        
        # Route to appropriate validator
        if exp_type == 'expect_column_values_to_not_be_null':
            return self._validate_not_null(db, expectation)
        elif exp_type == 'expect_column_values_to_be_between':
            return self._validate_between(db, expectation)
        elif exp_type == 'expect_column_values_to_be_unique':
            return self._validate_unique(db, expectation)
        # ... more validators
        
        return {'error': f'Unknown expectation type: {exp_type}'}
    
    def _validate_not_null(self, db: DBConnector, expectation: Dict) -> Dict:
        """Validate not null constraint"""
        schema = expectation.get('target', {}).get('schema')
        table = expectation.get('target', {}).get('table')
        column = expectation.get('column')
        
        # Count nulls
        query = f"""
            SELECT 
                COUNT(*) as total_rows,
                SUM(CASE WHEN {column} IS NULL THEN 1 ELSE 0 END) as null_count
            FROM [{schema}].[{table}]
        """
        
        result = db.execute_query_dict(query)[0]
        total = result['total_rows']
        nulls = result['null_count']
        
        success = nulls == 0
        success_percentage = ((total - nulls) / total * 100) if total > 0 else 0
        
        return {
            'success': success,
            'expectation_type': expectation['type'],
            'observed_value': {
                'total_rows': total,
                'null_count': nulls,
                'success_percentage': round(success_percentage, 2)
            },
            'details': {
                'query': query
            }
        }
    
    def _validate_between(self, db: DBConnector, expectation: Dict) -> Dict:
        """Validate values are between min and max"""
        schema = expectation.get('target', {}).get('schema')
        table = expectation.get('target', {}).get('table')
        column = expectation.get('column')
        min_val = expectation['params']['min_value']
        max_val = expectation['params']['max_value']
        
        query = f"""
            SELECT 
                COUNT(*) as total_rows,
                SUM(CASE 
                    WHEN {column} < {min_val} OR {column} > {max_val} 
                    THEN 1 ELSE 0 
                END) as failed_count
            FROM [{schema}].[{table}]
            WHERE {column} IS NOT NULL
        """
        
        result = db.execute_query_dict(query)[0]
        total = result['total_rows']
        failed = result['failed_count']
        
        success = failed == 0
        success_percentage = ((total - failed) / total * 100) if total > 0 else 0
        
        # Get sample of failed rows
        sample_query = f"""
            SELECT TOP 10 {column}
            FROM [{schema}].[{table}]
            WHERE {column} < {min_val} OR {column} > {max_val}
        """
        
        failed_samples = db.execute_query_dict(sample_query)
        
        return {
            'success': success,
            'expectation_type': expectation['type'],
            'observed_value': {
                'total_rows': total,
                'failed_count': failed,
                'success_percentage': round(success_percentage, 2)
            },
            'failed_samples': failed_samples,
            'details': {
                'min_value': min_val,
                'max_value': max_val,
                'query': query
            }
        }
    
    def run_suite(self, suite_id: str) -> Dict:
        """Run all expectations in a suite"""
        suite = self.get_suite(suite_id)
        if not suite:
            raise ValueError(f"Suite {suite_id} not found")
        
        start_time = datetime.now()
        results = []
        
        connection_id = suite['connection_id']
        
        for expectation in suite['expectations']:
            try:
                result = self.validate_expectation(connection_id, expectation)
                results.append({
                    'expectation_id': expectation['id'],
                    'expectation_name': expectation.get('name', expectation['type']),
                    **result
                })
            except Exception as e:
                results.append({
                    'expectation_id': expectation['id'],
                    'success': False,
                    'error': str(e)
                })
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        passed = sum(1 for r in results if r.get('success'))
        failed = len(results) - passed
        
        return {
            'suite_id': suite_id,
            'suite_name': suite['name'],
            'execution_time': start_time.isoformat(),
            'duration_seconds': round(duration, 2),
            'status': 'passed' if failed == 0 else 'failed',
            'statistics': {
                'total_expectations': len(results),
                'passed': passed,
                'failed': failed
            },
            'results': results
        }
```

### Day 3: UI Components

#### Main Quality Builder Component
```javascript
// frontend/src/components/QualityBuilder/QualityBuilder.jsx
import React, { useState, useEffect } from 'react';
import { configApi } from '../../api/client';
import ExpectationLibrary from './ExpectationLibrary';
import CheckCanvas from './CheckCanvas';
import ConfigPanel from './ConfigPanel';
import ResultsViewer from './ResultsViewer';

function QualityBuilder() {
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState('');
  const [selectedTable, setSelectedTable] = useState(null);
  const [expectations, setExpectations] = useState([]);
  const [selectedExpectation, setSelectedExpectation] = useState(null);
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const data = await configApi.getConnections();
      setConnections(data.connections || []);
      if (data.connections && data.connections.length > 0) {
        setSelectedConnection(data.connections[0].id);
      }
    } catch (err) {
      console.error('Failed to load connections:', err);
    }
  };

  const handleAddExpectation = (expectationTemplate) => {
    const newExpectation = {
      id: `exp_${Date.now()}`,
      type: expectationTemplate.id,
      name: expectationTemplate.name,
      icon: expectationTemplate.icon,
      description: expectationTemplate.description,
      column: '',
      params: {},
      target: {
        schema: selectedTable?.schema || '',
        table: selectedTable?.name || ''
      }
    };
    setExpectations([...expectations, newExpectation]);
    setSelectedExpectation(newExpectation);
  };

  const handleUpdateExpectation = (id, updates) => {
    setExpectations(expectations.map(exp => 
      exp.id === id ? { ...exp, ...updates } : exp
    ));
  };

  const handleDeleteExpectation = (id) => {
    setExpectations(expectations.filter(exp => exp.id !== id));
    if (selectedExpectation?.id === id) {
      setSelectedExpectation(null);
    }
  };

  const handleRunChecks = async () => {
    setRunning(true);
    try {
      // Create temporary suite and run
      const suite = {
        name: 'Ad-hoc Validation',
        connection_id: selectedConnection,
        expectations: expectations
      };
      
      // Call API to run checks
      const response = await fetch('http://localhost:8000/api/expectations/run-adhoc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(suite)
      });
      
      const result = await response.json();
      setResults(result);
    } catch (err) {
      console.error('Failed to run checks:', err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Data Quality Builder
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Create and run data quality checks visually
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={selectedConnection}
              onChange={(e) => setSelectedConnection(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              {connections.map(conn => (
                <option key={conn.id} value={conn.id}>{conn.name}</option>
              ))}
            </select>
            <button
              onClick={handleRunChecks}
              disabled={running || expectations.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300"
            >
              {running ? '⏳ Running...' : '▶ Run Checks'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Expectation Library */}
        <ExpectationLibrary onAddExpectation={handleAddExpectation} />

        {/* Center: Check Canvas */}
        <CheckCanvas
          expectations={expectations}
          selectedExpectation={selectedExpectation}
          onSelectExpectation={setSelectedExpectation}
          onDeleteExpectation={handleDeleteExpectation}
        />

        {/* Right: Configuration Panel */}
        <ConfigPanel
          expectation={selectedExpectation}
          onUpdate={(updates) => 
            handleUpdateExpectation(selectedExpectation.id, updates)
          }
        />
      </div>

      {/* Bottom: Results */}
      {results && (
        <ResultsViewer 
          results={results}
          onClose={() => setResults(null)}
        />
      )}
    </div>
  );
}

export default QualityBuilder;
```

## Quick Wins to Implement First

### 1. **Add Quality Builder Tab to Main App**
```javascript
// frontend/src/App.jsx
import QualityBuilder from './components/QualityBuilder/QualityBuilder';

// Add tab
<nav>
  <button onClick={() => setActiveTab('quality-builder')}>
    Quality Builder
  </button>
</nav>

{activeTab === 'quality-builder' && <QualityBuilder />}
```

### 2. **Create 5 Essential Checks**
- Not Null
- Unique Values
- Value Between Min/Max
- Row Count Range
- Recent Data (freshness)

### 3. **Simple Results Display**
- Pass/Fail status
- Row counts
- Percentage success
- Sample of failures

### 4. **Save Suite to YAML**
```yaml
# expectations/customer_validation.yaml
suite_id: customer-validation-v1
name: Customer Data Validation
connection_id: local_adventureworks
target:
  schema: SalesLT
  table: Customer
expectations:
  - id: exp_001
    type: expect_column_values_to_not_be_null
    column: CustomerID
  - id: exp_002
    type: expect_column_values_to_be_unique
    column: CustomerID
```

## Testing Plan

### Test Scenario 1: Basic Column Validation
```
1. Select AdventureWorks connection
2. Select SalesLT.Customer table
3. Add "Not Null" check for CustomerID
4. Run check → Should pass (0 nulls)
5. Add "Email Format" check
6. Run check → Should show any invalid emails
```

### Test Scenario 2: Value Range Check
```
1. Add "Value Between" check for a numeric column
2. Set min=0, max=100
3. Run check → Should flag out-of-range values
4. Show sample of failed rows
```

### Test Scenario 3: Save and Reload Suite
```
1. Create 3-4 checks
2. Save as "Customer Validation"
3. Clear canvas
4. Load "Customer Validation"
5. All checks restored → Run again
```

## Performance Considerations

### Optimization Strategies
1. **Lazy Loading**: Load expectation library on-demand
2. **Caching**: Cache table schemas
3. **Sampling**: Run checks on sample for large tables
4. **Parallel Execution**: Run multiple checks concurrently
5. **Query Optimization**: Use efficient SQL patterns

### Scalability
- Start with single-table validation
- Add multi-table support later
- Consider async execution for large suites
- Add progress indicators for long-running checks

## Next Steps

1. **Week 1**: Build MVP with 5 checks
2. **Week 2**: Add save/load functionality
3. **Week 3**: Integrate with Flow Visualizer
4. **Week 4**: Add scheduling & alerts

---

Ready to start? Begin with Phase 1 MVP and iterate based on user feedback!
