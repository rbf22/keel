---
name: research
description: Gather information and conduct research using web fetching. Use when you need to find facts, data, or information from the internet, analyze web content, or research specific topics.
license: Apache-2.0
metadata:
  author: keel-system
  version: "1.0"
---

# Research Skill

## When to use this skill

Use this skill when you need to:
- Find factual information or data from the web
- Research specific topics or questions
- Analyze web content and extract key information
- Gather background information for a task
- Verify claims or find supporting evidence

## How to conduct research

1. **Identify Research Needs**: Determine what specific information you need to find
2. **Use Web Fetching**: Use the web_fetch tool to get content from relevant URLs
3. **Analyze Content**: Extract key information, facts, and data from the fetched content
4. **Synthesize Findings**: Organize the information in a clear, structured way
5. **Store Results**: Save important findings to the VFS for later reference

## Research Process

### Step 1: Planning
- Clearly define what information you need
- Identify potential sources or URLs to investigate
- Consider what keywords or topics to search for

### Step 2: Information Gathering
```
Use: CALL: web_fetch ARGUMENTS: {"url": "https://example.com"}
```
- Fetch content from relevant web pages
- Try multiple sources if needed for comprehensive coverage
- Focus on authoritative and reliable sources

### Step 3: Analysis
- Read through the fetched content carefully
- Extract relevant facts, data, and insights
- Note any conflicting information or uncertainties

### Step 4: Synthesis
- Organize findings in a logical structure
- Highlight key points and conclusions
- Provide context for the information found

### Step 5: Documentation
```
Use: CALL: vfs_write ARGUMENTS: {"path": "keel://research/findings.md", "content": "..."}
```
- Save research findings to the VFS
- Include source URLs for reference
- Structure the information for easy future access

## Best Practices

- **Source Quality**: Prioritize authoritative sources (academic, official, reputable organizations)
- **Multiple Sources**: Cross-check important information across multiple sources
- **Currency**: Consider the timeliness of information
- **Relevance**: Focus on information directly relevant to the task
- **Attribution**: Always note where information was found

## Common Research Tasks

### Fact Finding
- Look up specific facts, statistics, or data points
- Verify claims or statements
- Find definitions or explanations

### Topic Research
- Gather comprehensive information about a topic
- Understand different perspectives or viewpoints
- Identify key trends or developments

### Background Research
- Provide context for a problem or task
- Historical information or development
- Related work or existing solutions

## Output Format

Structure your research findings as:

```
# Research: [Topic]

## Key Findings
- [Key point 1]
- [Key point 2]

## Detailed Information
[Detailed explanation and analysis]

## Sources
- [Source 1]: [URL]
- [Source 2]: [URL]
```

## Tools Available

- `web_fetch`: Fetch content from web pages
- `vfs_write`: Save findings to storage
- `vfs_read`: Access stored research
- `vfs_ls`: List available research files

## Limitations

- Only accessible URLs can be fetched
- Some websites may block automated access
- Information quality depends on source reliability
- Consider the publication date of sources
