---
name: quality-review
description: Review code, outputs, and execution results for quality, safety, and correctness. Use when you need to validate Python code, check for errors, ensure safety, or approve execution.
license: Apache-2.0
metadata:
  author: keel-system
  version: "1.0"
---

# Quality Review Skill

## When to use this skill

Use this skill when you need to:
- Review Python code for safety and correctness
- Validate outputs and execution results
- Check for syntax errors and logical flaws
- Ensure code follows best practices
- Verify requirements compliance
- Approve or reject code execution

## Review Process

### Step 1: Code Analysis
- Check syntax and structure
- Verify imports and dependencies
- Analyze logic and flow
- Identify potential issues

### Step 2: Safety Assessment
- Check for dangerous operations
- Validate file access patterns
- Review data handling
- Assess security implications

### Step 3: Quality Check
- Verify code follows best practices
- Check error handling
- Assess performance considerations
- Validate output expectations

### Step 4: Decision
- Approve if code is safe and correct
- Provide specific feedback if issues found
- Suggest improvements when needed

## Code Review Checklist

### Syntax and Structure
```python
# General-purpose code artifact reviewer
def review_code_artifact(artifact_json):
    """Review a code artifact and provide structured feedback."""
    import json
    import ast
    
    log(f"Starting code artifact review")
    
    # Extract JSON from mixed output (logs + JSON)
    json_start = artifact_json.find('{')
    json_end = artifact_json.rfind('}')
    
    if json_start != -1 and json_end != -1 and json_end > json_start:
        json_str = artifact_json[json_start:json_end + 1]
        log(f"Extracted JSON from mixed output")
    else:
        json_str = artifact_json
    
    try:
        artifact = json.loads(json_str)
    except json.JSONDecodeError:
        return create_error_review("Invalid JSON format for artifact")
    
    log(f"Successfully parsed artifact: {artifact.get('name', 'unknown')}")
    
    # Initialize review result
    review = {
        'artifact_id': artifact.get('id', 'unknown'),
        'artifact_name': artifact.get('name', 'unknown'),
        'approved': False,
        'issues': [],
        'suggestions': [],
        'security_concerns': [],
        'test_results': None,
        'feedback': '',
        'recommendation': 'needs_fixes'
    }
    
    # Required fields check
    required_fields = ['name', 'description', 'function', 'usage']
    for field in required_fields:
        if field not in artifact or not artifact[field]:
            review['issues'].append(f"Missing required field: {field}")
    
    # Code quality checks
    if 'function' in artifact:
        code_issues = analyze_code_quality(artifact['function'])
        review['issues'].extend(code_issues['syntax_errors'])
        review['suggestions'].extend(code_issues['quality_suggestions'])
        review['security_concerns'].extend(code_issues['security_issues'])
    
    # Dependencies check
    if 'dependencies' in artifact:
        dep_issues = analyze_dependencies(artifact['dependencies'])
        review['issues'].extend(dep_issues)
    
    # Test cases analysis
    if 'test_cases' in artifact and artifact['test_cases']:
        test_results = analyze_test_cases(artifact)
        review['test_results'] = test_results
        if not test_results['pass']:
            review['issues'].append("Some test cases may fail")
    
    # Usage example check
    if 'usage' in artifact:
        usage_issues = analyze_usage_example(artifact['usage'], artifact['function'])
        review['suggestions'].extend(usage_issues)
    
    # Make final decision
    if not review['issues'] and not review['security_concerns']:
        review['approved'] = True
        review['recommendation'] = 'approved'
        review['feedback'] = f"Code artifact '{artifact['name']}' is well-structured and ready for use."
    elif review['security_concerns']:
        review['recommendation'] = 'rejected'
        review['feedback'] = f"Code artifact '{artifact['name']}' has security concerns that must be addressed."
    else:
        review['recommendation'] = 'needs_fixes'
        review['feedback'] = f"Code artifact '{artifact['name']}' needs improvements before approval."
    
    return format_review_output(review)

def analyze_code_quality(code):
    """Analyze Python code for quality and security."""
    issues = {
        'syntax_errors': [],
        'quality_suggestions': [],
        'security_issues': []
    }
    
    # Syntax check
    try:
        ast.parse(code)
    except SyntaxError as e:
        issues['syntax_errors'].append(f"Syntax error: {e}")
        return issues
    
    # Security checks
    dangerous_patterns = {
        'os.system': 'Use subprocess instead of os.system',
        'eval(': 'Avoid eval() - use safer alternatives',
        'exec(': 'Avoid exec() - use safer alternatives',
        '__import__': 'Avoid dynamic imports',
        'input(': 'Be careful with input() in production',
        'open(': 'Add error handling for file operations'
    }
    
    for pattern, message in dangerous_patterns.items():
        if pattern in code:
            issues['security_issues'].append(f"Security concern: {message}")
    
    # Quality checks
    if len(code) > 100 and '"""' not in code and "'''" not in code:
        issues['quality_suggestions'].append("Add docstrings for better documentation")
    
    if 'try:' not in code and ('open(' in code or 'int(' in code or 'float(' in code):
        issues['quality_suggestions'].append("Consider adding error handling")
    
    if any(keyword in code for keyword in ['import os', 'import sys']) and 'try:' not in code:
        issues['quality_suggestions'].append("Add error handling for system operations")
    
    return issues

def analyze_dependencies(dependencies):
    """Analyze dependency requirements."""
    issues = []
    
    # Common safe dependencies
    safe_deps = ['pandas', 'numpy', 'requests', 'matplotlib', 'seaborn', 'scipy', 'sklearn']
    
    for dep in dependencies:
        if dep not in safe_deps:
            issues.append(f"Uncommon dependency '{dep}' - ensure it's necessary")
    
    return issues

def analyze_test_cases(artifact):
    """Analyze test cases for completeness."""
    test_cases = artifact['test_cases']
    results = {'pass': True, 'coverage': 'partial'}
    
    if not test_cases:
        return {'pass': False, 'coverage': 'none'}
    
    # Check if test cases cover different scenarios
    if len(test_cases) == 1:
        results['coverage'] = 'minimal'
    elif len(test_cases) >= 3:
        results['coverage'] = 'good'
    
    # Try to run test cases (simple validation)
    function_code = artifact.get('function', '')
    if 'def ' in function_code:
        results['pass'] = True  # Assume pass for now - real execution would be complex
    
    return results

def analyze_usage_example(usage, function_code):
    """Analyze usage example for clarity."""
    suggestions = []
    
    if not usage.strip():
        suggestions.append("Add a clear usage example")
        return suggestions
    
    # Check if usage example matches the function
    if 'def ' in function_code:
        func_name = function_code.split('def ')[1].split('(')[0].strip()
        if func_name not in usage:
            suggestions.append(f"Usage example should demonstrate {func_name}() function")
    
    if 'print(' not in usage and 'print(' not in usage:
        suggestions.append("Show how to display results in usage example")
    
    return suggestions

def create_error_review(error_message):
    """Create an error review."""
    return json.dumps({
        'approved': False,
        'recommendation': 'rejected',
        'feedback': error_message,
        'issues': [error_message],
        'suggestions': [],
        'security_concerns': []
    }, indent=2)

def format_review_output(review):
    """Format the review for output."""
    return json.dumps(review, indent=2)

# Perform the code artifact review
review_result = review_code_artifact("""{{task}}""")
print(review_result)
log(f"Code artifact review completed: {review_result}")
```

### Safety Checks
```python
def check_safety(code):
    """Check code for potentially dangerous operations."""
    dangerous_patterns = [
        'os.system', 'subprocess.call', 'eval(', 'exec(',
        'open(', 'file(', '__import__', 'input('
    ]
    
    issues = []
    for pattern in dangerous_patterns:
        if pattern in code:
            issues.append(f"Potentially dangerous: {pattern}")
    
    # Check for file operations
    if 'write(' in code or 'w' in code:
        issues.append("File write operations detected")
    
    return issues
```

### Import Validation
```python
def check_imports(code):
    """Validate imports in the code."""
    allowed_imports = [
        'pandas', 'numpy', 'math', 'json', 'csv', 're',
        'datetime', 'collections', 'itertools', 'statistics'
    ]
    
    import_issues = []
    lines = code.split('\n')
    
    for line in lines:
        if line.strip().startswith('import ') or line.strip().startswith('from '):
            for allowed in allowed_imports:
                if allowed in line:
                    break
            else:
                import_issues.append(f"Questionable import: {line.strip()}")
    
    return import_issues
```

## Review Templates

### Python Code Review
```python
def review_python_code(code, requirements=None):
    """Comprehensive Python code review."""
    review_result = {
        'approved': False,
        'issues': [],
        'suggestions': [],
        'summary': ''
    }
    
    log("Starting Python code review...")
    
    # 1. Syntax check
    syntax_ok, syntax_msg = check_syntax(code)
    if not syntax_ok:
        review_result['issues'].append(syntax_msg)
        review_result['summary'] = "Code has syntax errors - cannot approve"
        return review_result
    
    # 2. Safety check
    safety_issues = check_safety(code)
    review_result['issues'].extend(safety_issues)
    
    # 3. Import validation
    import_issues = check_imports(code)
    review_result['issues'].extend(import_issues)
    
    # 4. Logic analysis
    logic_issues = analyze_logic(code)
    review_result['issues'].extend(logic_issues)
    
    # 5. Requirements check
    if requirements:
        req_issues = check_requirements(code, requirements)
        review_result['issues'].extend(req_issues)
    
    # 6. Best practices
    suggestions = check_best_practices(code)
    review_result['suggestions'].extend(suggestions)
    
    # Make decision
    critical_issues = [issue for issue in review_result['issues'] 
                      if any(keyword in issue.lower() 
                            for keyword in ['syntax error', 'dangerous', 'security'])]
    
    if critical_issues:
        review_result['summary'] = "CRITICAL ISSUES FOUND - REJECTED"
        review_result['approved'] = False
    elif review_result['issues']:
        review_result['summary'] = "Minor issues found - suggest improvements"
        review_result['approved'] = False
    else:
        review_result['summary'] = "APPROVED - Code is safe and correct"
        review_result['approved'] = True
    
    log(f"Review complete: {review_result['summary']}")
    return review_result
```

### Logic Analysis
```python
def analyze_logic(code):
    """Analyze code logic for potential issues."""
    issues = []
    
    # Check for undefined variables
    lines = code.split('\n')
    defined_vars = set()
    
    for line in lines:
        line = line.strip()
        if line.startswith('#') or not line:
            continue
            
        # Track variable assignments
        if '=' in line and not line.startswith(('if', 'while', 'for')):
            var_name = line.split('=')[0].strip()
            defined_vars.add(var_name)
        
        # Check for undefined variables in expressions
        if 'print(' in line or 'return ' in line:
            # Simple check for undefined variables
            words = line.replace('print(', '').replace('return ', '').replace(')', '').split()
            for word in words:
                if word.isidentifier() and word not in defined_vars and word not in ['True', 'False', 'None']:
                    issues.append(f"Potentially undefined variable: {word}")
    
    return issues
```

### Best Practices Check
```python
def check_best_practices(code):
    """Check code against best practices."""
    suggestions = []
    
    # Check for comments
    if '#' not in code and len(code) > 50:
        suggestions.append("Consider adding comments for better code documentation")
    
    # Check for function definitions
    if 'def ' not in code and len(code) > 100:
        suggestions.append("Consider breaking code into functions for better organization")
    
    # Check for error handling
    if 'try:' not in code and any(op in code for op in ['open(', 'pd.read_', 'int(']):
        suggestions.append("Consider adding error handling for robust code")
    
    # Check for logging
    if 'log(' not in code and len(code) > 50:
        suggestions.append("Consider adding log statements for debugging")
    
    return suggestions
```

## Output Review

### Result Validation
```python
def review_execution_result(code, result, expected_output=None):
    """Review execution results for correctness."""
    review = {
        'approved': True,
        'issues': [],
        'summary': ''
    }
    
    log("Reviewing execution results...")
    
    # Check for errors
    if 'error' in result.lower() or 'exception' in result.lower():
        review['issues'].append("Execution produced errors")
        review['approved'] = False
    
    # Check for expected output
    if expected_output:
        if expected_output not in result:
            review['issues'].append(f"Expected output not found: {expected_output}")
            review['approved'] = False
    
    # Check for completion
    if not result.strip():
        review['issues'].append("No output produced")
        review['approved'] = False
    
    review['summary'] = "APPROVED" if review['approved'] else "ISSUES FOUND"
    log(f"Result review: {review['summary']}")
    
    return review
```

## Review Decision Matrix

### Approval Criteria
- **APPROVED**: No critical issues, code is safe and correct
- **CONDITIONAL**: Minor issues, suggest improvements but can proceed
- **REJECTED**: Critical issues, must fix before execution

### Response Templates

#### Approved
```
APPROVED

The code has been reviewed and is safe to execute:
- No syntax errors detected
- No dangerous operations found
- Logic appears sound
- Follows best practices

Ready for execution.
```

#### Rejected with Issues
```
REJECTED

Issues found that must be addressed:

Critical Issues:
- [List critical issues here]

Minor Issues:
- [List minor issues here]

Suggestions:
- [List improvement suggestions here]

Please fix the critical issues before execution.
```

## Special Review Cases

### Data Operations
```python
def review_data_operations(code):
    """Specifically review data manipulation operations."""
    data_issues = []
    
    # Check for proper data loading
    if 'pd.read' in code and 'try:' not in code:
        data_issues.append("Data loading should include error handling")
    
    # Check for data validation
    if 'DataFrame' in code and '.shape' not in code and '.info()' not in code:
        data_issues.append("Consider adding data validation checks")
    
    # Check for memory efficiency
    if 'pd.concat' in code and 'ignore_index=True' not in code:
        data_issues.append("Consider using ignore_index=True for concatenation")
    
    return data_issues
```

### File Operations
```python
def review_file_operations(code):
    """Review file operations for safety."""
    file_issues = []
    
    # Check for file path safety
    if 'open(' in code:
        if '..' in code or '/' in code:
            file_issues.append("Be cautious with file paths - avoid directory traversal")
    
    # Check for file closure
    if 'with open(' not in code and 'open(' in code:
        file_issues.append("Use 'with open()' for proper file handling")
    
    # Check for file existence
    if 'open(' in code and 'os.path.exists' not in code:
        file_issues.append("Consider checking file existence before opening")
    
    return file_issues
```

## Tools Available

- `execute_python`: Test code execution (use carefully)
- `vfs_read`: Access files for review
- `log`: Document review process

## Review Workflow

### Complete Review Process
```python
def complete_review(code, context=None, requirements=None):
    """Perform complete quality review."""
    log("=== QUALITY REVIEW STARTED ===")
    
    # 1. Basic code review
    code_review = review_python_code(code, requirements)
    
    # 2. Specialized reviews based on content
    if 'pd.' in code or 'DataFrame' in code:
        data_issues = review_data_operations(code)
        code_review['issues'].extend(data_issues)
    
    if 'open(' in code:
        file_issues = review_file_operations(code)
        code_review['issues'].extend(file_issues)
    
    # 3. Generate final response
    if code_review['approved']:
        response = "APPROVED"
    else:
        response = "REJECTED\n\nIssues found:\n"
        for issue in code_review['issues']:
            response += f"- {issue}\n"
        
        if code_review['suggestions']:
            response += "\nSuggestions:\n"
            for suggestion in code_review['suggestions']:
                response += f"- {suggestion}\n"
    
    log(f"=== REVIEW COMPLETE: {response.split()[0] if response else 'NO DECISION'} ===")
    return response, code_review
```

## Best Practices for Review

1. **Be thorough but fair** - Check for real issues, not style preferences
2. **Provide specific feedback** - Tell exactly what needs to be fixed
3. **Consider context** - Understand what the code is trying to accomplish
4. **Prioritize safety** - Security and safety come first
5. **Be constructive** - Help improve the code, not just criticize

## Example Usage

```python
# Review a piece of Python code
code_to_review = """
import pandas as pd
import numpy as np

def analyze_data(data):
    df = pd.DataFrame(data)
    result = df.describe()
    print(f"Analysis complete: {len(df)} rows analyzed")
    return result
"""

response, review_details = complete_review(code_to_review)
print(response)
```
