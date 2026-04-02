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

## Available Scripts

### 1. `scripts/create_code_artifact.py`
Generates a structured code artifact (JSON) based on a task specification.
- **Input**: `task` (string)
- **Output**: JSON object with `name`, `description`, `function`, `usage`, `dependencies`, and `test_cases`.

## Usage Examples

### Create a Math Calculator
```python
artifact = CALL: execute_python ARGUMENTS: {
    "code": "import json; from scripts.create_code_artifact import create_code_artifact; print(json.dumps(create_code_artifact('Create a sum calculator for a list of numbers')))"
}
```

### Create a Data Processor
```python
artifact = CALL: execute_python ARGUMENTS: {
    "code": "import json; from scripts.create_code_artifact import create_code_artifact; print(json.dumps(create_code_artifact('Analyze the sales dataset and provide summary stats')))"
}
```

## Best Practices
1. **Be specific** - Provide clear requirements in the task specification.
2. **Review output** - Always review the generated artifact using the `quality-review` skill.
3. **Handle errors** - Wrap script calls in try-except blocks.
