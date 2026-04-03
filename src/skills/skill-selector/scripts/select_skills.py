import json
import sys
from typing import Dict, Any, List, Optional

def get_available_skills():
    """Get available skills from the skills engine hook."""
    try:
        # This would be injected by the SkillsEngine in real implementation
        available_skills = globals().get('available_skills', 
            ['python-coding', 'data-analysis', 'research', 'quality-review', 'task-planning', 'execution-analyzer', 'knowledge-manager'])
        
        # Debug logging
        print(f"DEBUG: available_skills from globals: {available_skills}")
        print(f"DEBUG: globals keys: {list(globals().keys())}")
        
        return available_skills
    except Exception as e:
        print(f"DEBUG: Exception in get_available_skills: {e}")
        # Fallback to basic skills if hook not available
        return ['python-coding', 'data-analysis', 'research', 'quality-review']

def select_skills(task_specification: str, available_skills: List[str] = None, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Select optimal skills using LLM-driven semantic analysis."""
    
    # Get available skills dynamically if not provided
    if available_skills is None:
        available_skills = get_available_skills()
    
    if context is None:
        context = {}
    
    task_lower = task_specification.lower()
    
    # LLM-based skill selection prompt
    selection_prompt = f"""
Analyze the following task and select optimal skills:

Task: "{task_specification}"
Available skills: {', '.join(available_skills)}

Provide your analysis as JSON with this structure:
{{
    "selected_skills": [
        {{
            "skill": "skill_name",
            "confidence": 0.0,
            "reasoning": "why this skill was selected"
        }}
    ],
    "execution_plan": "skill1 -> skill2 -> skill3",
    "confidence": 0.0,
    "reasoning": "overall reasoning for skill selection"
}}

Consider:
- Task requirements and complexity
- Skill capabilities and compatibility
- Execution order and dependencies
- Only use skills from the available skills list
"""
    
    # Initialize result
    result = {
        'selected_skills': [],
        'execution_plan': '',
        'confidence': 0.0,
        'reasoning': ''
    }
    
    # LLM-driven semantic skill analysis (simulated)
    skill_scores = []
    
    # Semantic analysis for each available skill
    for skill in available_skills:
        score = 0.5  # Base confidence
        reasoning_parts = []
        
        # Semantic skill matching using context understanding
        if skill == 'python-coding':
            if any(word in task_lower for word in ['code', 'python', 'program', 'script', 'function', 'calculate', 'compute', 'implement']):
                score += 0.3
                reasoning_parts.append('requires programming')
            if any(word in task_lower for word in ['calculate', 'compute', 'multiply', 'divide', 'add']):
                score += 0.2
                reasoning_parts.append('mathematical computation')
                
        elif skill == 'data-analysis':
            if any(word in task_lower for word in ['data', 'analyze', 'dataset', 'statistics', 'chart', 'graph', 'visualization']):
                score += 0.4
                reasoning_parts.append('data processing required')
            if any(word in task_lower for word in ['analyze', 'statistics', 'dataset']):
                score += 0.2
                reasoning_parts.append('statistical analysis')
                
        elif skill == 'research':
            # Enhanced research detection for factual questions
            research_keywords = ['research', 'find', 'search', 'investigate', 'lookup', 'information', 
                               'what is', 'what are', 'difference between', 'compare', 'versus', 'vs',
                               'how much', 'how many', 'when did', 'where is', 'who is', 'why does']
            question_patterns = ['what is the', 'what are the', 'difference between', 'how much', 
                               'how many', 'compare', 'versus', 'vs']
            
            print(f"DEBUG: Research skill analysis for task: '{task_lower}'")
            
            # Check for question patterns
            pattern_matches = [pattern for pattern in question_patterns if pattern in task_lower]
            if pattern_matches:
                score += 0.5
                reasoning_parts.append('factual question detected')
                print(f"DEBUG: Question patterns matched: {pattern_matches}")
            
            # Check for research keywords
            keyword_matches = [word for word in research_keywords if word in task_lower]
            if keyword_matches:
                score += 0.3
                reasoning_parts.append('information gathering required')
                print(f"DEBUG: Research keywords matched: {keyword_matches[:5]}")  # Show first 5
            
            # Specific factual question indicators
            if any(word in task_lower for word in ['weight', 'height', 'size', 'cost', 'price', 'age']):
                score += 0.2
                reasoning_parts.append('quantitative factual question')
                print(f"DEBUG: Factual indicators detected")
                
            # General knowledge questions
            if task_lower.startswith('what') or task_lower.startswith('how') or task_lower.startswith('when'):
                score += 0.2
                reasoning_parts.append('general knowledge question')
                print(f"DEBUG: General knowledge question pattern detected")
            
            print(f"DEBUG: Final research score: {score}")
                
        elif skill == 'quality-review':
            if any(word in task_lower for word in ['review', 'check', 'validate', 'test', 'quality', 'verify']):
                score += 0.3
                reasoning_parts.append('quality assurance needed')
            if any(word in task_lower for word in ['complex', 'multiple', 'important']):
                score += 0.1
                reasoning_parts.append('complex task requires review')
                
        elif skill == 'task-planning':
            if any(word in task_lower for word in ['plan', 'complex', 'multiple', 'steps', 'breakdown', 'organize']):
                score += 0.4
                reasoning_parts.append('complex task requires planning')
            if any(word in task_lower for word in ['multiple', 'several', 'various']):
                score += 0.2
                reasoning_parts.append('multi-step task')
                
        elif skill == 'execution-analyzer':
            if any(word in task_lower for word in ['analyze', 'debug', 'error', 'problem', 'issue', 'troubleshoot']):
                score += 0.3
                reasoning_parts.append('analysis or debugging required')
            if any(word in task_lower for word in ['performance', 'optimize', 'improve']):
                score += 0.2
                reasoning_parts.append('performance analysis')
        
        elif skill == 'knowledge-manager':
            # Detect when user wants to provide information or manage knowledge
            knowledge_keywords = ['provide information', 'here is the data', 'markdown content', 'knowledge base', 
                                'what information do you need', 'what data', 'store information', 'add knowledge']
            if any(word in task_lower for word in knowledge_keywords):
                score += 0.5
                reasoning_parts.append('knowledge management requested')
            
            # Detect when knowledge enhancement might be needed
            if any(word in task_lower for word in ['enhance', 'improve knowledge', 'better answer', 'more information']):
                score += 0.3
                reasoning_parts.append('knowledge enhancement needed')
        
        # Contextual adjustments
        if context.get('previous_success', {}).get(skill, 0) > 0:
            score += 0.1  # Boost for previous success
        
        # Cap at 1.0
        score = min(score, 1.0)
        
        if score > 0.5:  # Only include skills with meaningful confidence
            skill_scores.append({
                'skill': skill,
                'confidence': score,
                'reasoning': '; '.join(reasoning_parts) if reasoning_parts else 'general applicability'
            })
    
    # Sort by confidence
    skill_scores.sort(key=lambda x: x['confidence'], reverse=True)
    
    # Determine task complexity for additional skill selection
    task_complexity = 'simple'
    if any(word in task_lower for word in ['complex', 'multiple', 'several', 'various', 'steps']):
        task_complexity = 'complex'
    elif any(word in task_lower for word in ['analyze', 'process', 'calculate', 'implement']):
        task_complexity = 'moderate'
    
    # Add planning skill for complex tasks if not already selected
    if task_complexity == 'complex' and 'task-planning' in available_skills:
        if not any(s['skill'] == 'task-planning' for s in skill_scores):
            skill_scores.insert(0, {
                'skill': 'task-planning',
                'confidence': 0.8,
                'reasoning': 'complex task requires planning'
            })
    
    # Add quality review for complex tasks if available
    if task_complexity == 'complex' and 'quality-review' in available_skills:
        if not any(s['skill'] == 'quality-review' for s in skill_scores):
            skill_scores.append({
                'skill': 'quality-review',
                'confidence': 0.6,
                'reasoning': 'complex task benefits from quality review'
            })
    
    # Limit to top skills (max 4 for efficiency)
    selected_skills = skill_scores[:4]
    
    print(f"DEBUG: Final skill_scores: {skill_scores}")
    print(f"DEBUG: Selected skills: {selected_skills}")
    print(f"DEBUG: Available skills were: {available_skills}")
    
    # Generate execution plan
    skill_order = [s['skill'] for s in selected_skills]
    execution_plan = ' -> '.join(skill_order)
    
    # Calculate overall confidence
    if selected_skills:
        overall_confidence = sum(s['confidence'] for s in selected_skills) / len(selected_skills)
    else:
        overall_confidence = 0.3  # Low confidence if no skills selected
        # Fallback to first available skill
        if available_skills:
            selected_skills = [{
                'skill': available_skills[0],
                'confidence': 0.3,
                'reasoning': 'fallback skill for unclear task'
            }]
            execution_plan = available_skills[0]
        else:
            # No available skills at all
            selected_skills = [{
                'skill': 'python-coding',
                'confidence': 0.1,
                'reasoning': 'no skills available, using default'
            }]
            execution_plan = 'python-coding'
    
    # Generate reasoning
    if len(selected_skills) == 1:
        reasoning = f"Task requires {selected_skills[0]['skill']}: {selected_skills[0]['reasoning']}"
    else:
        primary_skill = selected_skills[0]['skill']
        reasoning_parts = [f"Primary skill: {primary_skill} ({selected_skills[0]['reasoning']})"]
        
        if len(selected_skills) > 1:
            supporting_skills = [s['skill'] for s in selected_skills[1:]]
            reasoning_parts.append(f"Supporting skills: {', '.join(supporting_skills)}")
        
        if task_complexity == 'complex':
            reasoning_parts.append("Complex task requiring multiple skills")
        
        reasoning = '; '.join(reasoning_parts)
    
    # Update result
    result['selected_skills'] = selected_skills
    result['execution_plan'] = execution_plan
    result['confidence'] = overall_confidence
    result['reasoning'] = reasoning
    
    return result

def generate_skill_combinations(task: str, skills: List[str]) -> List[List[str]]:
    """Generate possible skill combinations for the task."""
    
    # Simple heuristic combinations based on task type
    task_lower = task.lower()
    
    if 'data' in task_lower and 'analyze' in task_lower:
        return [['data-analysis', 'python-coding'], ['python-coding', 'data-analysis']]
    
    if 'research' in task_lower or 'find' in task_lower:
        return [['research', 'python-coding'], ['research']]
    
    if 'complex' in task_lower or 'multiple' in task_lower:
        return [['task-planning', 'python-coding', 'quality-review']]
    
    # Default combinations
    return [['python-coding'], ['python-coding', 'quality-review']]

if __name__ == "__main__":
    # Get input from globals or command line
    task = globals().get('task', '')
    available_skills = globals().get('available_skills', [])
    context = globals().get('context', {})
    
    print(f"DEBUG: Main function - task: {task}")
    print(f"DEBUG: Main function - available_skills: {available_skills}")
    print(f"DEBUG: Main function - context: {context}")
    
    if not task and len(sys.argv) > 1:
        task = sys.argv[1]
        if len(sys.argv) > 2:
            try:
                available_skills = json.loads(sys.argv[2])
            except json.JSONDecodeError:
                available_skills = []
        if len(sys.argv) > 3:
            try:
                context = json.loads(sys.argv[3])
            except json.JSONDecodeError:
                context = {}
    
    if not task:
        print(json.dumps({"error": "No task specification provided"}))
        sys.exit(1)
    
    # Select skills
    result = select_skills(task, available_skills, context)
    
    print(f"DEBUG: Final result: {result}")
    print(json.dumps(result, indent=2))
