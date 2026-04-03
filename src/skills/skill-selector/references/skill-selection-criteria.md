# Skill Selection Criteria

This document outlines the criteria and heuristics used by the skill selector for intelligent skill discovery and selection.

## Skill Capability Mapping

### Python Coding
**Primary Uses**: Code generation, calculations, algorithms, function creation
**Keywords**: code, python, program, script, function, calculate, compute, implement
**Operations**: calculation, programming, algorithm, function_creation
**Base Confidence**: 0.7
**Best For**: Mathematical operations, algorithmic tasks, programming problems

### Data Analysis
**Primary Uses**: Data processing, statistical analysis, visualization
**Keywords**: data, analyze, dataset, statistics, chart, graph, visualization, plot
**Operations**: data_processing, statistical_analysis, visualization
**Base Confidence**: 0.8
**Best For**: Data manipulation, statistical calculations, chart generation

### Research
**Primary Uses**: Information gathering, web search, fact finding
**Keywords**: research, find, search, investigate, lookup, information, web
**Operations**: information_gathering, web_search, fact_finding
**Base Confidence**: 0.8
**Best For**: External information retrieval, fact checking, research tasks

### Quality Review
**Primary Uses**: Code review, validation, quality assurance
**Keywords**: review, check, validate, test, quality, verify
**Operations**: code_review, validation, quality_assurance
**Base Confidence**: 0.6
**Best For**: Code validation, error checking, quality assessment

### Task Planning
**Primary Uses**: Task decomposition, planning, coordination
**Keywords**: plan, complex, multiple, steps, breakdown, organize
**Operations**: task_decomposition, planning, coordination
**Base Confidence**: 0.7
**Best For**: Complex multi-step tasks, project organization

### Execution Analyzer
**Primary Uses**: Error analysis, debugging, performance analysis
**Keywords**: analyze, debug, error, problem, issue, troubleshoot
**Operations**: error_analysis, debugging, performance_analysis
**Base Confidence**: 0.6
**Best For**: Debugging, error resolution, performance optimization

## Task Complexity Assessment

### Simple Tasks
**Characteristics**: Single operation, clear requirements, straightforward
**Examples**: "calculate 2+2", "what is 5*3"
**Typical Skills**: [python-coding]
**Confidence Threshold**: 0.5+

### Moderate Tasks
**Characteristics**: Multiple steps, some analysis required
**Examples**: "analyze this dataset", "create a function to calculate area"
**Typical Skills**: [data-analysis, python-coding] or [python-coding, quality-review]
**Confidence Threshold**: 0.6+

### Complex Tasks
**Characteristics**: Multiple operations, unclear requirements, coordination needed
**Examples**: "build a complete data analysis pipeline", "create a complex algorithm"
**Typical Skills**: [task-planning, python-coding, quality-review]
**Confidence Threshold**: 0.7+

## Selection Heuristics

### Keyword Matching
- Exact keyword matches: +0.1 confidence per match
- Partial keyword matches: +0.05 confidence per match
- Contextual keyword matches: +0.08 confidence per match

### Operation Matching
- Direct operation matches: +0.15 confidence per match
- Related operation matches: +0.1 confidence per match
- Indirect operation matches: +0.05 confidence per match

### Contextual Factors
- Previous success with skill: +0.1 confidence
- User preference for skill: +0.08 confidence
- Recent skill usage: +0.05 confidence
- Skill availability: +0.1 confidence

### Negative Factors
- Recent failures with skill: -0.15 confidence
- Skill overload (too recent usage): -0.05 confidence
- Incompatible with context: -0.2 confidence

## Execution Planning

### Single Skill Tasks
**Condition**: One clear skill with confidence > 0.8
**Plan**: [selected_skill]
**Example**: "calculate 5*3" → [python-coding]

### Two Skill Tasks
**Condition**: Primary skill confidence > 0.7, supporting skill > 0.6
**Plan**: [primary_skill, supporting_skill]
**Example**: "analyze data and create chart" → [data-analysis, python-coding]

### Multi-Skill Tasks
**Condition**: Complex task or multiple skills with confidence > 0.6
**Plan**: [task-planning, primary_skill(s), quality-review]
**Example**: "build complete analysis system" → [task-planning, data-analysis, python-coding, quality-review]

## Confidence Calculation

### Individual Skill Confidence
```
confidence = base_confidence + (keyword_matches * 0.1) + (operation_matches * 0.15) + contextual_adjustments
confidence = min(confidence, 1.0)  # Cap at 1.0
```

### Overall Task Confidence
```
overall_confidence = sum(skill_confidences) / number_of_selected_skills
```

### Minimum Thresholds
- Simple tasks: 0.5
- Moderate tasks: 0.6
- Complex tasks: 0.7

## Fallback Strategies

### No Skills Match
**Condition**: All skills have confidence < 0.5
**Fallback**: python-coding with confidence 0.3
**Reasoning**: "fallback skill for unclear task"

### Low Overall Confidence
**Condition**: Overall confidence < 0.4
**Fallback**: Add task-planning skill to improve structure
**Reasoning**: "unclear task requires planning"

### Skill Unavailable
**Condition**: Selected skill not in available skills list
**Fallback**: Next best skill or python-coding
**Reasoning**: "selected skill unavailable, using alternative"

## Examples

### Example 1: Data Analysis
**Task**: "analyze the sales data and create a visualization"
**Analysis**:
- Keywords: "analyze", "data", "visualization" → data-analysis (0.95)
- Keywords: "create", "visualization" → python-coding (0.8)
- Task complexity: moderate
**Selection**: [data-analysis (0.95), python-coding (0.8)]
**Plan**: data-analysis -> python-coding
**Overall Confidence**: 0.875

### Example 2: Research Task
**Task**: "research information about quantum computing"
**Analysis**:
- Keywords: "research", "information" → research (0.9)
- No strong matches for other skills
- Task complexity: simple
**Selection**: [research (0.9)]
**Plan**: research
**Overall Confidence**: 0.9

### Example 3: Complex Programming
**Task**: "build a complete data processing pipeline with error handling"
**Analysis**:
- Keywords: "build", "pipeline", "processing" → python-coding (0.8)
- Keywords: "complete", "pipeline" → task-planning (0.8)
- Keywords: "error handling" → quality-review (0.7)
- Task complexity: complex
**Selection**: [task-planning (0.8), python-coding (0.8), quality-review (0.7)]
**Plan**: task-planning -> python-coding -> quality-review
**Overall Confidence**: 0.77
