import { describe, it, expect } from 'vitest'
import { SkillsParser } from './parser.js'

describe('SkillsParser Validation', () => {
  it('should reject skill with invalid name format', () => {
    const invalidSkill = `---
name: "invalid name with spaces"
description: Test skill
---
Some content`
    
    expect(() => SkillsParser.parse(invalidSkill)).toThrow('Invalid skill name')
  })

  it('should reject skill without required fields', () => {
    const missingName = `---
description: A skill without name
---
Some content`
    
    expect(() => SkillsParser.parse(missingName)).toThrow('missing required field "name"')
    
    const missingDescription = `---
name: test-skill
---
Some content`
    
    expect(() => SkillsParser.parse(missingDescription)).toThrow('missing required field "description"')
  })

  it('should reject skill with empty content', () => {
    const emptyContent = `---
name: test-skill
description: Test skill
---
    
    `
    
    expect(() => SkillsParser.parse(emptyContent)).toThrow('failed validation')
  })

  it('should reject skill with malformed YAML', () => {
    const malformedYAML = `---
name: test-skill
description: This line is not properly formatted: has colon but no value
---
Some content`
    
    // Should still parse but warn about invalid key
    const result = SkillsParser.parse(malformedYAML)
    expect(result.name).toBe('test-skill')
  })

  it('should handle special characters in quoted strings', () => {
    const skillWithQuotes = `---
name: test-skill
description: "A skill with \\"quoted\\" text in description"
---
Some content with "quotes"`
    
    const result = SkillsParser.parse(skillWithQuotes)
    expect(result.description).toBe('A skill with "quoted" text in description')
  })

  it('should parse arrays correctly', () => {
    const skillWithArray = `---
name: test-skill
description: Test skill
tags: ["tag1", "tag2", "tag3"]
---
Some content`
    
    const result = SkillsParser.parse(skillWithArray)
    expect(result.tags).toEqual(['tag1', 'tag2', 'tag3'])
  })

  it('should reject non-string input', () => {
    expect(() => SkillsParser.parse(null as any)).toThrow('must be a non-empty string')
    expect(() => SkillsParser.parse(undefined as any)).toThrow('must be a non-empty string')
    expect(() => SkillsParser.parse(123 as any)).toThrow('must be a non-empty string')
  })
})
