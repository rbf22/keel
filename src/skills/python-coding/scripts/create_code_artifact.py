import json
import random
import string
import re
import sys

def create_math_artifact(task):
    """Create mathematical computation artifact."""
    if 'sum' in task.lower() or 'add' in task.lower():
        return {
            'name': 'sum_calculator',
            'description': 'Calculate sum of numbers',
            'function': '''def calculate_sum(numbers):
    """Calculate the sum of a list of numbers."""
    if not numbers:
        return 0
    return sum(numbers)''',
            'usage': '''# Example usage
result = calculate_sum([134, 14])
print(f"The sum is: {result}")''',
            'dependencies': [],
            'test_cases': [
                {'input': [134, 14], 'expected': 148},
                {'input': [1, 2, 3], 'expected': 6},
                {'input': [], 'expected': 0}
            ]
        }
    elif 'multiply' in task.lower():
        return {
            'name': 'product_calculator',
            'description': 'Calculate product of numbers',
            'function': '''def calculate_product(numbers):
    """Calculate the product of a list of numbers."""
    if not numbers:
        return 1
    result = 1
    for num in numbers:
        result *= num
    return result''',
            'usage': '''# Example usage
result = calculate_product([2, 3, 4])
print(f"The product is: {result}")''',
            'dependencies': [],
            'test_cases': [
                {'input': [2, 3, 4], 'expected': 24},
                {'input': [5, 6], 'expected': 30}
            ]
        }
    return create_general_artifact(task)

def create_data_artifact(task):
    """Create data processing artifact."""
    return {
        'name': 'data_processor',
        'description': 'Process and analyze data',
        'function': '''def process_data(data, operation='describe'):
    """Process data with various operations."""
    import pandas as pd
    import numpy as np
    
    df = pd.DataFrame(data)
    
    if operation == 'describe':
        return df.describe()
    elif operation == 'shape':
        return df.shape
    elif operation == 'mean':
        return df.mean()
    else:
        return df.head()''',
        'usage': '''# Example usage
data = [{'col1': 1, 'col2': 2}, {'col1': 3, 'col2': 4}]
result = process_data(data, 'describe')
print(result)''',
        'dependencies': ['pandas', 'numpy'],
        'test_cases': [
            {'input': [{'a': 1, 'b': 2}], 'operation': 'shape'}
        ]
    }

def create_general_artifact(task):
    """Create general-purpose artifact."""
    return {
        'name': 'task_executor',
        'description': 'Execute general task',
        'function': '''def execute_task(task_params):
    """Execute a general task."""
    # This is a template - customize based on specific task
    result = f"Task executed with params: {task_params}"
    return result''',
        'usage': '''# Example usage
result = execute_task({'param1': 'value1'})
print(result)''',
        'dependencies': [],
        'test_cases': []
    }

def create_code_artifact(task_specification):
    """Create a code artifact based on task specification."""
    task_lower = task_specification.lower()
    
    if any(keyword in task_lower for keyword in ['sum', 'add', 'calculate', 'compute', 'multiply', 'divide', 'subtract']):
        artifact = create_math_artifact(task_specification)
    elif any(keyword in task_lower for keyword in ['analyze', 'data', 'dataset', 'statistics', 'process']):
        artifact = create_data_artifact(task_specification)
    else:
        artifact = create_general_artifact(task_specification)
    
    artifact['id'] = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    artifact['created_by'] = 'python-coding'
    artifact['status'] = 'pending'
    
    return artifact

if __name__ == "__main__":
    task = globals().get('task', '')
    if not task and len(sys.argv) > 1:
        task = sys.argv[1]
        
    if not task:
        print(json.dumps({"error": "No task specification provided"}))
        sys.exit(1)
        
    artifact = create_code_artifact(task)
    print(json.dumps(artifact, indent=2))
