# Parameter Extraction Examples

This document provides examples of how the parameter analyzer skill handles various types of user requests.

## Simple Mathematical Operations

### Example 1: Cube Volume
**Request**: "calculate the volume of a cube with side length 5"

```json
{
  "parameters": {
    "side_length": {"value": 5, "type": "number", "unit": "units"},
    "shape": {"value": "cube", "type": "string"},
    "operation": {"value": "calculate_volume", "type": "string"}
  },
  "confidence": 0.95,
  "clarifications_needed": [],
  "reasoning": "Detected operation: calculate_volume | Identified shape: cube | Extracted parameters: side_length"
}
```

### Example 2: Sphere Area
**Request**: "find the surface area of a sphere with radius 10cm"

```json
{
  "parameters": {
    "radius": {"value": 10, "type": "number", "unit": "cm"},
    "shape": {"value": "sphere", "type": "string"},
    "operation": {"value": "calculate_surface_area", "type": "string"}
  },
  "confidence": 0.95,
  "clarifications_needed": [],
  "reasoning": "Detected operation: calculate_surface_area | Identified shape: sphere | Extracted parameters: radius"
}
```

## Complex Requests

### Example 3: Multiple Numbers
**Request**: "add 5, 10, and 15 together"

```json
{
  "parameters": {
    "numbers": {"value": [5, 10, 15], "type": "array", "unit": "units"},
    "operation": {"value": "calculate_sum", "type": "string"}
  },
  "confidence": 0.8,
  "clarifications_needed": [],
  "reasoning": "Detected operation: calculate_sum | Extracted parameters: numbers"
}
```

### Example 4: Generic Math
**Request**: "calculate 7 times 8"

```json
{
  "parameters": {
    "numbers": {"value": [7, 8], "type": "array", "unit": "units"},
    "operation": {"value": "calculate_product", "type": "string"}
  },
  "confidence": 0.7,
  "clarifications_needed": [],
  "reasoning": "Detected operation: calculate_product | Extracted parameters: numbers"
}
```

## Ambiguous Requests

### Example 5: Missing Parameters
**Request**: "calculate the volume of the box"

```json
{
  "parameters": {
    "shape": {"value": "cube", "type": "string"},
    "operation": {"value": "calculate_volume", "type": "string"}
  },
  "confidence": 0.3,
  "clarifications_needed": ["What dimensions of the cube should be used?"],
  "reasoning": "Detected operation: calculate_volume | Identified shape: cube",
  "clarification_response": {
    "needs_user_input": true,
    "clarification_questions": ["What dimensions of the cube should be used?"],
    "suggested_responses": [
      "calculate the volume of the box with side length [number]",
      "calculate the volume of the box with width [number] and height [number]"
    ]
  }
}
```

### Example 6: Unclear Numbers
**Request**: "calculate something with 42"

```json
{
  "parameters": {
    "numbers": {"value": [42], "type": "array", "unit": "units"}
  },
  "confidence": 0.4,
  "clarifications_needed": ["What does the number 42 represent?"],
  "reasoning": "Basic parameter extraction performed",
  "clarification_response": {
    "needs_user_input": true,
    "clarification_questions": ["What does the number 42 represent?"],
    "suggested_responses": [
      "calculate something with 42 with side length [number]",
      "calculate something with 42 with radius [number]"
    ]
  }
}
```

## Context-Aware Examples

### Example 7: Follow-up Request
**Context**: Previous calculation of cube volume
**Request**: "now do it for 8"

```json
{
  "parameters": {
    "side_length": {"value": 8, "type": "number", "unit": "units"},
    "shape": {"value": "cube", "type": "string"},
    "operation": {"value": "calculate_volume", "type": "string"}
  },
  "confidence": 0.9,
  "clarifications_needed": [],
  "reasoning": "Detected operation: calculate_volume | Identified shape: cube | Extracted parameters: side_length (from context)"
}
```

## Error Handling Examples

### Example 8: No Clear Parameters
**Request**: "do some math"

```json
{
  "parameters": {},
  "confidence": 0.1,
  "clarifications_needed": ["What should I calculate?"],
  "reasoning": "Basic parameter extraction performed",
  "clarification_response": {
    "needs_user_input": true,
    "clarification_questions": ["What should I calculate?"],
    "suggested_responses": [
      "calculate the volume of the [shape]",
      "calculate the area of the [shape]"
    ]
  }
}
```

## Unit Handling

### Example 9: With Units
**Request**: "find the area of a circle with radius 3.5 inches"

```json
{
  "parameters": {
    "radius": {"value": 3.5, "type": "number", "unit": "inches"},
    "shape": {"value": "circle", "type": "string"},
    "operation": {"value": "calculate_area", "type": "string"}
  },
  "confidence": 0.95,
  "clarifications_needed": [],
  "reasoning": "Detected operation: calculate_area | Identified shape: circle | Extracted parameters: radius"
}
```

## Synonym Handling

### Example 10: Common Synonyms
**Request**: "what's the volume of a ball with diameter 10"

```json
{
  "parameters": {
    "diameter": {"value": 10, "type": "number", "unit": "units"},
    "shape": {"value": "sphere", "type": "string"},
    "operation": {"value": "calculate_volume", "type": "string"}
  },
  "confidence": 0.95,
  "clarifications_needed": [],
  "reasoning": "Detected operation: calculate_volume | Identified shape: sphere | Extracted parameters: diameter"
}
```
