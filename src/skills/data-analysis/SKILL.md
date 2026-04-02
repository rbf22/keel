---
name: data-analysis
description: Perform advanced data analysis using pandas and numpy. Use when you need to group, aggregate, filter, sort, clean datasets, calculate statistics, or analyze patterns in data.
license: Apache-2.0
metadata:
  author: keel-system
  version: "1.0"
---

# Data Analysis Skill

## When to use this skill

Use this skill when you need to:
- Analyze structured data (CSV, JSON, tables)
- Calculate statistics and metrics
- Group and aggregate data
- Filter and sort datasets
- Clean and transform data
- Find patterns and correlations
- Create data summaries and reports

## Data Analysis Process

### Step 1: Data Loading and Inspection
- Load data into pandas DataFrame
- Inspect data structure and types
- Check for missing values and anomalies

### Step 2: Data Cleaning
- Handle missing values
- Fix data types
- Remove duplicates
- Address outliers

### Step 3: Analysis and Exploration
- Calculate descriptive statistics
- Group and aggregate data
- Find patterns and correlations
- Create visualizations if needed

### Step 4: Results Interpretation
- Summarize key findings
- Provide insights and recommendations
- Document methodology

## Core Analysis Patterns

## Available Scripts

### 1. `scripts/analyze_dataset.py`
Performs a comprehensive data analysis workflow, including cleaning, descriptive statistics, and correlation analysis.
- **Input**: `data` (JSON array of the dataset)
- **Output**: JSON object with `statistics`, `correlations`, `report`, and `cleaned_shape`.

## Usage Examples

### Analyze a Dataset
```python
# Pass the JSON dataset as a string to the analysis script
data = '[{"col1": 1, "col2": 2}, {"col1": 3, "col2": 4}]'
result = CALL: execute_python ARGUMENTS: {
    "code": f"import json; from scripts.analyze_dataset import analyze_dataset; print(json.dumps(analyze_dataset({repr(data)})))"
}
```

## Best Practices
1. **Always inspect data first** - Understand structure before analysis.
2. **Handle missing values** - Decide on appropriate strategy.
3. **Document methodology** - Explain analysis steps.
4. **Validate results** - Check for logical consistency.
