import json
import ast
import sys

def analyze_code_quality(code):
    """Analyze Python code for quality and security."""
    issues = {
        'syntax_errors': [],
        'quality_suggestions': [],
        'security_issues': []
    }
    
    # Syntax check
    try:
        ast.parse(code)
    except SyntaxError as e:
        issues['syntax_errors'].append(f"Syntax error: {e}")
        return issues
    
    # Security checks
    dangerous_patterns = {
        'os.system': 'Use subprocess instead of os.system',
        'eval(': 'Avoid eval() - use safer alternatives',
        'exec(': 'Avoid eval() - use safer alternatives',
        '__import__': 'Avoid dynamic imports',
        'input(': 'Be careful with input() in production',
        'open(': 'Add error handling for file operations'
    }
    
    for pattern, message in dangerous_patterns.items():
        if pattern in code:
            issues['security_issues'].append(f"Security concern: {message}")
    
    # Quality checks
    if len(code) > 100 and '"""' not in code and "'''" not in code:
        issues['quality_suggestions'].append("Add docstrings for better documentation")
    
    if 'try:' not in code and ('open(' in code or 'int(' in code or 'float(' in code):
        issues['quality_suggestions'].append("Consider adding error handling")
    
    return issues

def analyze_dependencies(dependencies):
    """Analyze dependency requirements."""
    issues = []
    safe_deps = ['pandas', 'numpy', 'requests', 'matplotlib', 'seaborn', 'scipy', 'sklearn']
    for dep in dependencies:
        if dep not in safe_deps:
            issues.append(f"Uncommon dependency '{dep}' - ensure it's necessary")
    return issues

def review_code_artifact(artifact_json):
    """Review a code artifact and provide structured feedback."""
    # Extract JSON
    json_start = artifact_json.find('{')
    json_end = artifact_json.rfind('}')
    
    if json_start != -1 and json_end != -1 and json_end > json_start:
        json_str = artifact_json[json_start:json_end + 1]
    else:
        json_str = artifact_json
    
    try:
        artifact = json.loads(json_str)
    except json.JSONDecodeError:
        return {
            'approved': False,
            'recommendation': 'rejected',
            'feedback': "Invalid JSON format for artifact",
            'issues': ["Invalid JSON format for artifact"]
        }
    
    review = {
        'artifact_id': artifact.get('id', 'unknown'),
        'artifact_name': artifact.get('name', 'unknown'),
        'approved': False,
        'issues': [],
        'suggestions': [],
        'security_concerns': [],
        'feedback': '',
        'recommendation': 'needs_fixes'
    }
    
    # Required fields check
    required_fields = ['name', 'description', 'function', 'usage']
    for field in required_fields:
        if field not in artifact or not artifact[field]:
            review['issues'].append(f"Missing required field: {field}")
    
    # Code quality checks
    if 'function' in artifact:
        code_issues = analyze_code_quality(artifact['function'])
        review['issues'].extend(code_issues['syntax_errors'])
        review['suggestions'].extend(code_issues['quality_suggestions'])
        review['security_concerns'].extend(code_issues['security_issues'])
    
    # Dependencies check
    if 'dependencies' in artifact:
        dep_issues = analyze_dependencies(artifact['dependencies'])
        review['issues'].extend(dep_issues)
    
    # Final decision
    if not review['issues'] and not review['security_concerns']:
        review['approved'] = True
        review['recommendation'] = 'approved'
        review['feedback'] = f"Code artifact '{artifact['name']}' is ready."
    elif review['security_concerns']:
        review['recommendation'] = 'rejected'
        review['feedback'] = f"Code artifact '{artifact['name']}' has security concerns."
    else:
        review['recommendation'] = 'needs_fixes'
        review['feedback'] = f"Code artifact '{artifact['name']}' needs improvements."
    
    return review

if __name__ == "__main__":
    task = globals().get('task', '')
    if not task and len(sys.argv) > 1:
        task = sys.argv[1]
        
    if not task:
        print(json.dumps({"error": "No artifact to review provided"}))
        sys.exit(1)
        
    result = review_code_artifact(task)
    print(json.dumps(result, indent=2))
