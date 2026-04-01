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

### Data Loading and Inspection
```python
import pandas as pd
import numpy as np

def load_and_inspect(data):
    """Load data and perform initial inspection."""
    df = pd.DataFrame(data)
    
    log(f"Dataset shape: {df.shape}")
    log(f"Columns: {list(df.columns)}")
    log(f"Data types:\n{df.dtypes}")
    log(f"Missing values:\n{df.isnull().sum()}")
    
    return df

# Load your data
df = load_and_inspect(your_data)
```

### Descriptive Statistics
```python
def descriptive_analysis(df):
    """Perform comprehensive descriptive analysis."""
    stats = {}
    
    # Basic statistics for numeric columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        stats[col] = {
            'mean': df[col].mean(),
            'median': df[col].median(),
            'std': df[col].std(),
            'min': df[col].min(),
            'max': df[col].max(),
            'count': df[col].count()
        }
        log(f"{col} statistics: {stats[col]}")
    
    # Value counts for categorical columns
    categorical_cols = df.select_dtypes(include=['object']).columns
    for col in categorical_cols:
        value_counts = df[col].value_counts()
        stats[f"{col}_value_counts"] = value_counts
        log(f"{col} value counts:\n{value_counts}")
    
    return stats
```

### Grouping and Aggregation
```python
def group_and_aggregate(df, group_by_col, agg_col, agg_func='mean'):
    """Group data by a column and perform aggregation."""
    grouped = df.groupby(group_by_col)[agg_col].agg(agg_func)
    
    log(f"Grouped {agg_col} by {group_by_col} using {agg_func}:")
    log(grouped)
    
    return grouped

# Example usage
sales_by_region = group_and_aggregate(df, 'region', 'sales', 'sum')
avg_rating_by_category = group_and_aggregate(df, 'category', 'rating', 'mean')
```

### Data Filtering and Sorting
```python
def filter_data(df, conditions):
    """Filter data based on conditions."""
    filtered_df = df.copy()
    
    for column, condition in conditions.items():
        if condition['type'] == 'greater_than':
            filtered_df = filtered_df[filtered_df[column] > condition['value']]
        elif condition['type'] == 'less_than':
            filtered_df = filtered_df[filtered_df[column] < condition['value']]
        elif condition['type'] == 'equals':
            filtered_df = filtered_df[filtered_df[column] == condition['value']]
        elif condition['type'] == 'contains':
            filtered_df = filtered_df[filtered_df[column].str.contains(condition['value'], na=False)]
    
    log(f"Filtered data shape: {filtered_df.shape}")
    return filtered_df

def sort_data(df, sort_by, ascending=True):
    """Sort data by specified column."""
    sorted_df = df.sort_values(by=sort_by, ascending=ascending)
    log(f"Data sorted by {sort_by} (ascending={ascending})")
    return sorted_df
```

### Correlation Analysis
```python
def correlation_analysis(df):
    """Perform correlation analysis on numeric columns."""
    numeric_df = df.select_dtypes(include=[np.number])
    
    # Calculate correlation matrix
    corr_matrix = numeric_df.corr()
    
    log("Correlation matrix:")
    log(corr_matrix)
    
    # Find strong correlations
    strong_correlations = []
    for i in range(len(corr_matrix.columns)):
        for j in range(i+1, len(corr_matrix.columns)):
            corr_value = corr_matrix.iloc[i, j]
            if abs(corr_value) > 0.7:  # Strong correlation threshold
                strong_correlations.append({
                    'var1': corr_matrix.columns[i],
                    'var2': corr_matrix.columns[j],
                    'correlation': corr_value
                })
    
    log(f"Strong correlations found: {strong_correlations}")
    return corr_matrix, strong_correlations
```

### Data Cleaning
```python
def clean_data(df):
    """Perform comprehensive data cleaning."""
    original_shape = df.shape
    cleaned_df = df.copy()
    
    # Remove duplicates
    cleaned_df = cleaned_df.drop_duplicates()
    log(f"Removed {original_shape[0] - cleaned_df.shape[0]} duplicate rows")
    
    # Handle missing values
    for col in cleaned_df.columns:
        missing_count = cleaned_df[col].isnull().sum()
        if missing_count > 0:
            if cleaned_df[col].dtype in ['int64', 'float64']:
                # Fill numeric with median
                cleaned_df[col].fillna(cleaned_df[col].median(), inplace=True)
                log(f"Filled {missing_count} missing values in {col} with median")
            else:
                # Fill categorical with mode
                mode_value = cleaned_df[col].mode()[0] if not cleaned_df[col].mode().empty else 'Unknown'
                cleaned_df[col].fillna(mode_value, inplace=True)
                log(f"Filled {missing_count} missing values in {col} with mode: {mode_value}")
    
    log(f"Data cleaned. Final shape: {cleaned_df.shape}")
    return cleaned_df
```

## Advanced Analysis Techniques

### Time Series Analysis
```python
def time_series_analysis(df, date_col, value_col):
    """Perform basic time series analysis."""
    # Convert date column to datetime
    df[date_col] = pd.to_datetime(df[date_col])
    
    # Set date as index
    df.set_index(date_col, inplace=True)
    
    # Resample by different periods
    daily = df[value_col].resample('D').mean()
    weekly = df[value_col].resample('W').mean()
    monthly = df[value_col].resample('M').mean()
    
    log(f"Daily average: {daily.mean():.2f}")
    log(f"Weekly average: {weekly.mean():.2f}")
    log(f"Monthly average: {monthly.mean():.2f}")
    
    return daily, weekly, monthly
```

### Statistical Tests
```python
def basic_statistical_tests(df, col1, col2):
    """Perform basic statistical tests."""
    from scipy import stats
    
    # T-test for comparing means
    t_stat, p_value = stats.ttest_ind(df[col1].dropna(), df[col2].dropna())
    
    log(f"T-test between {col1} and {col2}:")
    log(f"T-statistic: {t_stat:.4f}")
    log(f"P-value: {p_value:.4f}")
    
    if p_value < 0.05:
        log("Result: Statistically significant difference")
    else:
        log("Result: No statistically significant difference")
    
    return t_stat, p_value
```

## Output Templates

### Summary Report
```python
def generate_summary_report(df):
    """Generate a comprehensive summary report."""
    report = []
    
    report.append("=== DATA ANALYSIS SUMMARY ===")
    report.append(f"Dataset Overview:")
    report.append(f"- Shape: {df.shape}")
    report.append(f"- Columns: {list(df.columns)}")
    report.append(f"- Data types: {df.dtypes.value_counts().to_dict()}")
    
    # Missing data
    missing_data = df.isnull().sum()
    if missing_data.sum() > 0:
        report.append(f"\nMissing Data:")
        for col, count in missing_data[missing_data > 0].items():
            report.append(f"- {col}: {count} ({count/len(df)*100:.1f}%)")
    
    # Numeric summary
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) > 0:
        report.append(f"\nNumeric Summary:")
        for col in numeric_cols:
            report.append(f"- {col}: mean={df[col].mean():.2f}, std={df[col].std():.2f}")
    
    return "\n".join(report)

# Generate and print report
report = generate_summary_report(df)
print(report)
```

## Tools Available

- `execute_python`: Run analysis code
- `vfs_write`: Save analysis results
- `vfs_read`: Access stored data
- `log`: Show analysis progress

## Best Practices

1. **Always inspect data first** - Understand structure before analysis
2. **Handle missing values** - Decide on appropriate strategy
3. **Document methodology** - Explain analysis steps
4. **Validate results** - Check for logical consistency
5. **Consider data types** - Ensure correct types for analysis

## Common Analysis Tasks

### Sales Analysis
```python
def analyze_sales_data(df):
    """Analyze sales data comprehensively."""
    # Total sales
    total_sales = df['sales'].sum()
    log(f"Total sales: ${total_sales:,.2f}")
    
    # Sales by region
    regional_sales = df.groupby('region')['sales'].sum().sort_values(ascending=False)
    log(f"Sales by region:\n{regional_sales}")
    
    # Monthly trends
    df['date'] = pd.to_datetime(df['date'])
    monthly_sales = df.groupby(df['date'].dt.to_period('M'))['sales'].sum()
    log(f"Monthly sales trend:\n{monthly_sales}")
    
    return {
        'total_sales': total_sales,
        'regional_sales': regional_sales,
        'monthly_sales': monthly_sales
    }
```

### Customer Analysis
```python
def analyze_customers(df):
    """Analyze customer data."""
    # Customer demographics
    customer_stats = df.describe()
    log(f"Customer statistics:\n{customer_stats}")
    
    # Customer segments
    if 'age' in df.columns:
        bins = [0, 25, 35, 50, 100]
        labels = ['Young', 'Adult', 'Middle-aged', 'Senior']
        df['age_group'] = pd.cut(df['age'], bins=bins, labels=labels)
        
        age_distribution = df['age_group'].value_counts()
        log(f"Age distribution:\n{age_distribution}")
    
    return customer_stats
```

## Execution Example

```python
# Complete analysis workflow
def complete_analysis(data):
    """Perform complete data analysis workflow."""
    log("Starting data analysis...")
    
    # Step 1: Load and inspect
    df = load_and_inspect(data)
    
    # Step 2: Clean data
    df_clean = clean_data(df)
    
    # Step 3: Descriptive analysis
    stats = descriptive_analysis(df_clean)
    
    # Step 4: Correlation analysis
    corr_matrix, strong_corr = correlation_analysis(df_clean)
    
    # Step 5: Generate report
    report = generate_summary_report(df_clean)
    
    log("Data analysis complete!")
    return {
        'cleaned_data': df_clean,
        'statistics': stats,
        'correlations': corr_matrix,
        'report': report
    }

# Execute the analysis
results = complete_analysis(your_data)
print(results['report'])
```
