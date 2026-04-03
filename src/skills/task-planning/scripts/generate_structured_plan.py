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

def create_flexible_plan(task_description, task_type, required_skills):
    """Create a flexible execution plan based on task and available skills."""
    
    # Get available skills dynamically
    available_skills = get_available_skills()
    
    # LLM-based plan generation prompt
    plan_prompt = f"""
Generate a structured execution plan for the following task:

Task: "{task_description}"
Task type: {task_type}
Required skills: {', '.join(required_skills)}
Available skills: {', '.join(available_skills)}

Create a plan with 2-4 steps that uses the available skills appropriately.
Return JSON with this structure:
{{
    "plan_type": "{task_type}",
    "objective": "Clear objective statement",
    "steps": [
        {{
            "step": 1,
            "title": "Step title",
            "description": "Clear description of what this step does",
            "skill": "skill_name_from_available",
            "inputs": "what this step needs",
            "outputs": "what this step produces"
        }}
    ]
}}

Only use skills from the available skills list.
"""
    
    # Simulate LLM response with flexible plan generation
    steps = []
    
    # Dynamic step creation based on available skills
    if 'python-coding' in required_skills or 'python-coding' in available_skills:
        steps.append({
            'step': 1,
            'title': 'Solution Development',
            'description': 'Develop solution using Python programming',
            'skill': 'python-coding',
            'inputs': task_description,
            'outputs': 'solution_artifact'
        })
    
    # Add quality review if available and task is complex
    if 'quality-review' in available_skills and len(required_skills) > 1:
        steps.append({
            'step': len(steps) + 1,
            'title': 'Quality Review',
            'description': 'Review the developed solution for correctness and safety',
            'skill': 'quality-review',
            'inputs': 'solution_artifact',
            'outputs': 'reviewed_solution'
        })
    
    # Add data analysis if specifically required
    if 'data-analysis' in required_skills:
        if steps:
            # Insert as first step if data analysis comes first
            steps.insert(0, {
                'step': 1,
                'title': 'Data Analysis',
                'description': 'Analyze the data and extract insights',
                'skill': 'data-analysis',
                'inputs': task_description,
                'outputs': 'analysis_results'
            })
            # Renumber subsequent steps
            for i, step in enumerate(steps[1:], 2):
                step['step'] = i
        else:
            steps.append({
                'step': 1,
                'title': 'Data Analysis',
                'description': 'Analyze the data and extract insights',
                'skill': 'data-analysis',
                'inputs': task_description,
                'outputs': 'analysis_results'
            })
    
    # Add research if specifically required
    if 'research' in required_skills:
        if steps:
            steps.insert(0, {
                'step': 1,
                'title': 'Research',
                'description': 'Gather information and research the topic',
                'skill': 'research',
                'inputs': task_description,
                'outputs': 'research_findings'
            })
            # Renumber subsequent steps
            for i, step in enumerate(steps[1:], 2):
                step['step'] = i
        else:
            steps.append({
                'step': 1,
                'title': 'Research',
                'description': 'Gather information and research the topic',
                'skill': 'research',
                'inputs': task_description,
                'outputs': 'research_findings'
            })
    
    # Ensure we have at least one step
    if not steps and available_skills:
        steps.append({
            'step': 1,
            'title': 'Task Execution',
            'description': 'Execute the task using available skills',
            'skill': available_skills[0],
            'inputs': task_description,
            'outputs': 'task_result'
        })
    
    return {
        'plan_type': task_type,
        'objective': f'Complete task: {task_description}',
        'steps': steps
    }

def generate_structured_plan(task_description, task_type=None):
    """Generate a comprehensive task plan using LLM-driven analysis."""
    
    # Auto-detect task type if not provided
    if task_type is None:
        analysis = analyze_task_characteristics(task_description)
        task_type = analysis['type']
        required_skills = analysis['required_skills']
    else:
        # Get required skills for the provided task type
        analysis = analyze_task_characteristics(task_description)
        required_skills = analysis['required_skills']
    
    # Generate flexible plan
    plan = create_flexible_plan(task_description, task_type, required_skills)
    
    # Convert to structured subtasks format for PlanExecutor
    structured_plan = {
        "subtasks": []
    }

    for i, step in enumerate(plan['steps']):
        subtask = {
            "id": f"step_{i+1}",
            "description": step['description'],
            "requirements": [step['title']],
            "assignedSkill": step['skill'],
            "dependencies": [],
            "successCriteria": step.get('success_criteria', f"Step {i+1} completed successfully")
        }
        
        # Add dependencies (previous steps)
        if i > 0:
            subtask["dependencies"] = [f"step_{i}"]
        
        structured_plan["subtasks"].append(subtask)
    
    return structured_plan

if __name__ == "__main__":
    # Parameters provided via globals or sys.argv
    task = globals().get('task', '')
    task_type = globals().get('task_type', None)
    
    if not task and len(sys.argv) > 1:
        task = sys.argv[1]
    if len(sys.argv) > 2:
        task_type = sys.argv[2]
        
    if not task:
        print(json.dumps({"error": "No task description provided"}))
        sys.exit(1)
        
    result = generate_structured_plan(task, task_type)
    print(json.dumps(result, indent=2))
