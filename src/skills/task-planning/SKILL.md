---
name: task-planning
description: Break down complex tasks into structured plans and coordinate multi-step workflows. Use when you need to plan complex projects, decompose tasks, or create execution strategies.
license: Apache-2.0
metadata:
  author: keel-system
  version: "1.0"
---

# Task Planning Skill

## When to use this skill

Use this skill when you need to:
- Break down complex tasks into manageable steps
- Create structured execution plans
- Coordinate multi-skill workflows
- Estimate task complexity and requirements
- Plan resource allocation
- Design execution strategies

## Planning Process

### Step 1: Task Analysis
- Understand the overall objective
- Identify constraints and requirements
- Assess task complexity and scope
- Determine necessary skills and resources

### Step 2: Decomposition
- Break task into logical sub-tasks
- Identify dependencies between steps
- Sequence tasks appropriately
- Define clear objectives for each step

### Step 3: Resource Planning
- Determine required skills for each step
- Estimate time and resource needs
- Identify potential bottlenecks
- Plan contingency strategies

### Step 4: Plan Creation
- Create detailed execution plan
- Define success criteria
- Establish checkpoints and milestones
- Document the complete strategy

## Available Scripts

### 1. `scripts/analyze_requirements.py`
Analyzes a task description to determine its type, complexity, and the skills required.
- **Input**: `task` (string)
- **Output**: JSON object with `type`, `complexity`, and `required_skills`.

### 2. `scripts/generate_structured_plan.py`
Generates a multi-step execution plan compatible with the Keel orchestrator.
- **Input**: `task` (string), `task_type` (string, optional)
- **Output**: JSON object with a list of `subtasks`.

## Usage Examples

### Analyze and Plan a Task
```python
# First, analyze the task
analysis = CALL: execute_python ARGUMENTS: {
    "code": "import json; from scripts.analyze_requirements import analyze_task_characteristics; print(json.dumps(analyze_task_characteristics('Analyze the sales data')))"
}

# Then, generate the structured plan
plan = CALL: execute_python ARGUMENTS: {
    "code": "import json; from scripts.generate_structured_plan import generate_structured_plan; print(json.dumps(generate_structured_plan('Analyze the sales data', 'data_analysis')))"
}
```

## Best Practices
1. **Be realistic** - Provide accurate time and resource estimates.
2. **Be specific** - Define clear success criteria for each step.
3. **Consider dependencies** - Properly sequence tasks based on dependencies.
