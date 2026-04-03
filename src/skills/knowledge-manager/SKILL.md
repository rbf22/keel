---
name: knowledge-manager
description: Manage and integrate user-provided knowledge with built-in data for enhanced question answering
license: Apache-2.0
metadata:
  author: keel-system
  version: "1.0"
---

# Knowledge Manager Skill

## When to use this skill

Use this skill when you need to:
- Integrate user-provided data with built-in knowledge
- Parse and store information from markdown files
- Request specific data from users for better answers
- Manage knowledge base operations
- Validate and format user-provided information

## Knowledge Integration Process

### Step 1: Data Ingestion
- Parse markdown files for structured information
- Extract key facts, data points, and sources
- Validate data format and completeness
- Store in accessible knowledge structure

### Step 2: Knowledge Enhancement
- Combine user data with built-in knowledge
- Identify gaps and missing information
- Suggest additional data needed for complete answers
- Create comprehensive knowledge responses

### Step 3: Data Request Protocol
- Generate standardized requests for missing information
- Provide clear format guidelines for user input
- Specify types of information needed
- Include examples of expected data format

## Supported Data Formats

### Markdown Structure
```markdown
# Topic Name

## Key Facts
- Fact 1: [detailed information]
- Fact 2: [detailed information]
- Statistic: [number] [unit]

## Sources
- Source 1: [URL or reference]
- Source 2: [URL or reference]

## Additional Context
[Relevant background information]
```

### Data Categories
- **Factual Information**: Verifiable facts and statistics
- **Comparative Data**: Direct comparisons and differences
- **Contextual Information**: Background and supporting details
- **Source References**: Citations and external references

## Knowledge Operations

### Data Integration
```
Input: User-provided markdown content
Process: Parse, validate, and integrate with existing knowledge
Output: Enhanced knowledge base with confidence scores
```

### Gap Analysis
```
Input: Question and available knowledge
Process: Identify missing information needed for complete answer
Output: Specific data requests with format guidelines
```

### Knowledge Retrieval
```
Input: Query or question
Process: Search integrated knowledge base
Output: Relevant information with sources and confidence levels
```

## Best Practices

- **Structured Input**: Use clear markdown formatting with sections
- **Source Citation**: Always include sources for factual information
- **Data Validation**: Verify numerical data and units
- **Context Provision**: Include relevant background information
- **Format Consistency**: Follow standard markdown structure

## Integration with Other Skills

- **Research**: Enhances research answers with user-provided data
- **Data Analysis**: Provides context for analytical tasks
- **Task Planning**: Supplies domain-specific knowledge for planning
- **Quality Review**: Validates knowledge accuracy and completeness

## Output Format

Knowledge responses include:
- **Answer**: Direct response to the question
- **Confidence**: Reliability score (0-1)
- **Sources**: List of information sources
- **Missing Data**: Information still needed
- **Reasoning**: Explanation of how the answer was derived

## Limitations

- Dependent on quality and accuracy of user-provided data
- Cannot verify external source authenticity
- Limited to structured markdown input
- Requires user cooperation for data requests

## Error Handling

- Graceful handling of malformed input
- Clear guidance for data format corrections
- Fallback to built-in knowledge when user data unavailable
- Progressive enhancement as more data is provided
