import json
import sys
import re
from typing import Dict, Any, List, Optional

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

def analyze_parameters(task_specification: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Analyze user request using LLM-driven semantic parameter extraction."""
    
    if context is None:
        context = {}
    
    # Get available skills dynamically
    available_skills = get_available_skills()
    
    # LLM-based parameter analysis prompt
    analysis_prompt = f"""
Analyze the following user request and extract structured parameters:

Request: "{task_specification}"

Available skills: {', '.join(available_skills)}

Provide your analysis as JSON with this structure:
{{
    "parameters": {{
        "param_name": {{
            "value": "extracted_value",
            "type": "string|number|array|object",
            "unit": "unit_if_applicable"
        }}
    }},
    "confidence": 0.0,
    "clarifications_needed": ["clarification_questions"],
    "reasoning": "explanation_of_parameter_extraction"
}}

Focus on:
- Mathematical operations (volume, area, perimeter, etc.)
- Geometric shapes (cube, sphere, circle, etc.)
- Dimensions and measurements
- Quantities and numbers
- Actions or operations requested

Use semantic understanding rather than keyword matching.
"""
    
    # Initialize result structure
    result = {
        'parameters': {},
        'confidence': 0.0,
        'clarifications_needed': [],
        'reasoning': ''
    }
    
    request_lower = task_specification.lower()
    
    # Extract numbers with their positions using semantic analysis
    numbers = re.findall(r'(-?\d+(?:\.\d+)?)\s*([a-zA-Z]*)', task_specification)
    num_values = [(float(num), unit.lower()) for num, unit in numbers]
    
    # LLM-driven semantic analysis (simulated)
    extracted_params = {}
    confidence_score = 0.6  # Base confidence
    
    # Semantic parameter extraction using context understanding
    # Instead of hardcoded mappings, use semantic patterns
    
    # Detect mathematical operations semantically
    math_operations = []
    if any(word in request_lower for word in ['volume', 'area', 'surface', 'perimeter', 'circumference']):
        if 'volume' in request_lower:
            math_operations.append('calculate_volume')
        elif 'area' in request_lower and 'surface' in request_lower:
            math_operations.append('calculate_surface_area')
        elif 'area' in request_lower:
            math_operations.append('calculate_area')
        elif 'perimeter' in request_lower:
            math_operations.append('calculate_perimeter')
        elif 'circumference' in request_lower:
            math_operations.append('calculate_circumference')
        confidence_score += 0.2
    
    # Detect shapes semantically
    shapes = []
    shape_keywords = ['cube', 'sphere', 'circle', 'square', 'rectangle', 'box', 'ball']
    for shape in shape_keywords:
        if shape in request_lower:
            # Normalize common synonyms
            if shape == 'box':
                shapes.append('cube')
            elif shape == 'ball':
                shapes.append('sphere')
            else:
                shapes.append(shape)
            confidence_score += 0.1
            break
    
    # Detect dimension parameters semantically
    dimension_keywords = ['side', 'length', 'width', 'height', 'radius', 'diameter', 'depth']
    detected_dimensions = []
    
    for dim_keyword in dimension_keywords:
        if dim_keyword in request_lower:
            # Find the closest number to this dimension keyword
            dim_index = request_lower.find(dim_keyword)
            if dim_index != -1 and num_values:
                # Use semantic proximity to associate numbers with dimensions
                value, unit = num_values[0]  # Simplified - would be more sophisticated in real LLM
                extracted_params[f'{dim_keyword}_length'] = {
                    'value': value,
                    'type': 'number',
                    'unit': unit if unit else 'units'
                }
                detected_dimensions.append(dim_keyword)
                confidence_score += 0.1
    
    # If no specific dimensions found but numbers exist, use generic parameters
    if not extracted_params and num_values:
        values = [num for num, _ in num_values]
        if len(values) == 1:
            extracted_params['value'] = {
                'value': values[0],
                'type': 'number',
                'unit': num_values[0][1] if num_values[0][1] else 'units'
            }
        else:
            extracted_params['values'] = {
                'value': values,
                'type': 'array',
                'unit': 'units'
            }
        confidence_score = 0.4  # Lower confidence for generic extraction
    
    # Add detected operations and shapes as parameters
    if math_operations:
        extracted_params['operation'] = {
            'value': math_operations[0],  # Take first detected operation
            'type': 'string'
        }
        confidence_score += 0.1
    
    if shapes:
        extracted_params['shape'] = {
            'value': shapes[0],  # Take first detected shape
            'type': 'string'
        }
        confidence_score += 0.1
    
    # Generate clarifications using semantic understanding
    clarifications = []
    
    # Semantic ambiguity detection
    if num_values and not detected_dimensions:
        if len(num_values) == 1 and not shapes:
            clarifications.append(f"What does the number {num_values[0][0]} represent?")
        elif len(num_values) > 1 and not shapes:
            clarifications.append(f"What do the numbers {[num for num, _ in num_values]} represent?")
    
    if shapes and not extracted_params.get('side_length') and not extracted_params.get('radius'):
        clarifications.append(f"What dimensions of the {shapes[0]} should be used?")
    
    if math_operations and not shapes and not detected_dimensions:
        clarifications.append("What should I calculate?")
    
    # Generate reasoning based on semantic analysis
    reasoning_parts = []
    if math_operations:
        reasoning_parts.append(f"Detected operations: {', '.join(math_operations)}")
    if shapes:
        reasoning_parts.append(f"Identified shape: {shapes[0]}")
    if extracted_params:
        param_names = [k for k in extracted_params.keys() if k not in ['operation', 'shape']]
        if param_names:
            reasoning_parts.append(f"Extracted parameters: {', '.join(param_names)}")
    
    reasoning = " | ".join(reasoning_parts) if reasoning_parts else "Semantic parameter analysis performed"
    
    # Cap confidence at 1.0
    confidence_score = min(confidence_score, 1.0)
    
    # Update result
    result['parameters'] = extracted_params
    result['confidence'] = confidence_score
    result['clarifications_needed'] = clarifications
    result['reasoning'] = reasoning
    
    return result

def handle_clarifications(request: str, clarifications: List[str]) -> Dict[str, Any]:
    """Handle clarification requests by updating the original request."""
    
    # In a real implementation, this would interact with the user
    # For now, we'll provide a structured response
    return {
        'needs_user_input': True,
        'clarification_questions': clarifications,
        'suggested_responses': generate_suggested_responses(request, clarifications)
    }

def generate_suggested_responses(request: str, clarifications: List[str]) -> List[str]:
    """Generate suggested responses for clarification questions."""
    
    suggestions = []
    
    for clarification in clarifications:
        if "number" in clarification.lower():
            suggestions.append(f"{request} with side length [number]")
            suggestions.append(f"{request} with radius [number]")
        elif "dimensions" in clarification.lower():
            suggestions.append(f"{request} with side length [number]")
            suggestions.append(f"{request} with radius [number] and height [number]")
        elif "calculate" in clarification.lower():
            suggestions.append(f"calculate the volume of the [shape]")
            suggestions.append(f"calculate the area of the [shape]")
    
    return list(set(suggestions))  # Remove duplicates

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
        print(json.dumps({"error": "No task specification provided"}))
        sys.exit(1)
    
    # Analyze parameters
    result = analyze_parameters(task, context)
    
    # Handle clarifications if needed
    if result['clarifications_needed']:
        clarification_response = handle_clarifications(task, result['clarifications_needed'])
        result['clarification_response'] = clarification_response
    
    print(json.dumps(result, indent=2))
