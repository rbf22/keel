"""
Common utilities for analyzing and generating self-documenting artifact interfaces.
This module provides shared functionality for skill scripts to generate interface metadata.
"""

import ast
import json
from typing import Dict, Any, List, Optional

def analyze_function_interface(function_code: str) -> Dict[str, Any]:
    """Analyze generated function to determine its interface and calling requirements."""
    
    try:
        # Parse the function AST
        tree = ast.parse(function_code)
        
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                return analyze_single_function(node)
        
        # If no function found, return default interface
        return create_default_interface()
        
    except Exception as e:
        # If parsing fails, return default interface
        return create_default_interface()

def analyze_single_function(func_node: ast.FunctionDef) -> Dict[str, Any]:
    """Analyze a single function node to extract interface information."""
    
    args = func_node.args
    parameters = []
    
    # Analyze regular arguments
    for i, arg in enumerate(args.args):
        param_info = {
            'name': arg.arg,
            'type': 'positional',
            'required': i >= len(args.defaults),  # No default = required
            'has_default': i < len(args.defaults)
        }
        
        if param_info['has_default']:
            try:
                param_info['default'] = ast.literal_eval(args.defaults[i])
            except Exception:
                param_info['default'] = None
        
        parameters.append(param_info)
    
    # Check for *args
    has_varargs = args.vararg is not None
    if has_varargs:
        parameters.append({
            'name': args.vararg.arg,
            'type': 'varargs',
            'required': False
        })
    
    # Check for **kwargs
    has_kwargs = args.kwarg is not None
    if has_kwargs:
        parameters.append({
            'name': args.kwarg.arg,
            'type': 'kwargs',
            'required': False
        })
    
    # Determine calling pattern
    calling_pattern = determine_calling_pattern(parameters, has_kwargs)
    
    # Generate execution template
    execution_template = generate_execution_template(func_node.name, calling_pattern)
    
    return {
        'name': func_node.name,
        'parameters': parameters,
        'calling_pattern': calling_pattern,
        'has_varargs': has_varargs,
        'has_kwargs': has_kwargs,
        'execution_template': execution_template,
        'total_parameters': len(args.args),
        'required_parameters': len([p for p in parameters if p.get('required', False)])
    }

def determine_calling_pattern(parameters: List[Dict[str, Any]], has_kwargs: bool) -> str:
    """Determine the best calling pattern for the function."""
    
    # Check for common patterns
    if (len(parameters) == 1 and 
        parameters[0]['name'] == 'task_params' and 
        parameters[0]['type'] == 'positional'):
        return 'single_dict'
    
    if has_kwargs:
        return 'keyword_args'
    
    if len(parameters) == 0:
        return 'no_args'
    
    if len(parameters) == 1:
        return 'single_param'
    
    return 'positional'

def generate_execution_template(function_name: str, calling_pattern: str) -> str:
    """Generate the appropriate execution template based on calling pattern."""
    
    if calling_pattern == 'single_dict':
        return f"""
# Parse inputs and call artifact function
inputs = {{{{input_json}}}}
result = {function_name}(inputs) if inputs else {function_name}()

# Format output nicely
if isinstance(result, dict):
    for key, value in result.items():
        print(f"{{key}}: {{value}}")
elif isinstance(result, (int, float)):
    print(f"Result: {{result}}")
else:
    print(f"Result: {{result}}")
"""
    
    elif calling_pattern == 'keyword_args':
        return f"""
# Parse inputs and call artifact function
inputs = {{{{input_json}}}}
result = {function_name}(**inputs) if inputs else {function_name}()

# Format output nicely
if isinstance(result, dict):
    for key, value in result.items():
        print(f"{{key}}: {{value}}")
elif isinstance(result, (int, float)):
    print(f"Result: {{result}}")
else:
    print(f"Result: {{result}}")
"""
    
    elif calling_pattern == 'no_args':
        return f"""
# Call artifact function (no arguments)
result = {function_name}()

# Format output nicely
if isinstance(result, dict):
    for key, value in result.items():
        print(f"{{key}}: {{value}}")
elif isinstance(result, (int, float)):
    print(f"Result: {{result}}")
else:
    print(f"Result: {{result}}")
"""
    
    elif calling_pattern == 'single_param':
        return f"""
# Parse inputs and call artifact function
inputs = {{{{input_json}}}}
# Extract the single parameter (try common keys or use first value)
param_value = None
if isinstance(inputs, dict):
    # Try common parameter names
    for key in ['value', 'param', 'input', 'data']:
        if key in inputs:
            param_value = inputs[key]
            break
    # If no common key found, use first value
    if param_value is None and inputs:
        param_value = next(iter(inputs.values()))
elif inputs is not None:
    param_value = inputs

result = {function_name}(param_value) if param_value is not None else {function_name}()

# Format output nicely
if isinstance(result, dict):
    for key, value in result.items():
        print(f"{{key}}: {{value}}")
elif isinstance(result, (int, float)):
    print(f"Result: {{result}}")
else:
    print(f"Result: {{result}}")
"""
    
    else:  # positional
        return f"""
# Parse inputs and call artifact function
inputs = {{{{input_json}}}}
# Map inputs to positional parameters (basic implementation)
positional_args = []
if isinstance(inputs, dict):
    # This is a simplified mapping - in a real implementation,
    # you'd want more sophisticated parameter matching
    for key in sorted(inputs.keys()):
        positional_args.append(inputs[key])
elif inputs is not None:
    positional_args = [inputs]

result = {function_name}(*positional_args)

# Format output nicely
if isinstance(result, dict):
    for key, value in result.items():
        print(f"{{key}}: {{value}}")
elif isinstance(result, (int, float)):
    print(f"Result: {{result}}")
else:
    print(f"Result: {{result}}")
"""

def create_default_interface() -> Dict[str, Any]:
    """Create a default interface for when analysis fails."""
    
    return {
        'name': 'unknown_function',
        'parameters': [
            {
                'name': 'task_params',
                'type': 'positional',
                'required': True,
                'has_default': False
            }
        ],
        'calling_pattern': 'single_dict',
        'has_varargs': False,
        'has_kwargs': False,
        'execution_template': generate_execution_template('unknown_function', 'single_dict'),
        'total_parameters': 1,
        'required_parameters': 1,
        'analysis_failed': True
    }

def create_artifact_with_interface(
    name: str,
    description: str,
    function_code: str,
    usage: str,
    dependencies: List[str],
    test_cases: List[Any],
    metadata: Dict[str, Any]
) -> Dict[str, Any]:
    """Create an artifact with self-documenting interface metadata."""
    
    # Analyze the function interface
    interface = analyze_function_interface(function_code)
    
    # Create the artifact
    artifact = {
        'name': name,
        'description': description,
        'function': function_code,
        'usage': usage,
        'dependencies': dependencies,
        'test_cases': test_cases,
        'artifactInterface': interface,  # Self-documenting interface
        **metadata
    }
    
    return artifact

# Export the main functions for easy import
__all__ = [
    'analyze_function_interface',
    'analyze_single_function', 
    'determine_calling_pattern',
    'generate_execution_template',
    'create_default_interface',
    'create_artifact_with_interface'
]
