"""
Data Flow Analyzer
Handles data flow documentation, lineage analysis, and relationship discovery
"""
from typing import Dict, List, Optional
from services.db_connector import DBConnector
import uuid

class FlowAnalyzer:
    """Analyze and document data flows"""
    
    def __init__(self, db_connector: Optional[DBConnector]):
        """
        Initialize flow analyzer
        
        Args:
            db_connector: Database connector instance (optional for conversion operations)
        """
        self.db = db_connector
    
    def discover_relationships(self) -> Dict:
        """
        Discover database relationships comprehensively
        
        Returns:
            Dictionary with discovered relationships and suggested flows
        """
        if not self.db:
            raise Exception("Database connector required for relationship discovery")
        
        try:
            # Get foreign key relationships
            foreign_keys = self.db.get_foreign_key_relationships()
            
            # Get view dependencies
            views = self._discover_view_dependencies()
            
            # Get stored procedure dependencies
            procedures = self._discover_procedure_dependencies()
            
            # Generate flow suggestions based on relationships
            suggestions = self._generate_flow_suggestions(foreign_keys, views)
            
            return {
                'foreign_keys': foreign_keys,
                'views': views,
                'stored_procedures': procedures,
                'suggested_flows': suggestions,
                'total_relationships': len(foreign_keys)
            }
            
        except Exception as e:
            raise Exception(f"Failed to discover relationships: {str(e)}")
    
    def _discover_view_dependencies(self) -> List[Dict]:
        """Discover view definitions and their dependencies"""
        try:
            views_query = """
                SELECT 
                    OBJECT_SCHEMA_NAME(v.object_id) AS VIEW_SCHEMA,
                    v.name AS VIEW_NAME,
                    m.definition AS VIEW_DEFINITION
                FROM sys.views v
                INNER JOIN sys.sql_modules m ON v.object_id = m.object_id
            """
            
            views = self.db.execute_query_dict(views_query)
            
            # Parse dependencies from view definitions
            for view in views:
                view['dependencies'] = self._parse_dependencies(view.get('VIEW_DEFINITION', ''))
            
            return views
            
        except Exception as e:
            return []
    
    def _discover_procedure_dependencies(self) -> List[Dict]:
        """Discover stored procedure dependencies"""
        try:
            procs_query = """
                SELECT 
                    OBJECT_SCHEMA_NAME(p.object_id) AS PROC_SCHEMA,
                    p.name AS PROC_NAME,
                    m.definition AS PROC_DEFINITION
                FROM sys.procedures p
                INNER JOIN sys.sql_modules m ON p.object_id = m.object_id
            """
            
            procedures = self.db.execute_query_dict(procs_query)
            
            # Parse dependencies from procedure definitions
            for proc in procedures:
                proc['dependencies'] = self._parse_dependencies(proc.get('PROC_DEFINITION', ''))
            
            return procedures
            
        except Exception as e:
            return []
    
    def _parse_dependencies(self, sql_text: str) -> List[str]:
        """
        Parse table dependencies from SQL text
        
        Args:
            sql_text: SQL definition text
            
        Returns:
            List of table names referenced
        """
        import re
        
        if not sql_text:
            return []
        
        # Simple pattern to find table references (after FROM and JOIN)
        pattern = r'(?:FROM|JOIN)\s+\[?(\w+)\]?\.\[?(\w+)\]?'
        matches = re.findall(pattern, sql_text, re.IGNORECASE)
        
        # Return unique table names
        tables = [f"{schema}.{table}" for schema, table in matches]
        return list(set(tables))
    
    def _generate_flow_suggestions(self, foreign_keys: List[Dict], views: List[Dict]) -> List[Dict]:
        """
        Generate flow suggestions based on discovered relationships
        
        Args:
            foreign_keys: List of foreign key relationships
            views: List of views with dependencies
            
        Returns:
            List of suggested flow templates
        """
        suggestions = []
        
        # Suggest flows based on foreign key relationships
        # Group by source table
        source_groups = {}
        for fk in foreign_keys:
            source = f"{fk['SOURCE_SCHEMA']}.{fk['SOURCE_TABLE']}"
            target = f"{fk['TARGET_SCHEMA']}.{fk['TARGET_TABLE']}"
            
            if source not in source_groups:
                source_groups[source] = []
            source_groups[source].append(target)
        
        # Create suggestions for tables with multiple relationships
        for source, targets in source_groups.items():
            if len(targets) >= 2:
                suggestions.append({
                    'type': 'multi_join',
                    'description': f"Join {source} with {len(targets)} related tables",
                    'source_table': source,
                    'target_tables': targets,
                    'confidence': 'high'
                })
        
        # Suggest flows based on views
        for view in views:
            view_name = f"{view['VIEW_SCHEMA']}.{view['VIEW_NAME']}"
            dependencies = view.get('dependencies', [])
            
            if len(dependencies) > 0:
                suggestions.append({
                    'type': 'view_based',
                    'description': f"Document view {view_name} data flow",
                    'view': view_name,
                    'source_tables': dependencies,
                    'confidence': 'medium'
                })
        
        return suggestions
    
    def canvas_to_yaml(self, canvas_data: Dict) -> Dict:
        """
        Convert React Flow canvas data to YAML flow format
        
        Args:
            canvas_data: Canvas data with nodes and edges
            
        Returns:
            Dictionary in YAML flow format
        """
        nodes = canvas_data.get('nodes', [])
        edges = canvas_data.get('edges', [])
        metadata = canvas_data.get('metadata', {})
        
        # Generate flow ID if not provided
        flow_id = metadata.get('id', str(uuid.uuid4()))
        
        flow_yaml = {
            'id': flow_id,
            'name': metadata.get('name', 'Untitled Flow'),
            'description': metadata.get('description', ''),
            'owner': metadata.get('owner', ''),
            'source_tables': [],
            'transformations': [],
            'destination': {}
        }
        
        # Process nodes
        source_nodes = [n for n in nodes if n.get('type') == 'source']
        transformation_nodes = [n for n in nodes if n.get('type') == 'transformation']
        destination_nodes = [n for n in nodes if n.get('type') == 'destination']
        
        # Extract source tables
        for node in source_nodes:
            data = node.get('data', {})
            table_name = data.get('table', '')
            if '.' in table_name:
                schema, table = table_name.split('.', 1)
            else:
                schema = 'dbo'
                table = table_name
            
            flow_yaml['source_tables'].append({
                'schema': schema,
                'table': table
            })
        
        # Extract transformations
        for i, node in enumerate(transformation_nodes, 1):
            data = node.get('data', {})
            
            transformation = {
                'step': i,
                'type': data.get('transformationType', 'custom'),
                'description': data.get('description', '')
            }
            
            # Add SQL snippet if provided
            if data.get('sqlSnippet'):
                transformation['sql_snippet'] = data['sqlSnippet']
            
            flow_yaml['transformations'].append(transformation)
        
        # Extract destination
        if destination_nodes:
            dest_node = destination_nodes[0]
            data = dest_node.get('data', {})
            table_name = data.get('table', '')
            
            if '.' in table_name:
                schema, table = table_name.split('.', 1)
            else:
                schema = 'dbo'
                table = table_name
            
            flow_yaml['destination'] = {
                'schema': schema,
                'table': table
            }
        
        # Add optional fields
        if metadata.get('schedule'):
            flow_yaml['schedule'] = metadata['schedule']
        
        return flow_yaml
    
    def yaml_to_canvas(self, flow_yaml: Dict) -> Dict:
        """
        Convert YAML flow format to React Flow canvas data
        
        Args:
            flow_yaml: Flow data in YAML format
            
        Returns:
            Dictionary with nodes and edges for React Flow
        """
        nodes = []
        edges = []
        
        # Position configuration
        y_spacing = 150
        x_spacing = 300
        current_y = 50
        
        # Create source nodes
        source_tables = flow_yaml.get('source_tables', [])
        source_node_ids = []
        
        for i, source in enumerate(source_tables):
            node_id = f"source_{i}"
            source_node_ids.append(node_id)
            
            table_name = f"{source['schema']}.{source['table']}"
            
            nodes.append({
                'id': node_id,
                'type': 'source',
                'position': {'x': 50 + (i * x_spacing), 'y': current_y},
                'data': {
                    'label': table_name,
                    'table': table_name,
                    'schema': source['schema'],
                    'tableName': source['table']
                }
            })
        
        current_y += y_spacing
        
        # Create transformation nodes
        transformations = flow_yaml.get('transformations', [])
        transformation_node_ids = []
        
        for i, transform in enumerate(transformations):
            node_id = f"transform_{i}"
            transformation_node_ids.append(node_id)
            
            nodes.append({
                'id': node_id,
                'type': 'transformation',
                'position': {'x': 200, 'y': current_y},
                'data': {
                    'label': transform.get('description', f"Step {transform['step']}"),
                    'description': transform.get('description', ''),
                    'transformationType': transform.get('type', 'custom'),
                    'sqlSnippet': transform.get('sql_snippet', '')
                }
            })
            
            # Connect to previous node
            if i == 0:
                # Connect first transformation to source nodes
                for source_id in source_node_ids:
                    edges.append({
                        'id': f"{source_id}_{node_id}",
                        'source': source_id,
                        'target': node_id
                    })
            else:
                # Connect to previous transformation
                edges.append({
                    'id': f"{transformation_node_ids[i-1]}_{node_id}",
                    'source': transformation_node_ids[i-1],
                    'target': node_id
                })
            
            current_y += y_spacing
        
        # Create destination node
        destination = flow_yaml.get('destination', {})
        if destination:
            dest_node_id = 'destination_0'
            table_name = f"{destination.get('schema', 'dbo')}.{destination.get('table', '')}"
            
            nodes.append({
                'id': dest_node_id,
                'type': 'destination',
                'position': {'x': 200, 'y': current_y},
                'data': {
                    'label': table_name,
                    'table': table_name,
                    'schema': destination.get('schema', 'dbo'),
                    'tableName': destination.get('table', '')
                }
            })
            
            # Connect last transformation to destination
            if transformation_node_ids:
                edges.append({
                    'id': f"{transformation_node_ids[-1]}_{dest_node_id}",
                    'source': transformation_node_ids[-1],
                    'target': dest_node_id
                })
            elif source_node_ids:
                # Connect sources directly to destination if no transformations
                for source_id in source_node_ids:
                    edges.append({
                        'id': f"{source_id}_{dest_node_id}",
                        'source': source_id,
                        'target': dest_node_id
                    })
        
        return {
            'nodes': nodes,
            'edges': edges,
            'metadata': {
                'id': flow_yaml.get('id'),
                'name': flow_yaml.get('name'),
                'description': flow_yaml.get('description'),
                'owner': flow_yaml.get('owner'),
                'schedule': flow_yaml.get('schedule')
            }
        }
    
    def generate_lineage(self, flow_yaml: Dict) -> Dict:
        """
        Generate lineage graph from flow definition
        
        Args:
            flow_yaml: Flow data in YAML format
            
        Returns:
            Dictionary with lineage information
        """
        lineage = {
            'flow_id': flow_yaml.get('id'),
            'flow_name': flow_yaml.get('name'),
            'sources': [],
            'transformations': [],
            'destinations': [],
            'lineage_paths': []
        }
        
        # Extract sources
        for source in flow_yaml.get('source_tables', []):
            lineage['sources'].append(f"{source['schema']}.{source['table']}")
        
        # Extract transformations
        for transform in flow_yaml.get('transformations', []):
            lineage['transformations'].append({
                'step': transform['step'],
                'type': transform.get('type'),
                'description': transform.get('description')
            })
        
        # Extract destination
        dest = flow_yaml.get('destination', {})
        if dest:
            lineage['destinations'].append(f"{dest.get('schema', 'dbo')}.{dest.get('table', '')}")
        
        # Create lineage paths
        for source in lineage['sources']:
            path = {
                'source': source,
                'transformations': [t['description'] for t in lineage['transformations']],
                'destination': lineage['destinations'][0] if lineage['destinations'] else None
            }
            lineage['lineage_paths'].append(path)
        
        return lineage
