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
## Available Scripts

### 1. `scripts/review_code_artifact.py`
Reviews a code artifact (JSON string) for syntax errors, security concerns, and quality issues.
- **Input**: `task` (JSON string of the artifact)
- **Output**: JSON object with `approved`, `issues`, `suggestions`, `security_concerns`, and `recommendation`.

## Usage Examples

### Review a Generated Artifact
```python
# Pass the JSON artifact as a string to the review script
artifact_json = '{"name": "sum_calculator", ...}'
review = CALL: execute_python ARGUMENTS: {
    "code": f"import json; from scripts.review_code_artifact import review_code_artifact; print(json.dumps(review_code_artifact({repr(artifact_json)})))"
}
```

## Best Practices
1. **Prioritize safety** - Security and safety concerns should always lead to a `rejected` recommendation.
2. **Be thorough** - Check for syntax errors, logical flaws, and missing requirements.
3. **Provide feedback** - If an artifact is rejected or needs fixes, provide specific, actionable feedback.

```
