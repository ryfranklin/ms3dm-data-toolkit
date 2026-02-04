"""
SQL Parser Service
Parse SQL code and extract structure for visualization
"""
import sqlparse
from sqlparse.sql import IdentifierList, Identifier, Where, Parenthesis, Function
from sqlparse.tokens import Keyword, DML
import re


class SQLParser:
    """Parse SQL code and extract tables, joins, columns for visualization"""
    
    def __init__(self):
        self.tables = []
        self.joins = []
        self.columns = []
        self.ctes = []
        self.filters = []
        
    def parse(self, sql_code):
        """
        Parse SQL code and return structured data for visualization
        
        Args:
            sql_code: SQL query string
            
        Returns:
            Dictionary with nodes and edges for diagram
        """
        # Format and parse SQL
        formatted_sql = sqlparse.format(sql_code, reindent=True, keyword_case='upper')
        parsed = sqlparse.parse(formatted_sql)
        
        if not parsed:
            return {'error': 'Failed to parse SQL'}
        
        statement = parsed[0]
        
        # Extract CTEs
        self._extract_ctes(statement)
        
        # Extract tables from FROM and JOIN clauses
        self._extract_tables(statement)
        
        # Extract JOIN conditions
        self._extract_joins(statement)
        
        # Extract SELECT columns
        self._extract_columns(statement)
        
        # Extract WHERE conditions
        self._extract_filters(statement)
        
        # Build nodes and edges for visualization
        nodes, edges = self._build_diagram()
        
        return {
            'nodes': nodes,
            'edges': edges,
            'tables': self.tables,
            'joins': self.joins,
            'columns': self.columns,
            'ctes': self.ctes,
            'filters': self.filters,
            'formatted_sql': formatted_sql
        }
    
    def _extract_ctes(self, statement):
        """Extract Common Table Expressions (WITH clauses)"""
        tokens = list(statement.flatten())
        in_cte = False
        cte_name = None
        
        for i, token in enumerate(tokens):
            if token.ttype is Keyword and token.value.upper() == 'WITH':
                in_cte = True
            elif in_cte and isinstance(token, Identifier):
                cte_name = str(token)
                # Look for AS keyword and extract CTE definition
                for j in range(i, min(i + 20, len(tokens))):
                    if tokens[j].ttype is Keyword and tokens[j].value.upper() == 'AS':
                        self.ctes.append({
                            'name': cte_name,
                            'type': 'CTE'
                        })
                        break
                in_cte = False
    
    def _extract_tables(self, statement):
        """Extract table references from FROM and JOIN clauses"""
        from_seen = False
        
        for token in statement.tokens:
            if from_seen:
                if isinstance(token, IdentifierList):
                    for identifier in token.get_identifiers():
                        self._add_table(identifier)
                elif isinstance(token, Identifier):
                    self._add_table(token)
                    
            if token.ttype is Keyword and token.value.upper() in ('FROM', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'OUTER JOIN'):
                from_seen = True
            elif token.ttype is Keyword and token.value.upper() in ('WHERE', 'GROUP', 'ORDER', 'HAVING'):
                from_seen = False
    
    def _add_table(self, identifier):
        """Add a table to the list"""
        table_name = str(identifier).split()[-1]  # Get last part (handles aliases)
        real_name = str(identifier).split()[0]  # Get actual table name
        
        # Remove quotes if present
        table_name = table_name.strip('[]"`')
        real_name = real_name.strip('[]"`')
        
        if table_name not in [t['alias'] for t in self.tables]:
            self.tables.append({
                'name': real_name,
                'alias': table_name,
                'type': 'table'
            })
    
    def _extract_joins(self, statement):
        """Extract JOIN conditions"""
        join_pattern = r'(INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|JOIN)\s+(\S+)\s+(?:AS\s+)?(\S+)?\s+ON\s+(.+?)(?=INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|JOIN|WHERE|GROUP|ORDER|$)'
        
        sql_str = str(statement)
        matches = re.finditer(join_pattern, sql_str, re.IGNORECASE | re.DOTALL)
        
        for match in matches:
            join_type = match.group(1).strip()
            table = match.group(2).strip()
            alias = match.group(3).strip() if match.group(3) else table
            condition = match.group(4).strip()
            
            # Parse condition to get column relationships
            # Simple parsing: assumes "table1.col1 = table2.col2"
            condition_parts = condition.split('=')
            if len(condition_parts) == 2:
                left = condition_parts[0].strip()
                right = condition_parts[1].strip()
                
                self.joins.append({
                    'type': join_type,
                    'table': table.strip('[]"`'),
                    'alias': alias.strip('[]"`'),
                    'left_column': left,
                    'right_column': right,
                    'condition': condition
                })
    
    def _extract_columns(self, statement):
        """Extract SELECT columns"""
        select_seen = False
        
        for token in statement.tokens:
            if token.ttype is DML and token.value.upper() == 'SELECT':
                select_seen = True
                continue
            
            if select_seen:
                if isinstance(token, IdentifierList):
                    for identifier in token.get_identifiers():
                        self._add_column(identifier)
                elif isinstance(token, Identifier):
                    self._add_column(token)
                elif isinstance(token, Function):
                    self._add_function(token)
                    
            if token.ttype is Keyword and token.value.upper() == 'FROM':
                select_seen = False
    
    def _add_column(self, identifier):
        """Add a column to the list"""
        col_str = str(identifier)
        
        # Check for alias
        if ' AS ' in col_str.upper():
            parts = re.split(r'\s+AS\s+', col_str, flags=re.IGNORECASE)
            source = parts[0].strip()
            alias = parts[1].strip()
        elif ' ' in col_str and not any(kw in col_str.upper() for kw in ['CASE', 'WHEN', 'THEN']):
            parts = col_str.rsplit(' ', 1)
            source = parts[0].strip()
            alias = parts[1].strip()
        else:
            source = col_str.strip()
            alias = col_str.strip()
        
        self.columns.append({
            'source': source,
            'alias': alias,
            'type': 'column'
        })
    
    def _add_function(self, func):
        """Add a function/aggregation to the list"""
        func_str = str(func)
        self.columns.append({
            'source': func_str,
            'alias': func_str,
            'type': 'function'
        })
    
    def _extract_filters(self, statement):
        """Extract WHERE conditions"""
        for token in statement.tokens:
            if isinstance(token, Where):
                filter_str = str(token)[6:].strip()  # Remove "WHERE "
                self.filters.append({
                    'condition': filter_str
                })
    
    def _build_diagram(self):
        """Build nodes and edges for React Flow visualization"""
        nodes = []
        edges = []
        node_id = 0
        
        # Create nodes for each table
        y_offset = 100
        for table in self.tables:
            nodes.append({
                'id': f"table_{node_id}",
                'type': 'default',
                'position': {'x': 100, 'y': y_offset},
                'data': {
                    'label': f"{table['name']}\n({table['alias']})" if table['name'] != table['alias'] else table['name'],
                    'type': 'source_table',
                    'table_name': table['name'],
                    'alias': table['alias']
                },
                'style': {
                    'background': '#3b82f6',
                    'color': 'white',
                    'border': '2px solid #1e40af',
                    'borderRadius': '8px',
                    'padding': '10px',
                    'minWidth': '150px'
                }
            })
            node_id += 1
            y_offset += 120
        
        # Create nodes for CTEs
        for cte in self.ctes:
            nodes.append({
                'id': f"cte_{node_id}",
                'type': 'default',
                'position': {'x': 350, 'y': 100 + len(nodes) * 80},
                'data': {
                    'label': f"CTE: {cte['name']}",
                    'type': 'cte',
                    'cte_name': cte['name']
                },
                'style': {
                    'background': '#8b5cf6',
                    'color': 'white',
                    'border': '2px solid #6d28d9',
                    'borderRadius': '8px',
                    'padding': '10px',
                    'minWidth': '150px'
                }
            })
            node_id += 1
        
        # Create output node for SELECT
        if self.columns:
            column_list = '\n'.join([f"• {col['alias']}" for col in self.columns[:5]])
            if len(self.columns) > 5:
                column_list += f"\n... and {len(self.columns) - 5} more"
            
            nodes.append({
                'id': 'output',
                'type': 'default',
                'position': {'x': 600, 'y': 200},
                'data': {
                    'label': f"SELECT Output\n{column_list}",
                    'type': 'output',
                    'columns': self.columns
                },
                'style': {
                    'background': '#10b981',
                    'color': 'white',
                    'border': '2px solid #047857',
                    'borderRadius': '8px',
                    'padding': '10px',
                    'minWidth': '200px'
                }
            })
        
        # Create edges for JOINs
        for join in self.joins:
            # Find source and target nodes
            source_node = next((n for n in nodes if n['data'].get('alias') == join['alias'] or n['data'].get('table_name') == join['table']), None)
            
            if source_node:
                # Connect to output
                edges.append({
                    'id': f"edge_{len(edges)}",
                    'source': source_node['id'],
                    'target': 'output',
                    'label': f"{join['type']}\n{join['condition'][:30]}...",
                    'type': 'smoothstep',
                    'animated': True,
                    'style': {'stroke': '#6366f1', 'strokeWidth': 2}
                })
        
        # If no joins, connect all tables to output
        if not self.joins and self.tables:
            for i, table in enumerate(self.tables):
                edges.append({
                    'id': f"edge_{i}",
                    'source': f"table_{i}",
                    'target': 'output',
                    'type': 'smoothstep',
                    'animated': False,
                    'style': {'stroke': '#94a3b8', 'strokeWidth': 2}
                })
        
        return nodes, edges
