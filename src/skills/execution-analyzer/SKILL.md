---
name: execution-analyzer
description: Analyze execution results and system behavior to provide insights and recommendations. Use when you need deep analysis of skill execution, identify patterns, or understand system performance.
license: Apache-2.0
metadata:
  author: keel-system
  version: "1.0"
---

# Execution Analyzer Skill

## When to use this skill

Use this skill when you need to:
- Analyze skill execution results in depth
- Identify patterns in system behavior
- Understand execution performance
- Diagnose complex issues or failures
- Provide insights on workflow efficiency
- Analyze multi-step task execution

## Analysis Process

### Step 1: Context Gathering
- Review the task and execution context
- Understand the skill that was executed
- Identify expected vs actual outcomes

### Step 2: Result Analysis
- Examine execution outputs and errors
- Analyze performance metrics
- Identify success factors and failure points

### Step 3: Pattern Recognition
- Look for recurring patterns
- Identify workflow bottlenecks
- Detect optimization opportunities

### Step 4: Insight Generation
- Generate actionable insights
- Provide recommendations
- Suggest workflow improvements

## Analysis Framework

### Execution Context Analysis
```python
def analyze_execution_context(task, skill_used, result):
    """Analyze the context of skill execution."""
    analysis = {
        'task_complexity': assess_task_complexity(task),
        'skill_appropriateness': evaluate_skill_choice(skill_used, task),
        'execution_success': determine_success(result),
        'efficiency_metrics': calculate_efficiency(task, result)
    }
    
    log(f"Context analysis: {analysis}")
    return analysis

def assess_task_complexity(task):
    """Assess the complexity of the given task."""
    complexity_indicators = {
        'keywords': len(task.split()),
        'questions': task.count('?') + task.count('how') + task.count('what'),
        'steps': task.count('and') + task.count('then') + task.count('next')
    }
    
    total_score = sum(complexity_indicators.values())
    if total_score > 10:
        return 'high'
    elif total_score > 5:
        return 'medium'
    else:
        return 'low'
```

### Result Quality Assessment
```python
def assess_result_quality(result, expected_outcome=None):
    """Assess the quality of execution results."""
    quality_metrics = {
        'completeness': measure_completeness(result),
        'accuracy': evaluate_accuracy(result, expected_outcome),
        'clarity': assess_clarity(result),
        'actionability': measure_actionability(result)
    }
    
    overall_quality = sum(quality_metrics.values()) / len(quality_metrics)
    
    log(f"Result quality assessment: {overall_quality:.2f}")
    return quality_metrics, overall_quality

def measure_completeness(result):
    """Measure how complete the result is."""
    if not result or len(result.strip()) < 10:
        return 0.2  # Very incomplete
    
    # Check for key components
    components = ['summary', 'details', 'conclusion', 'next_steps']
    found_components = sum(1 for comp in components if comp in result.lower())
    
    return found_components / len(components)

def assess_clarity(result):
    """Assess the clarity of the result."""
    clarity_indicators = {
        'structure': has_clear_structure(result),
        'readability': calculate_readability(result),
        'organization': is_well_organized(result)
    }
    
    return sum(clarity_indicators.values()) / len(clarity_indicators)
```

### Performance Analysis
```python
def analyze_execution_performance(execution_data):
    """Analyze performance metrics of skill execution."""
    performance = {
        'execution_time': execution_data.get('duration', 0),
        'resource_usage': execution_data.get('memory_usage', 0),
        'error_rate': calculate_error_rate(execution_data),
        'success_rate': calculate_success_rate(execution_data)
    }
    
    # Identify performance issues
    issues = []
    if performance['execution_time'] > 30:  # seconds
        issues.append("Slow execution detected")
    
    if performance['error_rate'] > 0.1:
        issues.append("High error rate detected")
    
    log(f"Performance analysis: {performance}")
    return performance, issues
```

## Pattern Recognition

### Workflow Pattern Analysis
```python
def analyze_workflow_patterns(execution_history):
    """Analyze patterns in workflow execution."""
    patterns = {
        'common_sequences': find_common_sequences(execution_history),
        'bottlenecks': identify_bottlenecks(execution_history),
        'failure_points': detect_failure_patterns(execution_history),
        'optimization_opportunities': find_optimization_opportunities(execution_history)
    }
    
    return patterns

def find_common_sequences(execution_history):
    """Find commonly occurring skill sequences."""
    sequences = {}
    
    for i in range(len(execution_history) - 1):
        sequence = f"{execution_history[i]['skill']} -> {execution_history[i+1]['skill']}"
        sequences[sequence] = sequences.get(sequence, 0) + 1
    
    # Sort by frequency
    sorted_sequences = sorted(sequences.items(), key=lambda x: x[1], reverse=True)
    
    log(f"Common sequences: {sorted_sequences[:5]}")
    return sorted_sequences[:5]
```

### Error Pattern Analysis
```python
def analyze_error_patterns(error_history):
    """Analyze patterns in errors and failures."""
    error_patterns = {
        'common_errors': find_common_errors(error_history),
        'error_contexts': analyze_error_contexts(error_history),
        'recovery_patterns': identify_recovery_patterns(error_history)
    }
    
    return error_patterns

def find_common_errors(error_history):
    """Find most common error types."""
    error_types = {}
    
    for error in error_history:
        error_type = categorize_error(error['message'])
        error_types[error_type] = error_types.get(error_type, 0) + 1
    
    return sorted(error_types.items(), key=lambda x: x[1], reverse=True)
```

## Insight Generation

### Strategic Insights
```python
def generate_strategic_insights(analysis_data):
    """Generate strategic insights from analysis."""
    insights = []
    
    # Efficiency insights
    if analysis_data['performance']['execution_time'] > 20:
        insights.append({
            'type': 'efficiency',
            'priority': 'high',
            'message': 'Consider optimizing execution time for better user experience'
        })
    
    # Quality insights
    if analysis_data['quality']['overall'] < 0.7:
        insights.append({
            'type': 'quality',
            'priority': 'medium',
            'message': 'Result quality could be improved with better validation'
        })
    
    # Workflow insights
    if analysis_data['patterns']['bottlenecks']:
        insights.append({
            'type': 'workflow',
            'priority': 'medium',
            'message': f"Workflow bottleneck identified: {analysis_data['patterns']['bottlenecks'][0]}"
        })
    
    return insights
```

### Recommendations Engine
```python
def generate_recommendations(analysis_results):
    """Generate actionable recommendations."""
    recommendations = []
    
    # Performance recommendations
    performance, perf_issues = analysis_results['performance']
    if perf_issues:
        for issue in perf_issues:
            if 'slow' in issue.lower():
                recommendations.append({
                    'category': 'performance',
                    'action': 'Consider breaking down complex tasks into smaller steps',
                    'priority': 'high'
                })
    
    # Quality recommendations
    quality_metrics = analysis_results['quality']
    if quality_metrics['completeness'] < 0.5:
        recommendations.append({
            'category': 'quality',
            'action': 'Ensure results include all required components',
            'priority': 'medium'
        })
    
    # Workflow recommendations
    patterns = analysis_results['patterns']
    if patterns['common_sequences']:
        top_sequence = patterns['common_sequences'][0][0]
        recommendations.append({
            'category': 'workflow',
            'action': f"Consider creating a combined skill for common sequence: {top_sequence}",
            'priority': 'low'
        })
    
    return recommendations
```

## Analysis Templates

### Comprehensive Analysis Report
```python
def generate_analysis_report(task, skill_used, result, execution_data, history=None):
    """Generate comprehensive analysis report."""
    report = []
    
    report.append("=== EXECUTION ANALYSIS REPORT ===")
    report.append(f"Task: {task[:100]}...")
    report.append(f"Skill Used: {skill_used}")
    report.append(f"Execution Time: {execution_data.get('duration', 'N/A')}s")
    
    # Context analysis
    context = analyze_execution_context(task, skill_used, result)
    report.append(f"\nTask Complexity: {context['task_complexity']}")
    report.append(f"Skill Appropriateness: {context['skill_appropriateness']}")
    
    # Quality assessment
    quality_metrics, overall_quality = assess_result_quality(result)
    report.append(f"\nResult Quality: {overall_quality:.2f}/1.00")
    report.append(f"Completeness: {quality_metrics['completeness']:.2f}")
    report.append(f"Clarity: {quality_metrics['clarity']:.2f}")
    
    # Performance analysis
    performance, issues = analyze_execution_performance(execution_data)
    if issues:
        report.append(f"\nPerformance Issues:")
        for issue in issues:
            report.append(f"- {issue}")
    
    # Insights
    insights = generate_strategic_insights({
        'performance': performance,
        'quality': {'overall': overall_quality},
        'patterns': {'bottlenecks': issues}
    })
    
    if insights:
        report.append(f"\nKey Insights:")
        for insight in insights:
            report.append(f"- [{insight['priority'].upper()}] {insight['message']}")
    
    # Recommendations
    recommendations = generate_recommendations({
        'performance': (performance, issues),
        'quality': quality_metrics,
        'patterns': {'common_sequences': []}
    })
    
    if recommendations:
        report.append(f"\nRecommendations:")
        for rec in recommendations:
            report.append(f"- [{rec['priority'].upper()}] {rec['action']}")
    
    return "\n".join(report)
```

### Quick Analysis Summary
```python
def quick_analysis_summary(task, skill, result, execution_time):
    """Generate quick analysis summary."""
    success = determine_success(result)
    quality = assess_result_quality(result)[1]
    
    summary = f"""
Execution Summary:
- Task: {task[:50]}...
- Skill: {skill}
- Success: {'✓' if success else '✗'}
- Quality: {quality:.1f}/1.0
- Time: {execution_time}s
"""
    
    if not success:
        summary += "\n⚠️  Execution failed - review error details"
    elif quality < 0.5:
        summary += "\n⚠️  Low quality output - consider improvement"
    elif execution_time > 15:
        summary += "\n⚠️  Slow execution - consider optimization"
    else:
        summary += "\n✅ Execution successful"
    
    return summary
```

## Specialized Analysis

### Multi-Step Task Analysis
```python
def analyze_multistep_execution(execution_steps):
    """Analyze execution across multiple steps."""
    step_analysis = []
    
    for i, step in enumerate(execution_steps):
        step_analysis.append({
            'step': i + 1,
            'skill': step['skill'],
            'success': determine_success(step['result']),
            'quality': assess_result_quality(step['result'])[1],
            'duration': step.get('duration', 0)
        })
    
    # Overall workflow analysis
    total_time = sum(step['duration'] for step in step_analysis)
    success_rate = sum(1 for step in step_analysis if step['success']) / len(step_analysis)
    avg_quality = sum(step['quality'] for step in step_analysis) / len(step_analysis)
    
    workflow_summary = {
        'total_steps': len(step_analysis),
        'total_time': total_time,
        'success_rate': success_rate,
        'average_quality': avg_quality,
        'step_details': step_analysis
    }
    
    return workflow_summary
```

### Failure Analysis
```python
def analyze_failure(task, skill, error_result, context):
    """Analyze execution failures in depth."""
    failure_analysis = {
        'error_type': categorize_error(error_result),
        'root_cause': identify_root_cause(task, skill, error_result),
        'impact_assessment': assess_failure_impact(task, error_result),
        'recovery_options': suggest_recovery_options(skill, error_result)
    }
    
    return failure_analysis

def suggest_recovery_options(skill, error):
    """Suggest options for recovering from failure."""
    recovery_options = []
    
    if 'syntax' in error.lower():
        recovery_options.append("Review and fix syntax errors")
        recovery_options.append("Use quality-review skill before execution")
    
    if 'permission' in error.lower() or 'access' in error.lower():
        recovery_options.append("Check file permissions and access rights")
        recovery_options.append("Verify resource availability")
    
    if 'timeout' in error.lower():
        recovery_options.append("Break task into smaller steps")
        recovery_options.append("Optimize code for better performance")
    
    return recovery_options
```

## Tools Available

- `vfs_read`: Access execution logs and results
- `vfs_write`: Save analysis reports
- `log`: Document analysis process

## Best Practices

1. **Be objective** - Base analysis on data and metrics
2. **Be constructive** - Provide actionable recommendations
3. **Consider context** - Understand the full execution context
4. **Prioritize insights** - Focus on most important findings
5. **Be specific** - Provide concrete, measurable recommendations

## Example Usage

```python
# Analyze a skill execution
task = "Analyze sales data and provide insights"
skill_used = "data-analysis"
result = "Sales increased by 15% in Q3..."
execution_data = {'duration': 12.5, 'memory_usage': 256}

report = generate_analysis_report(task, skill_used, result, execution_data)
print(report)

# Quick summary for immediate feedback
summary = quick_analysis_summary(task, skill_used, result, 12.5)
print(summary)
```
