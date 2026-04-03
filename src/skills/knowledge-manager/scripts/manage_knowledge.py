import json
import sys
import re
from typing import Dict, Any, List, Optional, Tuple

def parse_markdown_knowledge(content: str) -> Dict[str, Any]:
    """Parse markdown content into structured knowledge."""
    
    knowledge = {
        'topic': '',
        'facts': [],
        'sources': [],
        'context': '',
        'raw_content': content,
        'validation_errors': []
    }
    
    lines = content.split('\n')
    current_section = None
    current_content = []
    
    for line in lines:
        line = line.strip()
        
        # Detect headers
        if line.startswith('# '):
            if current_section == 'topic' and current_content:
                knowledge['topic'] = ' '.join(current_content).strip('# ').strip()
            current_section = 'topic'
            current_content = [line]
        elif line.startswith('## '):
            section_name = line[3:].lower().replace(' ', '_')
            current_section = section_name
            current_content = []
        elif line.startswith('- ') and current_section:
            # List item
            item_content = line[2:].strip()
            if current_section == 'key_facts':
                knowledge['facts'].append(item_content)
            elif current_section == 'sources':
                knowledge['sources'].append(item_content)
            elif current_section == 'additional_context':
                knowledge['context'] += item_content + ' '
        elif line and current_section:
            # Regular content line
            current_content.append(line)
        elif line and current_section == 'additional_context':
            knowledge['context'] += line + ' '
    
    # Clean up topic if not captured
    if not knowledge['topic'] and current_content:
        knowledge['topic'] = ' '.join(current_content).strip('# ').strip()
    
    # Clean up context
    knowledge['context'] = knowledge['context'].strip()
    
    # Validate knowledge structure
    if not knowledge['topic']:
        knowledge['validation_errors'].append('Missing topic header (# Topic Name)')
    
    if not knowledge['facts'] and not knowledge['context']:
        knowledge['validation_errors'].append('No facts or context provided')
    
    return knowledge

def generate_data_request(question: str, missing_info: List[str]) -> str:
    """Generate a standardized request for missing information."""
    
    request = f"""# Information Request for Your Question

I'm researching: "{question}"

To provide you with the most accurate and helpful answer, I need some additional information.

## Missing Information Needed
{chr(10).join(f"- {info}" for info in missing_info)}

## Please Provide Information in This Format

```markdown
# [Topic Name]

## Key Facts
- [Fact 1 with specific details]
- [Fact 2 with specific details]
- [Statistic]: [number] [unit]

## Sources
- [Source 1: URL or reference]
- [Source 2: URL or reference]

## Additional Context
[Any relevant background information that would help answer your question]
```

## Examples

### For Weight Comparisons:
```markdown
# Animal Weight Comparison

## Key Facts
- Average cat weight: 9-15 pounds (4-7 kg)
- Average dog weight: 40-70 pounds (18-32 kg)
- Weight difference: Dogs typically 25-55 lbs heavier than cats

## Sources
- Veterinary Association Statistics, 2023
- Animal Health Research Journal

## Additional Context
Weights vary significantly by breed, age, and health condition.
```

### For Technical Questions:
```markdown
# Programming Topic

## Key Facts
- Concept: [definition and explanation]
- Use case: [when and how to use]
- Performance: [relevant metrics]

## Sources
- Official documentation
- Technical blog post
- Research paper

## Additional Context
[Background about the problem domain]
```

## Tips for Quality Input

- **Be Specific**: Include exact numbers, dates, and measurements
- **Cite Sources**: Provide references for factual claims
- **Add Context**: Include background information that helps understanding
- **Use Structure**: Follow the markdown format for better parsing

Once you provide this information, I can give you a much more detailed and accurate response to your question."""
    
    return request

def enhance_knowledge(base_knowledge: Dict[str, Any], user_data: Dict[str, Any]) -> Dict[str, Any]:
    """Enhance built-in knowledge with user-provided data."""
    
    enhanced = {
        'combined_facts': base_knowledge.get('facts', []),
        'combined_sources': base_knowledge.get('sources', []),
        'combined_context': base_knowledge.get('context', ''),
        'user_contributions': [],
        'confidence_boost': 0.0
    }
    
    # Add user data
    if user_data.get('facts'):
        enhanced['combined_facts'].extend(user_data['facts'])
        enhanced['user_contributions'].extend(user_data['facts'])
        enhanced['confidence_boost'] += 0.2
    
    if user_data.get('sources'):
        enhanced['combined_sources'].extend(user_data['sources'])
        enhanced['confidence_boost'] += 0.1
    
    if user_data.get('context'):
        enhanced['combined_context'] += '\n\nUser-provided context:\n' + user_data['context']
        enhanced['confidence_boost'] += 0.1
    
    # Remove duplicates and clean up
    enhanced['combined_facts'] = list(dict.fromkeys(enhanced['combined_facts']))
    enhanced['combined_sources'] = list(dict.fromkeys(enhanced['combined_sources']))
    
    # Cap confidence boost
    enhanced['confidence_boost'] = min(enhanced['confidence_boost'], 0.4)
    
    return enhanced

def manage_knowledge(task: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Main knowledge management function."""
    
    if context is None:
        context = {}
    
    task_lower = task.lower().strip()
    
    result = {
        'action': '',
        'content': '',
        'enhanced_knowledge': None,
        'missing_data': [],
        'confidence': 0.0
    }
    
    # Check if user is providing knowledge
    if any(indicator in task_lower for indicator in ['provide information', 'here is the data', 'markdown content', '# ']):
        # Parse user-provided knowledge
        parsed_knowledge = parse_markdown_knowledge(task)
        
        if parsed_knowledge['validation_errors']:
            result['action'] = 'validation_error'
            result['content'] = f"""# Knowledge Validation Errors

I found some issues with the provided information:

{chr(10).join(f"- {error}" for error in parsed_knowledge['validation_errors'])}

## Suggested Format

```markdown
# Topic Name

## Key Facts
- Fact 1: [detailed information]
- Fact 2: [detailed information]

## Sources
- Source 1: [reference]
- Source 2: [reference]

## Additional Context
[Background information]
```

Please correct the format and try again."""
            result['confidence'] = 0.1
        else:
            result['action'] = 'knowledge_stored'
            result['content'] = f"""# Knowledge Successfully Integrated

Thank you for providing information about: **{parsed_knowledge['topic']}**

## What I Learned
{chr(10).join(f"- {fact}" for fact in parsed_knowledge['facts'][:5])}

## Sources Added
{chr(10).join(f"- {source}" for source in parsed_knowledge['sources'][:3])}

## Next Steps
This information will enhance my ability to answer related questions. You can now ask questions about this topic, and I'll incorporate this knowledge into my responses.

## Current Knowledge Base
- **Topics stored**: {len(parsed_knowledge['facts'])} facts about {parsed_knowledge['topic']}
- **Sources available**: {len(parsed_knowledge['sources'])} references
- **Context depth**: {len(parsed_knowledge['context'])} characters of background information"""
            result['enhanced_knowledge'] = parsed_knowledge
            result['confidence'] = 0.9
    
    elif 'what information do you need' in task_lower or 'what data' in task_lower:
        # User is asking what information is needed
        question = context.get('original_question', 'your question')
        
        result['action'] = 'information_request'
        result['content'] = generate_data_request(question, [
            'Specific facts relevant to your question',
            'Numerical data or statistics',
            'Source references for verification',
            'Context or background information'
        ])
        result['confidence'] = 0.8
    
    else:
        # General knowledge management query
        result['action'] = 'guidance'
        result['content'] = """# Knowledge Management Guide

I can help you enhance my knowledge base to provide better answers. Here's how:

## What You Can Provide

### 1. Factual Information
- Specific facts and statistics
- Measurements and quantities
- Dates and timeframes
- Definitions and explanations

### 2. Source References
- URLs to reliable sources
- Book or article titles
- Research papers
- Official documentation

### 3. Context Information
- Background details
- Historical context
- Relevant circumstances
- Comparative data

## How to Provide Information

Simply paste your information in markdown format:

```markdown
# Topic Name

## Key Facts
- Fact 1: [details]
- Fact 2: [details]

## Sources
- Source 1: [reference]
- Source 2: [reference]

## Additional Context
[Background information]
```

## Benefits

- More accurate answers to your questions
- Better context for complex topics
- Reduced need for external lookups
- Personalized knowledge base

## Example Use Cases

- **Research**: Provide scientific papers or articles
- **Comparisons**: Supply data for side-by-side analysis
- **Technical Topics**: Share documentation and examples
- **Current Events**: Add recent developments and news

Ready to enhance my knowledge? Just provide your information in the format above!"""
        result['confidence'] = 0.7
    
    return result

if __name__ == "__main__":
    # Get input from globals or command line
    task = globals().get('task', '')
    context = globals().get('context', {})
    
    if not task and len(sys.argv) > 1:
        task = sys.argv[1]
        if len(sys.argv) > 2:
            try:
                context = json.loads(sys.argv[2])
            except json.JSONDecodeError:
                context = {}
    
    if not task:
        print(json.dumps({"error": "No task provided"}))
        sys.exit(1)
    
    # Manage knowledge
    result = manage_knowledge(task, context)
    
    # Output the result
    print(result['content'])
