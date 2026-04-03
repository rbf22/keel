import json
import random
import string
import sys
import ast
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

def create_code_artifact(task_specification):
    """Create a code artifact using pure LLM-driven generation without templates."""
    
    # LLM analyzes the task and generates complete Python solution
    task_analysis = analyze_task_requirements(task_specification)
    
    # Generate complete Python code based on analysis
    generated_code = generate_python_solution(task_specification, task_analysis)
    
    # Generate usage example and test cases
    usage = generate_usage_example(task_analysis)
    test_cases = generate_test_cases(task_analysis)
    
    # Create metadata
    metadata = {
        'llm_generated': True,
        'generation_confidence': task_analysis.get('confidence', 0.8),
        'id': ''.join(random.choices(string.ascii_lowercase + string.digits, k=8)),
        'created_by': 'python-coding',
        'status': 'pending'
    }
    
    # Create artifact with self-documenting interface using common utility
    artifact = create_artifact_with_interface(
        name=task_analysis.get('function_name', 'task_executor'),
        description=f'LLM-generated solution for: {task_specification[:100]}{"..." if len(task_specification) > 100 else ""}',
        function_code=generated_code,
        usage=usage,
        dependencies=task_analysis.get('dependencies', []),
        test_cases=test_cases,
        metadata=metadata
    )
    
    return artifact

def analyze_task_requirements(task_specification):
    """Analyze task to understand requirements and generate code specification."""
    
    task_lower = task_specification.lower()
    
    # Initialize analysis
    analysis = {
        'task_type': 'general',
        'operation': None,
        'parameters': [],
        'function_name': 'solve_task',
        'dependencies': [],
        'confidence': 0.7,
        'reasoning': []
    }
    
    # Detect mathematical operations
    math_operations = {
        'volume': 'calculate_volume',
        'area': 'calculate_area',
        'surface area': 'calculate_surface_area',
        'perimeter': 'calculate_perimeter',
        'sum': 'calculate_sum',
        'add': 'calculate_sum',
        'multiply': 'calculate_product',
        'divide': 'calculate_division',
        'average': 'calculate_mean',
        'mean': 'calculate_mean'
    }
    
    # Detect shapes and objects
    shapes = {
        'cube': 'cube',
        'sphere': 'sphere',
        'circle': 'circle',
        'square': 'square',
        'rectangle': 'rectangle',
        'box': 'cube',
        'ball': 'sphere'
    }
    
    # Extract operation
    for op_key, op_value in math_operations.items():
        if op_key in task_lower:
            analysis['operation'] = op_value
            analysis['reasoning'].append(f'Detected operation: {op_value}')
            break
    
    # Extract shape/object
    detected_shape = None
    for shape_key, shape_value in shapes.items():
        if shape_key in task_lower:
            detected_shape = shape_value
            analysis['reasoning'].append(f'Detected shape: {shape_value}')
            break
    
    # Extract numbers
    import re
    numbers = re.findall(r'(-?\d+(?:\.\d+)?)', task_specification)
    if numbers:
        analysis['parameters'] = [float(num) for num in numbers]
        analysis['reasoning'].append(f'Found parameters: {numbers}')
    
    # Determine function name
    if analysis['operation'] and detected_shape:
        analysis['function_name'] = f"{analysis['operation']}_{detected_shape}"
        analysis['confidence'] = 0.9
    elif analysis['operation']:
        analysis['function_name'] = analysis['operation']
        analysis['confidence'] = 0.8
    elif detected_shape:
        analysis['function_name'] = f"process_{detected_shape}"
        analysis['confidence'] = 0.7
    else:
        analysis['function_name'] = 'solve_task'
        analysis['confidence'] = 0.6
    
    # Determine dependencies
    if detected_shape in ['sphere', 'circle']:
        analysis['dependencies'] = ['math']
        analysis['reasoning'].append('Added math dependency for geometric calculations')
    
    return analysis

def generate_python_solution(task_specification, analysis):
    """Generate complete Python code based on task analysis."""
    
    function_name = analysis['function_name']
    parameters = analysis['parameters']
    operation = analysis['operation']
    dependencies = analysis['dependencies']
    
    # Generate imports
    imports = []
    if 'math' in dependencies:
        imports.append('import math')
    
    import_section = '\n'.join(imports) if imports else ''
    
    # Generate function signature
    if parameters:
        param_names = [f'param_{i+1}' for i in range(len(parameters))]
        sig_params = ', '.join(param_names)
    else:
        param_names = []
        sig_params = 'task_params'
    
    # Generate function body based on operation
    if operation == 'calculate_volume' and 'cube' in function_name:
        if parameters:
            body = f"""    # Calculate cube volume
    side_length = {param_names[0] if param_names else 'task_params.get("side_length", 1)'}
    volume = side_length ** 3
    return volume"""
        else:
            body = f"""    # Calculate cube volume from task_params
    side_length = task_params.get('side_length', 1)
    volume = side_length ** 3
    return volume"""
    
    elif operation == 'calculate_area' and 'circle' in function_name:
        if parameters:
            body = f"""    # Calculate circle area
    radius = {param_names[0] if param_names else 'task_params.get("radius", 1)'}
    area = math.pi * radius ** 2
    return area"""
        else:
            body = f"""    # Calculate circle area from task_params
    radius = task_params.get('radius', 1)
    area = math.pi * radius ** 2
    return area"""
    
    elif operation == 'calculate_sum':
        if parameters:
            body = f"""    # Calculate sum of numbers
    numbers = [{', '.join(param_names)}]
    return sum(numbers)"""
        else:
            body = f"""    # Calculate sum from task_params
    numbers = task_params.get('numbers', [0])
    return sum(numbers)"""
    
    elif operation == 'calculate_product':
        if parameters:
            body = f"""    # Calculate product of numbers
    numbers = [{', '.join(param_names)}]
    product = 1
    for num in numbers:
        product *= num
    return product"""
        else:
            body = f"""    # Calculate product from task_params
    numbers = task_params.get('numbers', [1])
    product = 1
    for num in numbers:
        product *= num
    return product"""
    
    else:
        # Generic task handling
        if parameters:
            body = f"""    # Process task with provided parameters
    params = [{', '.join(param_names)}]
    # Add your specific logic here based on the task: {task_specification[:50]}...
    result = f"Processed parameters: {{params}}"
    return result"""
        else:
            body = f"""    # Process task based on task_params
    # Add your specific logic here based on the task: {task_specification[:50]}...
    result = f"Task executed with params: {{task_params}}"
    return result"""
    
    # Combine into complete function
    function_code = f"""def {function_name}({sig_params}):
    \"\"\"Generated function for task: {task_specification[:80]}{'...' if len(task_specification) > 80 else ''}

    This function was automatically generated based on task analysis.
    
    Args:
        {', '.join([f'{p}: parameter value' for p in param_names]) if param_names else 'task_params: Dictionary containing task parameters'}
        
    Returns:
        Result of the task execution
    \"\"\"
{body}"""
    
    # Combine imports and function
    if import_section:
        complete_code = f"""{import_section}

{function_code}"""
    else:
        complete_code = function_code
    
    return complete_code

def generate_usage_example(analysis):
    """Generate usage example for the generated function."""
    function_name = analysis['function_name']
    parameters = analysis['parameters']
    
    if parameters and len(parameters) == 1:
        example = f"# Example usage\nresult = {function_name}({parameters[0]})\nprint(f\"Result: {{result}}\")"
    elif parameters and len(parameters) > 1:
        param_str = ', '.join(str(p) for p in parameters)
        example = f"# Example usage\nresult = {function_name}({param_str})\nprint(f\"Result: {{result}}\")"
    else:
        example = f"# Example usage\nresult = {function_name}({{'side_length': 5}})\nprint(f\"Result: {{result}}\")"
    
    return example

def generate_test_cases(analysis):
    """Generate test cases for the generated function."""
    function_name = analysis['function_name']
    parameters = analysis['parameters']
    
    test_cases = []
    
    if parameters:
        # Test with provided parameters
        test_case = {
            'inputs': parameters if len(parameters) == 1 else parameters,
            'expected_type': 'number'
        }
        test_cases.append(test_case)
    
    # Add generic test case
    generic_test = {
        'task_params': {'side_length': 10},
        'expected_type': 'number'
    }
    test_cases.append(generic_test)
    
    return test_cases

if __name__ == "__main__":
    task = globals().get('task', '')
    if not task and len(sys.argv) > 1:
        task = sys.argv[1]
        
    if not task:
        print(json.dumps({"error": "No task specification provided"}))
        sys.exit(1)
        
    artifact = create_code_artifact(task)
    print(json.dumps(artifact, indent=2))
