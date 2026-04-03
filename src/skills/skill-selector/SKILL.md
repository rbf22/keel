---
name: skill-selector
description: LLM-driven skill discovery and selection for optimal task execution
tags: [selection, discovery, optimization, llm]
---

# Skill Selector

## Overview
The Skill Selector skill uses LLM intelligence to analyze task requirements and dynamically select the optimal combination of skills from the available skill registry, replacing fixed keyword-based skill mapping with intelligent skill discovery.

## Capabilities
- Dynamic skill discovery from available skill registry using skills engine hook
- Task requirement analysis using semantic understanding
- Optimal skill combination selection
- Reasoning for skill selection decisions

## Usage
```python
# Select skills for a task using dynamic skill discovery
result = select_skills({
    'task': 'analyze the sales data and create a visualization',
    'available_skills': ['python-coding', 'data-analysis', 'research'],
    'context': {'previous_tasks': [], 'user_preferences': {}}
})

# Returns skill selection with semantic reasoning
{
    'selected_skills': [
        {'skill': 'data-analysis', 'confidence': 0.9, 'reasoning': 'Data analysis required for sales data'},
        {'skill': 'python-coding', 'confidence': 0.8, 'reasoning': 'Python coding needed for visualization'}
    ],
    'execution_plan': 'data-analysis -> python-coding',
    'confidence': 0.85,
    'reasoning': 'Task requires data analysis followed by visualization generation'
}
```

## Input Parameters
- `task` (string): User's task description
- `available_skills` (array): List of available skills to choose from (discovered dynamically if not provided)
- `context` (object, optional): Previous context and user preferences

## Output Structure
- `selected_skills`: Array of selected skills with confidence scores
- `execution_plan`: Suggested order of skill execution
- `confidence`: Overall confidence in skill selection (0-1)
- `reasoning`: LLM's reasoning for skill selection

## Integration
This skill uses the skills engine hook to dynamically discover available skills and replaces fixed keyword-based skill mapping with intelligent skill discovery.
