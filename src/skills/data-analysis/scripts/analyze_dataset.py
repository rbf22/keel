import json
import pandas as pd
import numpy as np
import sys

def analyze_dataset(data):
    """Perform complete data analysis workflow."""
    df = pd.DataFrame(data)
    
    # 1. Cleaning
    original_shape = df.shape
    df_clean = df.drop_duplicates()
    
    # Handle missing values
    for col in df_clean.columns:
        missing_count = df_clean[col].isnull().sum()
        if missing_count > 0:
            if df_clean[col].dtype in ['int64', 'float64']:
                df_clean[col].fillna(df_clean[col].median(), inplace=True)
            else:
                mode_value = df_clean[col].mode()[0] if not df_clean[col].mode().empty else 'Unknown'
                df_clean[col].fillna(mode_value, inplace=True)
    
    # 2. Descriptive stats
    stats = {}
    numeric_cols = df_clean.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        stats[col] = {
            'mean': float(df_clean[col].mean()),
            'median': float(df_clean[col].median()),
            'std': float(df_clean[col].std()),
            'min': float(df_clean[col].min()),
            'max': float(df_clean[col].max()),
            'count': int(df_clean[col].count())
        }
    
    # 3. Correlations
    corr_matrix = None
    if len(numeric_cols) > 1:
         corr_matrix = df_clean[numeric_cols].corr().to_dict()
    
    # 4. Generate report
    report = [
        "=== DATA ANALYSIS SUMMARY ===",
        f"Dataset Overview:",
        f"- Shape: {df_clean.shape} (Original: {original_shape})",
        f"- Columns: {list(df_clean.columns)}",
        "\nNumeric Summary:"
    ]
    for col, s in stats.items():
        report.append(f"- {col}: mean={s['mean']:.2f}, std={s['std']:.2f}")
    
    return {
        'statistics': stats,
        'correlations': corr_matrix,
        'report': "\n".join(report),
        'cleaned_shape': df_clean.shape
    }

if __name__ == "__main__":
    # Parameters provided via globals or sys.argv
    data_str = globals().get('data', '[]')
    if not data_str or data_str == '[]':
        if len(sys.argv) > 1:
            data_str = sys.argv[1]
    
    try:
        data = json.loads(data_str)
        result = analyze_dataset(data)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
