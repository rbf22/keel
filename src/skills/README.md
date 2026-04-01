# Keel Skills System

This directory contains all available skills for the Keel agent system. Skills are automatically discovered and loaded at runtime.

## Directory Structure

```
src/skills/
├── index.json              # Auto-generated index of all skills
├── research/               # Research skill directory
│   └── SKILL.md           # Skill definition file
├── python-coding/         # Python coding skill directory
│   └── SKILL.md
├── data-analysis/         # Data analysis skill directory
│   └── SKILL.md
├── quality-review/        # Quality review skill directory
│   └── SKILL.md
├── execution-analyzer/    # Execution analyzer skill directory
│   └── SKILL.md
└── task-planning/         # Task planning skill directory
    └── SKILL.md
```

## Adding New Skills

### 1. Create Skill Directory
Create a new directory for your skill:
```bash
mkdir src/skills/my-new-skill
```

### 2. Create Skill Definition
Create a `SKILL.md` file in your directory following the [Agent Skills specification](https://github.com/modelcontextprotocol/servers/tree/main/src/agent-skills):

```markdown
---
name: my-new-skill
description: Brief description of what this skill does
license: MIT
metadata:
  author: your-name
  version: "1.0"
  tags: [tag1, tag2]
---

# My New Skill

## When to use this skill
Use this skill when you need to...

## How it works
Detailed explanation of the skill's process...

## Implementation
\`\`\`python
# Your Python code here
# Use {{parameter}} for template variables
result = some_function({{input}})
print(result)
\`\`\`
```

### 3. Update Skills Index
Run the automatic index generator:
```bash
./generate-skills-index.sh
```

This will automatically update `src/skills/index.json` with your new skill.

### 4. Test Your Skill
The skill will be automatically loaded when the system initializes. You can test it by:
1. Starting the Keel system
2. Checking the Skills tab in the UI
3. Using the skill in a conversation

## Skill Loading Process

1. **Initialization**: When Keel starts, the skills engine initializes
2. **Built-in Skills**: Core skills (calculator, analyze-data) are registered first
3. **Index Discovery**: The system loads `src/skills/index.json`
4. **Skill Loading**: Each skill listed in the index is loaded from its `SKILL.md` file
5. **Registration**: Successfully loaded skills are registered and made available

## Fallback Mechanism

If the `index.json` file is missing or cannot be loaded, the system falls back to a hardcoded list of known skills to ensure basic functionality.

## Skill Requirements

- Each skill must have its own directory
- Each directory must contain a `SKILL.md` file
- The `SKILL.md` file must follow the Agent Skills specification format
- Skills should include proper metadata (name, description, etc.)

## Development Tips

- Use descriptive skill names
- Provide clear descriptions of when to use each skill
- Include proper error handling in your Python code
- Test your skill thoroughly before adding it to the system
- Use the existing skills as examples for best practices

## Troubleshooting

If a skill doesn't appear in the system:
1. Check that the skill directory exists
2. Verify the `SKILL.md` file is present and properly formatted
3. Run `./generate-skills-index.sh` to update the index
4. Check the browser console for loading errors
5. Review the logs in the Keel UI for detailed error information
