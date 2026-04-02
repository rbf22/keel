import json
import sys

def create_math_plan(task_description):
    """Create plan for mathematical calculations."""
    return {
        'plan_type': 'math_calculation',
        'objective': f'Perform mathematical calculation: {task_description}',
        'steps': [
            {
                'step': 1,
                'title': 'Code Creation',
                'description': 'Create Python function to perform the calculation',
                'skill': 'python-coding',
                'inputs': task_description,
                'outputs': 'code_artifact'
            },
            {
                'step': 2,
                'title': 'Code Review',
                'description': 'Review the created code for correctness and safety',
                'skill': 'quality-review',
                'inputs': 'code_artifact',
                'outputs': 'review_result'
            },
            {
                'step': 3,
                'title': 'Execution',
                'description': 'Execute the approved code with user inputs to get the final answer',
                'skill': 'python-coding',
                'inputs': ['approved_artifact', task_description],
                'outputs': 'final_result'
            }
        ]
    }

def create_general_plan(task_description):
    """Create general-purpose plan."""
    return {
        'plan_type': 'general',
        'objective': f'Complete task: {task_description}',
        'steps': [
            {
                'step': 1,
                'title': 'Task Analysis',
                'description': 'Analyze requirements and create solution approach',
                'skill': 'python-coding',
                'inputs': task_description,
                'outputs': 'code_artifact'
            },
            {
                'step': 2,
                'title': 'Quality Review',
                'description': 'Review the created solution',
                'skill': 'quality-review',
                'inputs': 'code_artifact',
                'outputs': 'review_result'
            },
            {
                'step': 3,
                'title': 'Execution',
                'description': 'Execute the approved solution to get final result',
                'skill': 'python-coding',
                'inputs': ['approved_artifact', task_description],
                'outputs': 'final_result'
            }
        ]
    }

def generate_structured_plan(task_description, task_type='general'):
    """Generate a comprehensive task plan based on task type."""
    if task_type == 'math_calculation':
        plan = create_math_plan(task_description)
    else:
        plan = create_general_plan(task_description)
    
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
    task_type = globals().get('task_type', 'general')
    
    if not task and len(sys.argv) > 1:
        task = sys.argv[1]
    if len(sys.argv) > 2:
        task_type = sys.argv[2]
        
    if not task:
        print(json.dumps({"error": "No task description provided"}))
        sys.exit(1)
        
    result = generate_structured_plan(task, task_type)
    print(json.dumps(result, indent=2))
