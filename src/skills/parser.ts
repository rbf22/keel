// Interfaces for skill parsing
export interface ParsedSkill {
  name: string
  description: string
  instructions: string
  content: string
  codeBlocks: CodeBlock[]
  tags?: string[]
  metadata?: Record<string, any>
}

import { type StoredSkill as StorageStoredSkill } from '../storage/skills'
import { LLMConverter } from './llm-converter'

export interface CodeBlock {
  language: string
  code: string
  converted?: string // Python code if JS was converted
}

export interface StoredSkill {
  name: string
  description: string
  content: string
  source: string
  downloadDate: Date
  converted: boolean
  tags?: string[]
}

// Parse skills from markdown content
export class SkillsParser {
  static parse(content: string): ParsedSkill {
    if (!content || typeof content !== 'string') {
      throw new Error('Content must be a non-empty string')
    }

    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (!frontmatterMatch) {
      throw new Error('Skill must have YAML frontmatter')
    }

    const yamlContent = frontmatterMatch[1]
    const frontmatter = this.parseSimpleYAML(yamlContent)
    
    // Extract metadata from frontmatter (handle nested metadata)
    const { name, description, tags, metadata: nestedMetadata, license, ...otherFields } = frontmatter
    const metadata = {
      ...nestedMetadata,
      ...otherFields,
      ...(license && { license })
    }
    
    // Validate required fields
    if (!frontmatter.name) {
      throw new Error('missing required field "name"')
    }
    
    if (!frontmatter.description) {
      throw new Error('missing required field "description"')
    }

    // Parse the skill
    const parsed: ParsedSkill = {
      name: frontmatter.name,
      description: frontmatter.description,
      instructions: this.stripCodeBlocks(content.replace(/^---\n[\s\S]*?\n---\n/, '')).trim(),
      content,
      codeBlocks: this.extractCodeBlocks(content),
      tags: frontmatter.tags,
      metadata
    }
    
    // Validate the parsed skill
    if (!this.validateSkill(parsed)) {
      throw new Error('Invalid skill: failed validation')
    }
    
    return parsed
  }
  
  static parseSimpleYAML(yaml: string): Record<string, any> {
    const result: Record<string, any> = {}
    const lines = yaml.split('\n')
    let currentKey: string | null = null
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue
      }
      
      const match = line.match(/^(\w+):\s*(.*)$/)
      if (match) {
        const [, key, value] = match
        
        // Validate key
        if (!key.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
          console.warn(`Invalid YAML key: ${key}`)
          continue
        }
        
        // Handle quoted strings
        if (value.startsWith('"') && value.endsWith('"')) {
          // Escape and unquote
          result[key] = value.slice(1, -1).replace(/\\"/g, '"')
        } else if (value.startsWith('[') && value.endsWith(']')) {
          // Handle arrays
          try {
            result[key] = JSON.parse(value)
          } catch {
            // If JSON.parse fails, treat as string
            result[key] = value
          }
        } else if (value === '') {
          // Empty value could be a nested object
          currentKey = key
          result[key] = {}
        } else if (!isNaN(Number(value))) {
          result[key] = Number(value)
        } else if (value === 'true' || value === 'false') {
          result[key] = value === 'true'
        } else {
          // Unquoted string
          result[key] = value
        }
      } else if (currentKey && line.includes(':')) {
        // Handle nested properties
        const nestedMatch = line.match(/^\s+(\w+):\s*(.*)$/)
        if (nestedMatch) {
          const [, nestedKey, nestedValue] = nestedMatch
          if (nestedValue.startsWith('"') && nestedValue.endsWith('"')) {
            result[currentKey][nestedKey] = nestedValue.slice(1, -1).replace(/\\"/g, '"')
          } else {
            result[currentKey][nestedKey] = nestedValue
          }
        }
      }
    }
    
    return result
  }
  
  static extractCodeBlocks(content: string): CodeBlock[] {
    const blocks: CodeBlock[] = []
    const regex = /```(\w+)?\n([\s\S]*?)```/g
    let match
    
    while ((match = regex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2].trim()
      })
    }
    
    return blocks
  }
  
  static stripCodeBlocks(content: string): string {
    return content.replace(/```(\w+)?\n[\s\S]*?```/g, '').trim()
  }
  
  static toStoredSkill(parsed: ParsedSkill, source: string, converted: boolean = false, conversionMethod?: 'simple' | 'llm' | 'manual'): StorageStoredSkill {
    // Check if any JavaScript was converted
    const hasJavaScript = parsed.codeBlocks.some(block => 
      block.language === 'javascript' || block.language === 'js'
    )
    
    return {
      name: parsed.name,
      description: parsed.description,
      source,
      content: parsed.content,
      converted,
      originalLanguage: hasJavaScript ? 'javascript' : undefined,
      conversionMethod: converted ? conversionMethod : undefined,
      downloadDate: new Date(),
      tags: parsed.tags
    }
  }
  
  static validateSkill(skill: ParsedSkill): boolean {
    // Check required fields
    if (!skill.name || typeof skill.name !== 'string') {
      console.error('Skill validation failed: invalid name')
      return false
    }
    
    if (!skill.description || typeof skill.description !== 'string') {
      console.error('Skill validation failed: invalid description')
      return false
    }
    
    if (!skill.instructions || typeof skill.instructions !== 'string') {
      // Allow empty instructions if skill has code blocks
      if (skill.codeBlocks && skill.codeBlocks.length > 0) {
        console.warn('Skill has no instructions but has code blocks')
      } else {
        console.error('Skill validation failed: invalid instructions')
        return false
      }
    }
    
    // Validate name format
    if (!skill.name.match(/^[a-zA-Z0-9_-]+$/)) {
      throw new Error('Invalid skill name')
    }
    
    // Validate code blocks
    if (!Array.isArray(skill.codeBlocks)) {
      console.error('Skill validation failed: codeBlocks must be an array')
      return false
    }
    
    for (const block of skill.codeBlocks) {
      if (!block.language || typeof block.language !== 'string') {
        console.error('Skill validation failed: code block missing language')
        return false
      }
        
      if (!block.code || typeof block.code !== 'string') {
        console.error('Skill validation failed: code block missing code')
        return false
      }
    }
    
    // Validate tags if present
    if (skill.tags && !Array.isArray(skill.tags)) {
      console.error('Skill validation failed: tags must be an array')
      return false
    }
    
    return true
  }
}

// Convert JavaScript to Python (basic patterns)
export class JS_to_Python_Converter {
  private static llmConverter: LLMConverter | null = null

  static setLLMConverter(converter: LLMConverter | null) {
    this.llmConverter = converter
  }

  static convert(jsCode: string): string {
    let pythonCode = jsCode
    
    // Add json import if needed
    if (pythonCode.includes('JSON.parse') || pythonCode.includes('JSON.stringify')) {
      pythonCode = 'import json\n' + pythonCode
    }
    
    // Simple replacements
    pythonCode = pythonCode
      .replace(/console\.log\((.*?)\);?/g, 'print($1)')
      .replace(/console\.error\((.*?)\);?/g, 'print($1, file=sys.stderr)')
      .replace(/const\s+(\w+)\s*=/g, '$1 =')
      .replace(/let\s+(\w+)\s*=/g, '$1 =')
      .replace(/var\s+(\w+)\s*=/g, '$1 =')
      .replace(/function\s+(\w+)\s*\(([^)]*)\)\s*\{/g, 'def $1($2):')
      .replace(/JSON\.parse/g, 'json.loads')
      .replace(/JSON\.stringify/g, 'json.dumps')
      .replace(/(\w+)\.push\((.*?)\)/g, '$1.append($2)')
      .replace(/(\w+)\.length/g, 'len($1)')
      .replace(/(\w+)\.forEach\((\w+) =>/g, 'for $2 in $1:')
      .replace(/\{/g, ':')
      .replace(/\}/g, '')
      .replace(/;\s*/g, '\n')
    
    return pythonCode.trim()
  }

  static async convertWithFallback(jsCode: string): Promise<string> {
    // Try LLM first if available
    if (this.llmConverter && this.llmConverter.isAvailable()) {
      try {
        return await this.llmConverter.convertWithLLM(jsCode)
      } catch (error: any) {
        console.warn('LLM conversion failed, falling back to simple converter:', error.message)
      }
    }

    // Fallback to simple converter
    return this.convert(jsCode)
  }
  
  static canConvert(language: string): boolean {
    return language === 'javascript' || language === 'js'
  }
}
