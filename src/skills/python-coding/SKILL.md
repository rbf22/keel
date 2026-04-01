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
def main_function():
    """Main function that orchestrates the solution."""
    # Your main logic here
    pass

def helper_function(param):
    """Helper function for specific tasks."""
    # Helper logic here
    pass

if __name__ == "__main__":
    main_function()
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
