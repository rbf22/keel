---
name: parameter-analyzer
description: LLM-driven parameter extraction and analysis for user requests
tags: [analysis, parameters, extraction, llm]
---

# Parameter Analyzer Skill

## Overview
The Parameter Analyzer skill uses LLM intelligence to extract and structure parameters from user requests, replacing hardcoded pattern matching with semantic understanding.

## Capabilities
- Semantic parameter extraction from natural language requests using LLM-driven understanding
- Type inference and validation for extracted parameters
- Handling ambiguous requests through clarification questions
- Context preservation across multiple requests
- Dynamic skill discovery through skills engine hook

## Usage
```python
# Analyze parameters from user request using dynamic skills
result = analyze_parameters({
    'request': 'calculate the volume of a cube with side length 5',
    'context': {'previous_parameters': {}, 'task_type': 'math_calculation'}
})

# Returns structured parameters with semantic understanding
{
    'parameters': {
        'side_length': {'value': 5, 'type': 'number', 'unit': 'units'},
        'shape': {'value': 'cube', 'type': 'string'}
    },
    'confidence': 0.95,
    'clarifications_needed': [],
    'reasoning': 'Detected cube volume calculation with side length parameter'
}
```

## Input Parameters
- `request` (string): User's natural language request
- `context` (object, optional): Previous context and conversation history

## Output Structure
- `parameters`: Structured parameter objects with types and values
- `confidence`: Confidence score for parameter extraction (0-1)
- `clarifications_needed`: Array of clarification questions if needed
- `reasoning`: LLM's reasoning for parameter extraction decisions

## Error Handling
- Handles ambiguous requests by requesting clarification
- Provides fallback parameter extraction for unclear requests
- Maintains context for follow-up questions
- Uses dynamic skill discovery for flexible operation

## Examples
1. **Simple Math**: "calculate the area of a circle with radius 10"
   - Extracts: `radius: 10, shape: circle, operation: area`

2. **Complex Request**: "find the volume of a sphere if the diameter is 8cm"
   - Extracts: `diameter: 8, shape: sphere, unit: cm, operation: volume`

3. **Ambiguous Request**: "calculate the size of the box"
   - Requests clarification: "What dimensions of the box do you want to calculate?"

## Integration
This skill uses LLM-driven semantic analysis and replaces hardcoded parameter extraction with intelligent understanding. It integrates with the skills engine hook for dynamic skill discovery.
