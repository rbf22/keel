import { describe, it, expect } from 'vitest';
import { SkillsParser } from './parser';

describe('SkillsParser - YAML Edge Cases', () => {
  describe('parseSimpleYAML', () => {
    it('should handle empty values correctly', () => {
      const yaml = `name: test
description: 
tags: test,example
version: 1.0`;
      
      const result = (SkillsParser as any).parseSimpleYAML(yaml);
      
      expect(result).toEqual({
        name: 'test',
        description: {},
        tags: 'test,example',
        version: 1.0
      });
    });

    it('should not parse empty strings as numbers', () => {
      const yaml = `name: test
count: 
price: 0
empty: ""`;
      
      const result = (SkillsParser as any).parseSimpleYAML(yaml);
      
      expect(result).toEqual({
        name: 'test',
        count: {},
        price: 0,
        empty: ''
      });
    });

    it('should handle whitespace-only values', () => {
      const yaml = `name: test
description:   
version:   `;
      
      const result = (SkillsParser as any).parseSimpleYAML(yaml);
      
      expect(result).toEqual({
        name: 'test',
        description: {},
        version: {}
      });
    });

    it('should parse valid numbers correctly', () => {
      const yaml = `name: test
count: 42
price: 19.99
zero: 0`;
      
      const result = (SkillsParser as any).parseSimpleYAML(yaml);
      
      expect(result).toEqual({
        name: 'test',
        count: 42,
        price: 19.99,
        zero: 0
      });
    });

    it('should handle boolean values', () => {
      const yaml = `name: test
enabled: true
debug: false
flag: True`;
      
      const result = (SkillsParser as any).parseSimpleYAML(yaml);
      
      expect(result).toEqual({
        name: 'test',
        enabled: true,
        debug: false,
        flag: 'True'
      });
    });

    it('should parse quoted strings as strings', () => {
      const yaml = `name: "test"
number: "123"
boolean: "false"
empty: ""`;
      
      const result = (SkillsParser as any).parseSimpleYAML(yaml);
      
      expect(result).toEqual({
        name: 'test',
        number: '123',
        boolean: 'false',
        empty: ''
      });
    });

    it('should handle JSON objects', () => {
      const yaml = `name: test
config: {"key": "value", "count": 5}
empty: {}`;
      
      const result = (SkillsParser as any).parseSimpleYAML(yaml);
      
      expect(result).toEqual({
        name: 'test',
        config: {
          key: "value",
          count: 5
        },
        empty: {}
      });
    });

    it('should handle invalid JSON gracefully', () => {
      const yaml = `name: test
config: {"invalid": json}`;
      
      const result = (SkillsParser as any).parseSimpleYAML(yaml);
      
      expect(result).toEqual({
        name: 'test',
        config: {}
      });
    });

    it('should handle nested properties', () => {
      const yaml = `name: test
nested: 
  value: test
deep:
  property: 123`;
      
      const result = (SkillsParser as any).parseSimpleYAML(yaml);
      
      expect(result).toEqual({
        name: 'test',
        nested: {
          value: 'test'
        },
        deep: {
          property: 123
        }
      });
    });

    it('should handle special characters in values', () => {
      const yaml = `name: test-with_underscore
description: A test with special chars: @#$%^&*()
path: /usr/local/bin
url: https://example.com`;
      
      const result = (SkillsParser as any).parseSimpleYAML(yaml);
      
      expect(result).toEqual({
        name: 'test-with_underscore',
        description: 'A test with special chars: @#$%^&*()',
        path: '/usr/local/bin',
        url: 'https://example.com'
      });
    });

    it('should handle multiline values', () => {
      const yaml = `name: test
description: |`;
      
      const result = (SkillsParser as any).parseSimpleYAML(yaml);
      
      expect(result).toEqual({
        name: 'test',
        description: '|'
      });
    });
  });

  describe('Integration - Full Skill Parsing', () => {
    it('should parse skill with empty metadata fields', () => {
      const skillContent = `---
name: test-skill
description: A test skill
tags:
---

# Test Skill

This is a test skill.`;
      
      const skill = SkillsParser.parse(skillContent);
      
      expect(skill.name).toBe('test-skill');
      expect(skill.description).toBe('A test skill');
      expect(skill.tags).toEqual([]);
      expect(skill.instructions).toContain('This is a test skill');
    });

    it('should parse skill with mixed empty and non-empty fields', () => {
      const skillContent = `---
name: test-skill
description: A proper description
tags: [test, example]
version: 
author: test-author
---

# Test Skill

This is a test skill.`;
      
      const skill = SkillsParser.parse(skillContent);
      
      expect(skill.name).toBe('test-skill');
      expect(skill.description).toBe('A proper description');
      expect(skill.tags).toEqual(['test', 'example']);
      expect(skill.metadata?.author).toBe('test-author');
      expect(skill.metadata?.version).toEqual({});
    });

    it('should handle skill with no frontmatter', () => {
      const skillContent = `# Test Skill

This skill has no frontmatter.`;
      
      expect(() => SkillsParser.parse(skillContent)).toThrow('Skill must have YAML frontmatter');
    });

    it('should validate required fields after parsing', () => {
      const skillContent = `---
description: Has description but no name
---

# Test

Content`;
      
      expect(() => SkillsParser.parse(skillContent)).toThrow('missing required field "name"');
    });
  });
});
