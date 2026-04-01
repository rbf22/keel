---
name: python-coding
description: Write and execute Python code for data analysis, automation, and problem-solving. Use when you need to create scripts, analyze data, perform calculations, or solve computational problems.
license: Apache-2.0
metadata:
  author: keel-system
  version: "1.0"
---

# Python Coding Skill

## When to use this skill

Use this skill when you need to:
- Write Python scripts for automation or data processing
- Perform data analysis and visualization
- Solve mathematical or computational problems
- Process files or manipulate data structures
- Implement algorithms or business logic
- Create tools or utilities

## Coding Process

### Step 1: Requirements Analysis
- Understand what the code needs to accomplish
- Identify inputs, outputs, and constraints
- Consider edge cases and error handling

### Step 2: Design
- Plan the code structure and approach
- Choose appropriate libraries and functions
- Consider performance and readability

### Step 3: Implementation
- Write clean, well-commented Python code
- Use proper variable names and function structure
- Include error handling and validation

### Step 4: Testing
- Test with sample data or cases
- Verify outputs are correct
- Check for edge cases

### Step 5: Execution
```
Use: CALL: execute_python ARGUMENTS: {"code": "your_python_code_here"}
```

## Code Structure Guidelines

### Function Organization
```python
# General-purpose code artifact creator
def create_code_artifact(task_specification):
    """Create a code artifact based on task specification."""
    import json
    import uuid
    import re
    
    log(f"Creating code artifact for: {task_specification}")
    
    # Parse the task specification
    task_lower = task_specification.lower()
    
    # Determine what type of code to create
    if any(keyword in task_lower for keyword in ['sum', 'add', 'calculate', 'compute', 'multiply', 'divide', 'subtract']):
        artifact = create_math_artifact(task_specification)
    elif any(keyword in task_lower for keyword in ['analyze', 'data', 'dataset', 'statistics', 'process']):
        artifact = create_data_artifact(task_specification)
    elif any(keyword in task_lower for keyword in ['file', 'read', 'write', 'save', 'load']):
        artifact = create_file_artifact(task_specification)
    elif any(keyword in task_lower for keyword in ['web', 'fetch', 'download', 'scrape', 'api']):
        artifact = create_web_artifact(task_specification)
    else:
        artifact = create_general_artifact(task_specification)
    
    # Generate unique ID
    artifact['id'] = str(uuid.uuid4())[:8]
    artifact['created_by'] = 'python-coding'
    artifact['status'] = 'pending'
    
    log(f"Created artifact: {artifact['id']} - {artifact['name']}")
    return artifact

def create_math_artifact(task):
    """Create mathematical computation artifact."""
    import re
    
    # Extract specific operation
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
    else:
        return create_general_math_artifact(task)

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

def create_file_artifact(task):
    """Create file handling artifact."""
    return {
        'name': 'file_handler',
        'description': 'Handle file operations',
        'function': '''def handle_file(filename, operation='read', content=None):
    """Handle file operations safely."""
    try:
        if operation == 'read':
            with open(filename, 'r') as f:
                return f.read()
        elif operation == 'write':
            with open(filename, 'w') as f:
                f.write(content)
            return f"Written to {filename}"
        else:
            return "Unknown operation"
    except Exception as e:
        return f"Error: {e}"''',
        'usage': '''# Example usage
content = handle_file('data.txt', 'read')
print(content)''',
        'dependencies': [],
        'test_cases': []
    }

def create_web_artifact(task):
    """Create web fetching artifact."""
    return {
        'name': 'web_fetcher',
        'description': 'Fetch data from web',
        'function': '''def fetch_web_data(url):
    """Fetch data from a URL."""
    import requests
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.text
    except Exception as e:
        return f"Error fetching {url}: {e}"''',
        'usage': '''# Example usage
data = fetch_web_data('https://example.com')
print(data)''',
        'dependencies': ['requests'],
        'test_cases': []
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

def create_general_math_artifact(task):
    """Create general math artifact."""
    return {
        'name': 'math_calculator',
        'description': 'General mathematical calculations',
        'function': '''def calculate(operation, numbers):
    """Perform mathematical operations."""
    if operation == 'sum':
        return sum(numbers)
    elif operation == 'product':
        result = 1
        for n in numbers:
            result *= n
        return result
    elif operation == 'average':
        return sum(numbers) / len(numbers) if numbers else 0
    else:
        return "Unknown operation"''',
        'usage': '''# Example usage
result = calculate('sum', [134, 14])
print(f"Result: {result}")''',
        'dependencies': [],
        'test_cases': [
            {'operation': 'sum', 'numbers': [134, 14], 'expected': 148}
        ]
    }

# Create and output the code artifact
artifact = create_code_artifact("""{{task}}""")
print(json.dumps(artifact, indent=2))
log(f"Code artifact '{artifact['id']}' created successfully")
```

### Data Processing Pattern
```python
import pandas as pd
import numpy as np

def process_data(data):
    """Process the input data and return results."""
    # Load and clean data
    df = pd.DataFrame(data)
    
    # Perform analysis
    result = df.describe()
    
    return result

# Log progress
log("Starting data processing...")
result = process_data(your_data)
log(f"Processing complete. Result: {result}")
```

## Available Libraries

### Data Analysis
- `pandas`: Data manipulation and analysis
- `numpy`: Numerical computing
- `matplotlib`: Basic plotting
- `seaborn`: Statistical visualization

### General Purpose
- `json`: JSON data handling
- `csv`: CSV file processing
- `re`: Regular expressions
- `datetime`: Date and time operations
- `math`: Mathematical functions

### Web and Network
- `requests`: HTTP requests (if available)
- `urllib`: URL handling

## Best Practices

### Code Quality
- Use clear, descriptive variable names
- Write functions that do one thing well
- Add comments for complex logic
- Include docstrings for functions

### Error Handling
```python
try:
    result = risky_operation()
    log(f"Operation successful: {result}")
except Exception as e:
    log(f"Error occurred: {e}")
    # Handle error appropriately
```

### Logging
- Use `log()` function to show progress
- Log important steps and results
- Include relevant data in log messages

### Performance
- Use vectorized operations with pandas/numpy
- Avoid unnecessary loops
- Consider memory usage for large datasets

## Common Patterns

### Data Analysis
```python
import pandas as pd
import numpy as np

def analyze_dataset(data):
    """Analyze a dataset and return insights."""
    df = pd.DataFrame(data)
    
    # Basic statistics
    stats = df.describe()
    log(f"Dataset shape: {df.shape}")
    log(f"Basic stats: {stats}")
    
    # Correlations
    correlations = df.corr()
    log(f"Correlations: {correlations}")
    
    return {
        'shape': df.shape,
        'stats': stats,
        'correlations': correlations
    }
```

### File Processing
```python
def process_file(filename):
    """Process a file and extract information."""
    try:
        with open(filename, 'r') as f:
            content = f.read()
        
        # Process content
        lines = content.split('\n')
        log(f"File has {len(lines)} lines")
        
        return processed_content
    except FileNotFoundError:
        log(f"File not found: {filename}")
        return None
```

### Mathematical Calculations
```python
import math

def calculate_metrics(values):
    """Calculate various metrics for a list of values."""
    if not values:
        return {}
    
    metrics = {
        'mean': sum(values) / len(values),
        'median': sorted(values)[len(values) // 2],
        'std_dev': math.sqrt(sum((x - sum(values)/len(values))**2 for x in values) / len(values))
    }
    
    log(f"Calculated metrics: {metrics}")
    return metrics
```

## Output Format

Structure your code results as:

```python
# Clear output formatting
print("=== Results ===")
print(f"Total items processed: {count}")
print(f"Success rate: {success_rate:.2%}")
print(f"Key finding: {key_result}")

# For data analysis
print("\n=== Data Summary ===")
print(df.describe())
```

## Tools Available

- `execute_python`: Run Python code
- `vfs_write`: Save results or code files
- `vfs_read`: Access stored data or code
- `log`: Show progress and debugging information

## Safety Considerations

- Always validate inputs and handle errors
- Be cautious with file operations
- Check data types and ranges
- Use appropriate permissions for file access

## Example Usage

```python
# Example: Analyze sales data
def analyze_sales(sales_data):
    """Analyze sales data and provide insights."""
    df = pd.DataFrame(sales_data)
    
    # Monthly trends
    monthly_sales = df.groupby('month')['amount'].sum()
    log(f"Monthly sales trend: {monthly_sales}")
    
    # Top products
    top_products = df.groupby('product')['amount'].sum().sort_values(ascending=False)
    log(f"Top selling products: {top_products.head()}")
    
    return {
        'monthly_trends': monthly_sales,
        'top_products': top_products
    }

# Execute the analysis
result = analyze_sales(your_sales_data)
print(f"Analysis complete: {result}")
```
