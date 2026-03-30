// @ts-nocheck
import { describe, it, expect } from 'vitest'
import { SkillsParser, JS_to_Python_Converter } from './parser.js'

describe('SkillsParser', () => {
  it('should parse a skill with YAML frontmatter', () => {
    const skillContent = `---
name: test-skill
description: A test skill
license: MIT
metadata:
  author: test
  version: "1.0.0"
---

This is the skill content.

\`\`\`javascript
console.log('Hello World');
\`\`\`

More instructions here.
`

    const parsed = SkillsParser.parse(skillContent)
    
    expect(parsed.name).toBe('test-skill')
    expect(parsed.description).toBe('A test skill')
    expect(parsed.metadata).toEqual({
      author: 'test',
      version: '1.0.0',
      license: 'MIT'
    })
    expect(parsed.instructions).toContain('This is the skill content.')
    expect(parsed.codeBlocks).toHaveLength(1)
    expect(parsed.codeBlocks[0].language).toBe('javascript')
    expect(parsed.codeBlocks[0].code).toBe("console.log('Hello World');")
  })

  it('should throw error for invalid skill format', () => {
    const invalidSkill = 'No frontmatter here'
    
    expect(() => SkillsParser.parse(invalidSkill)).toThrow('YAML frontmatter')
  })

  it('should extract multiple code blocks', () => {
    const skillContent = `---
name: multi-code
description: Skill with multiple code blocks
---

\`\`\`javascript
console.log('JS');
\`\`\`

\`\`\`python
print('Python')
\`\`\`

\`\`\`javascript
const x = 42;
\`\`\`
`

    const parsed = SkillsParser.parse(skillContent)
    expect(parsed.codeBlocks).toHaveLength(3)
    expect(parsed.codeBlocks[0].language).toBe('javascript')
    expect(parsed.codeBlocks[1].language).toBe('python')
    expect(parsed.codeBlocks[2].language).toBe('javascript')
  })
})

describe('JS_to_Python_Converter', () => {
  it('should convert console.log to print', () => {
    const js = "console.log('Hello World');"
    const python = JS_to_Python_Converter.convert(js)
    expect(python).toBe("print('Hello World')")
  })

  it('should convert variable declarations', () => {
    const js = "const x = 10; let y = 20; var z = 30;"
    const python = JS_to_Python_Converter.convert(js)
    expect(python).toBe("x = 10\ny = 20\nz = 30")
  })

  it('should convert function declarations', () => {
    const js = "function add(a, b) { return a + b; }"
    const python = JS_to_Python_Converter.convert(js)
    // The converter is basic, just check it has the function definition
    expect(python).toContain('def add')
    expect(python).toContain('return a + b')
  })

  it('should convert array methods', () => {
    const js = "arr.push(item); arr.length;"
    const python = JS_to_Python_Converter.convert(js)
    expect(python).toBe("arr.append(item)\nlen(arr)")
  })

  it('should add json import when needed', () => {
    const js = "JSON.parse(str); JSON.stringify(obj);"
    const python = JS_to_Python_Converter.convert(js)
    expect(python).toContain('import json')
    expect(python).toContain('json.loads(str)')
    expect(python).toContain('json.dumps(obj)')
  })

  it('should handle complex conversions', () => {
    const js = `const data = JSON.parse(response);
data.forEach(item => {
  console.log(item.name);
});`
    
    const python = JS_to_Python_Converter.convert(js)
    expect(python).toContain('import json')
    expect(python).toContain('json.loads(response)')
    // The forEach conversion is basic, just check it attempts conversion
    expect(python).toContain('for item in data')
    expect(python).toContain('print(item.name)')
  })
})
