import json
import sys

def analyze_task_characteristics(task_description):
    """Analyze task to determine type, complexity, and requirements."""
    task_lower = task_description.lower()
    
    # Task type detection
    task_type = 'general'
    if any(word in task_lower for word in ['sum', 'add', 'calculate', 'multiply', 'divide', 'compute']):
        task_type = 'math_calculation'
    elif any(word in task_lower for word in ['analyze', 'data', 'statistics', 'dataset']):
        task_type = 'data_analysis'
    elif any(word in task_lower for word in ['research', 'find', 'investigate', 'search']):
        task_type = 'research'
    elif any(word in task_lower for word in ['file', 'read', 'write', 'save', 'load']):
        task_type = 'file_operations'
    
    # Complexity assessment
    complexity = 'simple'
    if any(word in task_lower for word in ['complex', 'multiple', 'several', 'various']):
        complexity = 'complex'
    elif any(word in task_lower for word in ['analyze', 'process', 'calculate']):
        complexity = 'moderate'
    
    # Required skills
    required_skills = []
    if task_type == 'math_calculation':
        required_skills = ['python-coding']
    elif task_type == 'data_analysis':
        required_skills = ['python-coding', 'data-analysis']
    elif task_type == 'research':
        required_skills = ['research']
    elif task_type == 'file_operations':
        required_skills = ['python-coding']
    else:
        required_skills = ['python-coding']
    
    return {
        'type': task_type,
        'complexity': complexity,
        'required_skills': required_skills
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
