"""
Example data processing skill that generates self-documenting artifacts.
This demonstrates how other skills can use the common interface analyzer.
"""

import json
import random
import string
import sys
from typing import Dict, Any, List, Optional

# Import the common interface analyzer
try:
    from skills.common.interface_analyzer import create_artifact_with_interface
except ImportError:
    # Fallback if common module is not available
    def create_artifact_with_interface(name, description, function_code, usage, dependencies, test_cases, metadata):
        # Simplified fallback without interface analysis
        artifact = {
            'name': name,
            'description': description,
            'function': function_code,
            'usage': usage,
            'dependencies': dependencies,
            'test_cases': test_cases,
            **metadata
        }
        return artifact

def create_data_processor(task_specification):
    """Create a data processing artifact using LLM-driven generation."""
    
    # Analyze the task requirements
    task_analysis = analyze_data_task(task_specification)
    
    # Generate data processing function
    function_code = generate_data_processing_code(task_specification, task_analysis)
    
    # Generate usage example and test cases
    usage = generate_data_usage_example(task_analysis)
    test_cases = generate_data_test_cases(task_analysis)
    
    # Create metadata
    metadata = {
        'llm_generated': True,
        'generation_confidence': task_analysis.get('confidence', 0.8),
        'id': ''.join(random.choices(string.ascii_lowercase + string.digits, k=8)),
        'created_by': 'data-processing',
        'status': 'pending'
    }
    
    # Create artifact with self-documenting interface using common utility
    artifact = create_artifact_with_interface(
        name=task_analysis.get('function_name', 'process_data'),
        description=f'Data processing solution for: {task_specification[:100]}{"..." if len(task_specification) > 100 else ""}',
        function_code=function_code,
        usage=usage,
        dependencies=task_analysis.get('dependencies', ['pandas', 'numpy']),
        test_cases=test_cases,
        metadata=metadata
    )
    
    return artifact

def analyze_data_task(task_specification: str) -> Dict[str, Any]:
    """Analyze data processing task requirements."""
    
    task_lower = task_specification.lower()
    
    analysis = {
        'task_type': 'general',
        'operation': None,
        'data_format': None,
        'function_name': 'process_data',
        'dependencies': ['pandas', 'numpy'],
        'confidence': 0.7,
        'reasoning': []
    }
    
    # Detect data operations
    if any(word in task_lower for word in ['filter', 'clean', 'remove', 'drop']):
        analysis['operation'] = 'filter'
        analysis['function_name'] = 'filter_data'
        analysis['reasoning'].append('Data filtering detected')
    elif any(word in task_lower for word in ['aggregate', 'sum', 'count', 'group']):
        analysis['operation'] = 'aggregate'
        analysis['function_name'] = 'aggregate_data'
        analysis['reasoning'].append('Data aggregation detected')
    elif any(word in task_lower for word in ['transform', 'convert', 'map']):
        analysis['operation'] = 'transform'
        analysis['function_name'] = 'transform_data'
        analysis['reasoning'].append('Data transformation detected')
    elif any(word in task_lower for word in ['analyze', 'statistics', 'stats']):
        analysis['operation'] = 'analyze'
        analysis['function_name'] = 'analyze_data'
        analysis['reasoning'].append('Data analysis detected')
    
    # Detect data formats
    if any(word in task_lower for word in ['csv', 'comma separated']):
        analysis['data_format'] = 'csv'
        analysis['reasoning'].append('CSV format detected')
    elif any(word in task_lower for word in ['json', 'javascript object notation']):
        analysis['data_format'] = 'json'
        analysis['reasoning'].append('JSON format detected')
    elif any(word in task_lower for word in ['excel', 'xlsx', 'xls']):
        analysis['data_format'] = 'excel'
        analysis['reasoning'].append('Excel format detected')
    
    return analysis

def generate_data_processing_code(task_specification: str, analysis: Dict[str, Any]) -> str:
    """Generate data processing code based on task analysis."""
    
    function_name = analysis['function_name']
    operation = analysis['operation']
    data_format = analysis.get('data_format', 'dataframe')
    
    # Generate imports
    imports = ['import pandas as pd', 'import numpy as np']
    import_section = '\n'.join(imports)
    
    # Generate function based on operation
    if operation == 'filter':
        function_code = f'''
def {function_name}(data_source, **kwargs):
    """Filter data based on specified criteria.
    
    Args:
        data_source: Input data (DataFrame, dict, or file path)
        **kwargs: Filtering criteria
    
    Returns:
        Filtered DataFrame
    """
    # Load data
    if isinstance(data_source, str):
        df = pd.read_csv(data_source)
    elif isinstance(data_source, dict):
        df = pd.DataFrame(data_source)
    else:
        df = data_source.copy()
    
    # Apply filters
    filtered_df = df.copy()
    for column, value in kwargs.items():
        if column in filtered_df.columns:
            filtered_df = filtered_df[filtered_df[column] == value]
    
    return filtered_df
'''
    elif operation == 'aggregate':
        function_code = f'''
def {function_name}(data_source, group_by=None, agg_func='mean'):
    """Aggregate data by specified columns.
    
    Args:
        data_source: Input data (DataFrame, dict, or file path)
        group_by: Column(s) to group by
        agg_func: Aggregation function ('mean', 'sum', 'count', etc.)
    
    Returns:
        Aggregated DataFrame
    """
    # Load data
    if isinstance(data_source, str):
        df = pd.read_csv(data_source)
    elif isinstance(data_source, dict):
        df = pd.DataFrame(data_source)
    else:
        df = data_source.copy()
    
    # Perform aggregation
    if group_by and group_by in df.columns:
        result = df.groupby(group_by).agg(agg_func)
    else:
        if agg_func == 'mean':
            result = df.mean()
        elif agg_func == 'sum':
            result = df.sum()
        elif agg_func == 'count':
            result = df.count()
        else:
            result = df.agg(agg_func)
    
    return result
'''
    else:  # default/transform
        function_code = f'''
def {function_name}(data_source, transformations=None):
    """Transform data based on specified transformations.
    
    Args:
        data_source: Input data (DataFrame, dict, or file path)
        transformations: List of transformations to apply
    
    Returns:
        Transformed DataFrame
    """
    # Load data
    if isinstance(data_source, str):
        df = pd.read_csv(data_source)
    elif isinstance(data_source, dict):
        df = pd.DataFrame(data_source)
    else:
        df = data_source.copy()
    
    # Apply transformations
    result_df = df.copy()
    if transformations:
        for transform in transformations:
            if transform == 'remove_duplicates':
                result_df = result_df.drop_duplicates()
            elif transform == 'fill_missing':
                result_df = result_df.fillna(result_df.mean())
            elif transform == 'normalize':
                numeric_cols = result_df.select_dtypes(include=[np.number]).columns
                result_df[numeric_cols] = (result_df[numeric_cols] - result_df[numeric_cols].mean()) / result_df[numeric_cols].std()
    
    return result_df
'''
    
    return f"""{import_section}

{function_code}"""

def generate_data_usage_example(analysis: Dict[str, Any]) -> str:
    """Generate usage example for the data processing function."""
    
    function_name = analysis['function_name']
    operation = analysis['operation']
    
    if operation == 'filter':
        return f"""# Example usage
import pandas as pd

# Sample data
data = {{"name": ["Alice", "Bob", "Charlie"], "age": [25, 30, 35], "city": ["NYC", "LA", "NYC"]}}

# Filter data
filtered_data = {function_name}(data, city="NYC")
print(filtered_data)
"""
    elif operation == 'aggregate':
        return f"""# Example usage
import pandas as pd

# Sample data
data = {{"category": ["A", "B", "A", "B"], "value": [10, 20, 15, 25]}}

# Aggregate data
agg_data = {function_name}(data, group_by="category", agg_func="sum")
print(agg_data)
"""
    else:
        return f"""# Example usage
import pandas as pd

# Sample data
data = {{"name": ["Alice", "Bob", "Alice"], "score": [85, 90, 88]}}

# Transform data
transformed_data = {function_name}(data, transformations=["remove_duplicates", "fill_missing"])
print(transformed_data)
"""

def generate_data_test_cases(analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Generate test cases for the data processing function."""
    
    function_name = analysis['function_name']
    operation = analysis['operation']
    
    test_cases = []
    
    # Basic test case
    basic_test = {
        'input': {'data_source': {'col1': [1, 2, 3], 'col2': ['a', 'b', 'c']}},
        'expected_type': 'DataFrame'
    }
    test_cases.append(basic_test)
    
    # Operation-specific test case
    if operation == 'filter':
        filter_test = {
            'input': {'data_source': {'name': ['Alice', 'Bob'], 'age': [25, 30]}, 'age': 25},
            'expected_type': 'DataFrame'
        }
        test_cases.append(filter_test)
    elif operation == 'aggregate':
        agg_test = {
            'input': {'data_source': {'category': ['A', 'B', 'A'], 'value': [10, 20, 15]}, 'group_by': 'category'},
            'expected_type': 'DataFrame'
        }
        test_cases.append(agg_test)
    
    return test_cases

if __name__ == "__main__":
    task = globals().get('task', '')
    if not task and len(sys.argv) > 1:
        task = sys.argv[1]
        
    if not task:
        print(json.dumps({"error": "No task specification provided"}))
        sys.exit(1)
        
    artifact = create_data_processor(task)
    print(json.dumps(artifact, indent=2))
