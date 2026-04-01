#!/bin/bash

echo "Generating skills index..."

SKILLS_DIR="/Users/robert_fenwick/SWE/keel/keel/src/skills"
INDEX_FILE="$SKILLS_DIR/index.json"

# Find all directories containing SKILL.md files
skills=()
for dir in "$SKILLS_DIR"/*/; do
    if [ -f "${dir}SKILL.md" ]; then
        skill_name=$(basename "$dir")
        skills+=("$skill_name")
    fi
done

# Generate JSON index
cat > "$INDEX_FILE" << EOF
{
  "version": "1.0",
  "description": "Keel Skills Index - Automatically generated list of available skills",
  "generated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "skills": [
$(printf '    "%s",\n' "${skills[@]}" | sed '$ s/,$//')
  ]
}
EOF

echo "Skills index generated with ${#skills[@]} skills:"
printf '  - %s\n' "${skills[@]}"
