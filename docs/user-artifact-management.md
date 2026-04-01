# User Artifact Management Guide

This guide explains how to create, reference, and manage artifacts in Keel's Virtual Filesystem (VFS).

## What is the VFS?

The Virtual Filesystem (VFS) is a storage system within Keel that allows you to save and manage files and artifacts. All files are stored with paths starting with `keel://`.

## Viewing Artifacts

Artifacts are displayed in the **Context Tab** of the Keel interface. To see all saved artifacts:
1. Click on the "Context" tab in the sidebar
2. The tab will show all files stored in the VFS
3. Click the "Refresh" button to update the view

## Creating Artifacts

### Method 1: Natural Language Commands

You can save content using natural language commands:

```
Save this as keel://notes/memo.txt: This is my important note
```

```
Write this to keel://code/example.py: print("Hello, World!")
```

### Method 2: Skills Automatically Save Artifacts

When you use skills like research, data analysis, or coding, they automatically save their outputs to the VFS:
- Research results → `keel://research/`
- Code files → `keel://code/`
- Data analysis → `keel://analysis/`
- Plans → `keel://plans/`

## Referencing Artifacts

To reference an artifact in your conversation:
- Simply mention the path: "Please analyze the data in keel://data/sales.csv"
- Or just the filename: "Can you improve the code in calculator.py?"

## Managing Artifacts

### Reading Files

```
Read the file keel://notes/memo.txt
```

### Listing Files

```
List keel://research/
```

### Deleting Files

```
Delete the file keel://temp/draft.txt
```

## Directory Structure

The VFS organizes files by type:
- `keel://resources/` - General files and resources
- `keel://research/` - Research findings and web content
- `keel://code/` - Source code and scripts
- `keel://analysis/` - Data analysis results
- `keel://plans/` - Task plans and strategies
- `keel://agent/` - Agent-specific files

## Tips

1. **Use descriptive paths** - Organize your files with clear directory structures
2. **Clean up regularly** - Delete temporary or outdated files to keep the context tab clean
3. **Reference by path** - Be specific when referencing files to avoid confusion
4. **Check the Context Tab** - Always verify your files are saved correctly by checking the Context Tab

## Example Workflow

1. **Research**: "Research the latest trends in AI"
   - Saves to: `keel://research/ai-trends.md`

2. **Analysis**: "Analyze the data in keel://data/sales.csv"
   - Saves to: `keel://analysis/sales-summary.md`

3. **Code**: "Create a Python script to visualize the sales data"
   - Saves to: `keel://code/visualize-sales.py`

4. **Review**: Check the Context Tab to see all your artifacts

5. **Cleanup**: "Delete keel://temp/scratch.txt" to remove unnecessary files

## Troubleshooting

- **File not showing in Context Tab?** Click the "Refresh" button
- **Can't find a file?** Use "List keel:///" to see all files
- **File content is wrong?** Check the path and save again with the correct content
