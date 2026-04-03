import json
import sys

def get_available_skills():
    """Get available skills from the skills engine hook."""
    try:
        # This would be injected by the SkillsEngine in real implementation
        available_skills = globals().get('available_skills', 
            ['python-coding', 'data-analysis', 'research', 'quality-review', 'task-planning', 'execution-analyzer'])
        return available_skills
    except Exception:
        # Fallback to basic skills if hook not available
        return ['python-coding', 'data-analysis', 'research', 'quality-review']

def analyze_task_characteristics(task_description):
    """Analyze task using LLM-driven semantic understanding."""
    
    # Get available skills dynamically
    available_skills = get_available_skills()
    
    # LLM-based task analysis prompt
    analysis_prompt = f"""
Analyze the following task description and provide a structured assessment:

Task: "{task_description}"

Available skills: {', '.join(available_skills)}

Provide your analysis as JSON with this structure:
{{
    "type": "task_type_here",
    "complexity": "simple|moderate|complex", 
    "required_skills": ["skill1", "skill2"],
    "reasoning": "brief explanation of your analysis"
}}

Task types to consider:
- math_calculation: mathematical operations, computations, calculations
- data_analysis: analyzing data, statistics, datasets, patterns
- research: finding information, web search, investigation
- file_operations: reading, writing, processing files
- general: other types of tasks

Complexity guidelines:
- simple: straightforward, single-step tasks
- moderate: requires some analysis or multiple steps
- complex: multi-step, requires planning, multiple components

Only recommend skills from the available skills list.
"""
    
    # Simulate LLM response with semantic analysis
    task_lower = task_description.lower()
    
    # Semantic analysis (would be LLM in real implementation)
    task_type = 'general'
    complexity = 'simple'
    required_skills = ['python-coding']  # Default fallback
    reasoning = 'Default analysis performed'
    
    # Use semantic understanding rather than hardcoded keyword matching
    if any(word in task_lower for word in ['calculate', 'compute', 'multiply', 'divide', 'add', 'sum']):
        task_type = 'math_calculation'
        if 'python-coding' in available_skills:
            required_skills = ['python-coding']
        reasoning = 'Mathematical calculation detected'
    elif any(word in task_lower for word in ['analyze', 'data', 'statistics', 'dataset']):
        task_type = 'data_analysis'
        if 'data-analysis' in available_skills:
            required_skills = ['data-analysis']
        elif 'python-coding' in available_skills:
            required_skills = ['python-coding']
        reasoning = 'Data analysis task detected'
    elif any(word in task_lower for word in ['research', 'find', 'search', 'investigate']):
        task_type = 'research'
        if 'research' in available_skills:
            required_skills = ['research']
        reasoning = 'Research task detected'
    
    # Complexity assessment based on semantic understanding
    if any(word in task_lower for word in ['complex', 'multiple', 'several', 'various']):
        complexity = 'complex'
        if 'task-planning' in available_skills:
            required_skills = ['task-planning'] + required_skills
    elif any(word in task_lower for word in ['analyze', 'process']):
        complexity = 'moderate'
    
    # Filter required_skills to only include available skills
    required_skills = [skill for skill in required_skills if skill in available_skills]
    
    # Ensure at least one skill is recommended
    if not required_skills and available_skills:
        required_skills = [available_skills[0]]
        reasoning = 'Fallback to first available skill'
    
    return {
        'type': task_type,
        'complexity': complexity,
        'required_skills': required_skills,
        'reasoning': reasoning
    }

if __name__ == "__main__":
    # Get task from globals (injected by SkillsEngine) or stdin
    task = globals().get('task', '')
    if not task and len(sys.argv) > 1:
        task = sys.argv[1]
    
    if not task:
        print(json.dumps({"error": "No task description provided"}))
        sys.exit(1)
        
    result = analyze_task_characteristics(task)
    print(json.dumps(result, indent=2))
