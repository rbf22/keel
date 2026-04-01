---
name: task-planning
description: Break down complex tasks into structured plans and coordinate multi-step workflows. Use when you need to plan complex projects, decompose tasks, or create execution strategies.
license: Apache-2.0
metadata:
  author: keel-system
  version: "1.0"
---

# Task Planning Skill

## When to use this skill

Use this skill when you need to:
- Break down complex tasks into manageable steps
- Create structured execution plans
- Coordinate multi-skill workflows
- Estimate task complexity and requirements
- Plan resource allocation
- Design execution strategies

## Planning Process

### Step 1: Task Analysis
- Understand the overall objective
- Identify constraints and requirements
- Assess task complexity and scope
- Determine necessary skills and resources

### Step 2: Decomposition
- Break task into logical sub-tasks
- Identify dependencies between steps
- Sequence tasks appropriately
- Define clear objectives for each step

### Step 3: Resource Planning
- Determine required skills for each step
- Estimate time and resource needs
- Identify potential bottlenecks
- Plan contingency strategies

### Step 4: Plan Creation
- Create detailed execution plan
- Define success criteria
- Establish checkpoints and milestones
- Document the complete strategy

## Task Analysis Framework

### Complexity Assessment
```python
def assess_task_complexity(task_description):
    """Assess the complexity of a given task."""
    complexity_factors = {
        'scope': analyze_scope(task_description),
        'dependencies': count_dependencies(task_description),
        'specialized_skills': identify_specialized_requirements(task_description),
        'ambiguity': measure_ambiguity(task_description),
        'estimated_steps': estimate_step_count(task_description)
    }
    
    # Calculate overall complexity score
    score = (
        complexity_factors['scope'] * 0.3 +
        complexity_factors['dependencies'] * 0.2 +
        complexity_factors['specialized_skills'] * 0.25 +
        complexity_factors['ambiguity'] * 0.15 +
        complexity_factors['estimated_steps'] * 0.1
    )
    
    if score > 0.7:
        complexity_level = 'high'
    elif score > 0.4:
        complexity_level = 'medium'
    else:
        complexity_level = 'low'
    
    log(f"Task complexity assessed as: {complexity_level} (score: {score:.2f})")
    return {
        'level': complexity_level,
        'score': score,
        'factors': complexity_factors
    }

def analyze_scope(task_description):
    """Analyze the scope of the task."""
    scope_indicators = [
        'analyze', 'create', 'build', 'implement', 'design',
        'multiple', 'various', 'comprehensive', 'complete', 'full'
    ]
    
    scope_score = sum(1 for indicator in scope_indicators 
                     if indicator in task_description.lower())
    
    return min(scope_score / 5, 1.0)  # Normalize to 0-1

def identify_specialized_requirements(task_description):
    """Identify specialized skill requirements."""
    specialized_domains = {
        'data': ['data', 'dataset', 'analysis', 'statistics', 'pandas'],
        'web': ['web', 'website', 'fetch', 'scrape', 'api'],
        'code': ['code', 'programming', 'python', 'script', 'algorithm'],
        'research': ['research', 'investigate', 'find', 'search', 'study']
    }
    
    required_domains = []
    for domain, keywords in specialized_domains.items():
        if any(keyword in task_description.lower() for keyword in keywords):
            required_domains.append(domain)
    
    return len(required_domains) / 4  # Normalize to 0-1
```

### Task Decomposition
```python
def decompose_task(task_description, complexity_assessment):
    """Decompose a complex task into manageable sub-tasks."""
    log("Starting task decomposition...")
    
    # Identify main components
    main_components = identify_main_components(task_description)
    
    # Create sub-tasks based on complexity
    if complexity_assessment['level'] == 'high':
        sub_tasks = create_detailed_plan(main_components)
    elif complexity_assessment['level'] == 'medium':
        sub_tasks = create_moderate_plan(main_components)
    else:
        sub_tasks = create_simple_plan(main_components)
    
    # Sequence the sub-tasks
    sequenced_tasks = sequence_tasks(sub_tasks)
    
    log(f"Task decomposed into {len(sequenced_tasks)} sub-tasks")
    return sequenced_tasks

def identify_main_components(task_description):
    """Identify the main components of a task."""
    components = []
    
    # Research component
    if any(word in task_description.lower() 
           for word in ['research', 'find', 'investigate', 'analyze']):
        components.append({
            'type': 'research',
            'description': 'Gather necessary information and data',
            'skills_needed': ['research']
        })
    
    # Data analysis component
    if any(word in task_description.lower() 
           for word in ['data', 'analyze', 'statistics', 'calculate']):
        components.append({
            'type': 'data-analysis',
            'description': 'Process and analyze data',
            'skills_needed': ['data-analysis', 'python-coding']
        })
    
    # Coding component
    if any(word in task_description.lower() 
           for word in ['code', 'program', 'script', 'implement']):
        components.append({
            'type': 'coding',
            'description': 'Write and implement code',
            'skills_needed': ['python-coding', 'quality-review']
        })
    
    # Review component
    if any(word in task_description.lower() 
           for word in ['review', 'check', 'validate', 'verify']):
        components.append({
            'type': 'review',
            'description': 'Review and validate results',
            'skills_needed': ['quality-review', 'execution-analyzer']
        })
    
    return components
```

## Plan Creation Templates

### Detailed Plan Structure
```python
def create_detailed_plan(components):
    """Create a detailed plan for complex tasks."""
    plan = []
    
    # Phase 1: Initial Analysis
    plan.append({
        'phase': 1,
        'step': 1,
        'title': 'Requirements Analysis',
        'description': 'Analyze task requirements and constraints',
        'skills': ['research'],
        'estimated_time': '5-10 minutes',
        'deliverables': 'Requirements document',
        'dependencies': [],
        'success_criteria': 'All requirements clearly identified'
    })
    
    # Phase 2: Research and Data Gathering
    if any(c['type'] == 'research' for c in components):
        plan.append({
            'phase': 2,
            'step': len(plan) + 1,
            'title': 'Research and Data Gathering',
            'description': 'Gather all necessary information and data',
            'skills': ['research'],
            'estimated_time': '10-20 minutes',
            'deliverables': 'Research findings and data',
            'dependencies': ['Requirements Analysis'],
            'success_criteria': 'All required information collected'
        })
    
    # Phase 3: Implementation
    implementation_components = [c for c in components 
                               if c['type'] in ['coding', 'data-analysis']]
    for component in implementation_components:
        plan.append({
            'phase': 3,
            'step': len(plan) + 1,
            'title': f"{component['type'].title()} Implementation",
            'description': component['description'],
            'skills': component['skills_needed'],
            'estimated_time': '15-30 minutes',
            'deliverables': f"{component['type']} results",
            'dependencies': ['Research and Data Gathering'] if 'Research and Data Gathering' in [p['title'] for p in plan] else [],
            'success_criteria': f"{component['type']} completed successfully"
        })
    
    # Phase 4: Review and Validation
    plan.append({
        'phase': 4,
        'step': len(plan) + 1,
        'title': 'Quality Review and Validation',
        'description': 'Review all work and validate results',
        'skills': ['quality-review', 'execution-analyzer'],
        'estimated_time': '5-15 minutes',
        'deliverables': 'Validation report',
        'dependencies': [p['title'] for p in plan if p['phase'] == 3],
        'success_criteria': 'All work validated and approved'
    })
    
    # Phase 5: Final Integration
    plan.append({
        'phase': 5,
        'step': len(plan) + 1,
        'title': 'Final Integration and Documentation',
        'description': 'Integrate all components and document results',
        'skills': ['python-coding'],
        'estimated_time': '5-10 minutes',
        'deliverables': 'Final integrated solution',
        'dependencies': ['Quality Review and Validation'],
        'success_criteria': 'Complete solution delivered'
    })
    
    return plan
```

### Moderate Plan Structure
```python
def create_moderate_plan(components):
    """Create a moderate plan for medium complexity tasks."""
    plan = []
    
    # Step 1: Analysis and Planning
    plan.append({
        'step': 1,
        'title': 'Task Analysis',
        'description': 'Understand requirements and plan approach',
        'skills': ['research'],
        'estimated_time': '5 minutes',
        'deliverables': 'Clear task understanding',
        'success_criteria': 'Approach defined'
    })
    
    # Step 2: Implementation
    for component in components:
        plan.append({
            'step': len(plan) + 1,
            'title': component['type'].title(),
            'description': component['description'],
            'skills': component['skills_needed'],
            'estimated_time': '10-20 minutes',
            'deliverables': f"{component['type']} output",
            'success_criteria': f"{component['type']} completed"
        })
    
    # Step 3: Review
    plan.append({
        'step': len(plan) + 1,
        'title': 'Review and Finalize',
        'description': 'Review work and finalize results',
        'skills': ['quality-review'],
        'estimated_time': '5 minutes',
        'deliverables': 'Final results',
        'success_criteria': 'Task completed successfully'
    })
    
    return plan
```

### Simple Plan Structure
```python
def create_simple_plan(components):
    """Create a simple plan for straightforward tasks."""
    if not components:
        return [{
            'step': 1,
            'title': 'Direct Execution',
            'description': 'Execute the task directly',
            'skills': ['python-coding'],
            'estimated_time': '5-15 minutes',
            'success_criteria': 'Task completed'
        }]
    
    plan = []
    for component in components:
        plan.append({
            'step': len(plan) + 1,
            'title': component['type'].title(),
            'description': component['description'],
            'skills': component['skills_needed'],
            'estimated_time': '5-15 minutes',
            'success_criteria': f"{component['type']} completed"
        })
    
    return plan
```

## Plan Sequencing and Dependencies

### Task Sequencing
```python
def sequence_tasks(tasks):
    """Sequence tasks based on dependencies and logical flow."""
    sequenced = []
    remaining = tasks.copy()
    
    while remaining:
        # Find tasks with no unmet dependencies
        ready_tasks = [task for task in remaining 
                      if all(dep in [t['title'] for t in sequenced] 
                            for dep in task.get('dependencies', []))]
        
        if not ready_tasks:
            # If no ready tasks, pick one with minimal dependencies
            ready_tasks = [min(remaining, 
                             key=lambda t: len(t.get('dependencies', [])))]
        
        # Add the first ready task to the sequence
        next_task = ready_tasks[0]
        sequenced.append(next_task)
        remaining.remove(next_task)
    
    return sequenced
```

### Dependency Management
```python
def validate_dependencies(plan):
    """Validate that all dependencies are properly defined."""
    all_tasks = [task['title'] for task in plan]
    validation_issues = []
    
    for task in plan:
        for dependency in task.get('dependencies', []):
            if dependency not in all_tasks:
                validation_issues.append(
                    f"Task '{task['title']}' depends on non-existent task '{dependency}'"
                )
    
    # Check for circular dependencies
    for i, task in enumerate(plan):
        for dependency in task.get('dependencies', []):
            dep_index = next((j for j, t in enumerate(plan) 
                            if t['title'] == dependency), -1)
            if dep_index > i:
                validation_issues.append(
                    f"Circular dependency detected: '{task['title']}' depends on '{dependency}'"
                )
    
    return validation_issues
```

## Plan Documentation

### Plan Output Format
```python
def format_plan(plan, task_description):
    """Format the execution plan for presentation."""
    formatted_plan = []
    
    formatted_plan.append("# EXECUTION PLAN")
    formatted_plan.append(f"## Task: {task_description}")
    formatted_plan.append(f"## Total Steps: {len(plan)}")
    
    # Estimate total time
    total_time_range = estimate_total_time(plan)
    formatted_plan.append(f"## Estimated Time: {total_time_range}")
    
    formatted_plan.append("")
    formatted_plan.append("## Detailed Steps:")
    formatted_plan.append("")
    
    for task in plan:
        formatted_plan.append(f"### Step {task['step']}: {task['title']}")
        formatted_plan.append(f"**Description**: {task['description']}")
        formatted_plan.append(f"**Skills Required**: {', '.join(task['skills'])}")
        formatted_plan.append(f"**Estimated Time**: {task['estimated_time']}")
        formatted_plan.append(f"**Success Criteria**: {task['success_criteria']}")
        
        if task.get('dependencies'):
            formatted_plan.append(f"**Dependencies**: {', '.join(task['dependencies'])}")
        
        formatted_plan.append("")
    
    return "\n".join(formatted_plan)

def estimate_total_time(plan):
    """Estimate total execution time for the plan."""
    time_ranges = []
    
    for task in plan:
        time_str = task['estimated_time']
        if '-' in time_str:
            # Handle range like "5-10 minutes"
            min_time, max_time = time_str.replace(' minutes', '').split('-')
            time_ranges.append((int(min_time), int(max_time)))
        else:
            # Handle single time like "5 minutes"
            time_val = int(time_str.replace(' minutes', ''))
            time_ranges.append((time_val, time_val))
    
    total_min = sum(t[0] for t in time_ranges)
    total_max = sum(t[1] for t in time_ranges)
    
    return f"{total_min}-{total_max} minutes"
```

## Specialized Planning Templates

### Data Analysis Project Plan
```python
def create_data_analysis_plan(task_description):
    """Create a specialized plan for data analysis projects."""
    plan = [
        {
            'step': 1,
            'title': 'Data Understanding',
            'description': 'Understand the data structure and requirements',
            'skills': ['research'],
            'estimated_time': '5-10 minutes',
            'success_criteria': 'Data requirements clearly defined'
        },
        {
            'step': 2,
            'title': 'Data Loading and Cleaning',
            'description': 'Load data and perform cleaning operations',
            'skills': ['python-coding', 'data-analysis'],
            'estimated_time': '10-20 minutes',
            'success_criteria': 'Clean data ready for analysis'
        },
        {
            'step': 3,
            'title': 'Exploratory Analysis',
            'description': 'Perform initial data exploration and visualization',
            'skills': ['data-analysis'],
            'estimated_time': '15-25 minutes',
            'success_criteria': 'Initial insights generated'
        },
        {
            'step': 4,
            'title': 'Advanced Analysis',
            'description': 'Perform detailed statistical analysis',
            'skills': ['data-analysis', 'python-coding'],
            'estimated_time': '20-30 minutes',
            'success_criteria': 'Detailed analysis completed'
        },
        {
            'step': 5,
            'title': 'Results Validation',
            'description': 'Validate analysis results and conclusions',
            'skills': ['quality-review', 'execution-analyzer'],
            'estimated_time': '5-10 minutes',
            'success_criteria': 'Results validated and accurate'
        }
    ]
    
    return plan
```

### Research Project Plan
```python
def create_research_plan(task_description):
    """Create a specialized plan for research projects."""
    plan = [
        {
            'step': 1,
            'title': 'Research Planning',
            'description': 'Define research questions and methodology',
            'skills': ['research'],
            'estimated_time': '5-10 minutes',
            'success_criteria': 'Research plan defined'
        },
        {
            'step': 2,
            'title': 'Information Gathering',
            'description': 'Collect information from multiple sources',
            'skills': ['research'],
            'estimated_time': '15-30 minutes',
            'success_criteria': 'Comprehensive information collected'
        },
        {
            'step': 3,
            'title': 'Information Analysis',
            'description': 'Analyze and synthesize collected information',
            'skills': ['data-analysis'],
            'estimated_time': '10-20 minutes',
            'success_criteria': 'Information properly analyzed'
        },
        {
            'step': 4,
            'title': 'Findings Documentation',
            'description': 'Document research findings and conclusions',
            'skills': ['python-coding'],
            'estimated_time': '10-15 minutes',
            'success_criteria': 'Findings clearly documented'
        }
    ]
    
    return plan
```

## Tools Available

- `vfs_write`: Save execution plans
- `vfs_read`: Access existing plans and templates
- `log`: Document planning process

## Best Practices

1. **Be realistic** - Provide accurate time and resource estimates
2. **Be specific** - Define clear success criteria for each step
3. **Consider dependencies** - Properly sequence tasks based on dependencies
4. **Plan for contingencies** - Include buffer time and alternative approaches
5. **Validate plans** - Ensure plans are logical and achievable

## Example Usage

```python
# Plan a complex data analysis task
task = "Analyze customer sales data to identify trends and provide recommendations for improving sales performance"

# Assess complexity
complexity = assess_task_complexity(task)

# Create plan
plan = decompose_task(task, complexity)

# Validate and format
issues = validate_dependencies(plan)
if issues:
    log(f"Plan validation issues: {issues}")

formatted_plan = format_plan(plan, task)
print(formatted_plan)

# Save the plan
# Use: CALL: vfs_write ARGUMENTS: {"path": "keel://plans/analysis-plan.md", "content": formatted_plan}
```
