// Interfaces for skill parsing
export interface ParsedSkill {
  name: string
  description: string
  instructions: string
  content: string
  codeBlocks: CodeBlock[]
  tags?: string[]
  metadata?: Record<string, unknown>
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
    const frontmatter = this.parseSimpleYAML(yamlContent) as Record<string, unknown>
    
    // Extract metadata from frontmatter (handle nested metadata)
    const { name: _name, description: _description, tags: _tags, metadata: nestedMetadata, license, ...otherFields } = frontmatter
    const metadata: Record<string, unknown> = {
      ...(typeof nestedMetadata === 'object' && nestedMetadata !== null ? (nestedMetadata as Record<string, unknown>) : {}),
      ...otherFields,
      ...(license ? { license } : {})
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
      name: String(frontmatter.name || ''),
      description: String(frontmatter.description || ''),
      instructions: this.stripCodeBlocks(content.replace(/^---\n[\s\S]*?\n---\n/, '')).trim(),
      content,
      codeBlocks: this.extractCodeBlocks(content),
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : undefined,
      metadata
    }
    
    // Validate the parsed skill
    if (!this.validateSkill(parsed)) {
      throw new Error('Invalid skill: failed validation')
    }
    
    return parsed
  }
  
  static parseSimpleYAML(yaml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    const lines = yaml.split('\n')
    let currentKey: string | null = null
    let inMultilineString = false
    let multilineIndent = 0
    let multilineContent: string[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      
      // Skip empty lines and comments (if not in multiline)
      if (!inMultilineString && (!trimmed || trimmed.startsWith('#'))) {
        continue
      }
      
      // Handle multiline strings (block scalars)
      if (inMultilineString) {
        const currentIndent = line.search(/\S/)
        if (currentIndent !== -1 && currentIndent < multilineIndent) {
          // End of multiline string based on indentation
          result[currentKey!] = multilineContent.join('\n').trimEnd()
          inMultilineString = false
          multilineContent = []
          currentKey = null
          // Reprocess this line as it might be a new key
          i-- 
          continue
        } else {
          // Add line content, stripping only the block indent
          multilineContent.push(line.substring(multilineIndent))
        }
        continue
      }
      
      // Check for block scalar start (| or >)
      const blockStartMatch = line.match(/^(\w+):\s*([|>])\s*$/)
      if (blockStartMatch) {
        const key = blockStartMatch[1]
        
        // Check if there's actually a next line with more indentation
        let nextIndentedLineIdx = -1
        let j = i + 1
        while (j < lines.length) {
          if (lines[j].trim()) {
            const nextIndent = lines[j].search(/\S/)
            // We assume a block scalar MUST be indented more than the key
            // The key's indent is line.search(/\S/)
            if (nextIndent > line.search(/\S/)) {
              nextIndentedLineIdx = j
            }
            break
          }
          j++
        }

        if (nextIndentedLineIdx !== -1) {
          inMultilineString = true
          currentKey = key
          multilineIndent = lines[nextIndentedLineIdx].search(/\S/)
          continue
        }
        // If no indented content follows, treat it as a normal value (handled below)
      }
      
      const match = line.match(/^(\w+):\s*(.*)$/)
      if (match) {
        const [, key, value] = match
        
        // Validate key
        if (!key.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
          console.warn(`Invalid YAML key: ${key}`)
          continue
        }
        
        // Handle quoted strings with escape sequences
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          const unquoted = value.slice(1, -1)
          // Handle escape sequences
          const unescaped = unquoted
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\\\/g, '\\')
          result[key] = unescaped
        } else if (value.startsWith('[') && value.endsWith(']')) {
          // Handle arrays
          try {
            // Parse comma-separated values if not valid JSON
            if (value.includes(',') && !value.includes('"')) {
              result[key] = value.slice(1, -1).split(',').map(v => v.trim());
            } else {
              result[key] = JSON.parse(value)
            }
          } catch {
            // If JSON.parse fails, try comma-separated
            if (value.includes(',')) {
              result[key] = value.slice(1, -1).split(',').map(v => v.trim());
            } else {
              result[key] = value
            }
          }
        } else if (value.startsWith('{') && value.endsWith('}')) {
          // Handle inline objects
          try {
            result[key] = JSON.parse(value)
          } catch {
            console.warn(`Failed to parse inline object for key ${key}: ${value}`)
            result[key] = {}
          }
        } else if (value === '') {
          // Empty value could be a nested object or empty array
          currentKey = key
          // Check if key suggests it should be an array
          if (key === 'tags' || key.endsWith('s')) {
            result[key] = []
          } else {
            result[key] = {}
          }
        } else if (!isNaN(Number(value)) && value !== '') {
          // Handle numbers (including negative and decimals)
          result[key] = Number(value)
        } else if (value === 'true' || value === 'false') {
          // Handle booleans
          result[key] = value === 'true'
        } else if (value === 'null' || value === '~') {
          // Handle null values
          result[key] = null
        } else {
          // Unquoted string
          result[key] = value
        }
      } else if (currentKey && line.includes(':')) {
        // Handle nested properties
        const nestedMatch = line.match(/^\s+(\w+):\s*(.*)$/)
        if (nestedMatch) {
          const [, nestedKey, nestedValue] = nestedMatch
          
          // Ensure we have an object to store nested properties
          if (!result[currentKey] || typeof result[currentKey] !== 'object') {
            result[currentKey] = {}
          }
          
          const nestedResult = result[currentKey] as Record<string, unknown>
          if ((nestedValue.startsWith('"') && nestedValue.endsWith('"')) || 
              (nestedValue.startsWith("'") && nestedValue.endsWith("'"))) {
            const unquoted = nestedValue.slice(1, -1)
            const unescaped = unquoted
              .replace(/\\"/g, '"')
              .replace(/\\'/g, "'")
              .replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t')
              .replace(/\\\\/g, '\\')
            nestedResult[nestedKey] = unescaped
          } else if (nestedValue === 'true' || nestedValue === 'false') {
            nestedResult[nestedKey] = nestedValue === 'true'
          } else if (nestedValue === 'null' || nestedValue === '~') {
            nestedResult[nestedKey] = null
          } else if (!isNaN(Number(nestedValue)) && nestedValue !== '') {
            nestedResult[nestedKey] = Number(nestedValue)
          } else {
            nestedResult[nestedKey] = nestedValue
          }
        }
      } else if (currentKey && trimmed.startsWith('- ')) {
        // Handle array items in nested context
        if (!Array.isArray(result[currentKey])) {
          result[currentKey] = []
        }
        const currentArray = result[currentKey] as unknown[]
        const item = trimmed.slice(2).trim()
        // Remove quotes if present
        if ((item.startsWith('"') && item.endsWith('"')) || 
            (item.startsWith("'") && item.endsWith("'"))) {
          currentArray.push(item.slice(1, -1))
        } else {
          currentArray.push(item)
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

  private static extractParenContent(str: string, startIdx: number): string {
    // Extract content within matching parentheses, handling nesting
    let depth = 1
    let i = startIdx
    while (i < str.length && depth > 0) {
      if (str[i] === '(') depth++
      else if (str[i] === ')') depth--
      i++
    }
    return str.substring(startIdx, i - 1)
  }

  private static replaceConsoleCalls(str: string): { result: string; hasError: boolean } {
    let result = str
    let hasError = false
    const patterns = [
      { pattern: /console\.error\(/g, method: 'error' as const },
      { pattern: /console\.log\(/g, method: 'log' as const }
    ]
    
    for (const { pattern, method } of patterns) {
      // Collect all matches first to avoid index shifting during replacement
      const matches: Array<{ index: number; length: number; replacement: string }> = []
      let match
      while ((match = pattern.exec(result)) !== null) {
        hasError = hasError || method === 'error'
        const startIdx = match.index + match[0].length
        const content = this.extractParenContent(result, startIdx)
        const replacement = method === 'error' 
          ? `print(${content}, file=sys.stderr)` 
          : `print(${content})`
        
        // Check for trailing semicolon
        const endIdx = startIdx + content.length + 1
        const hasSemicolon = result[endIdx] === ';'
        const fullMatchEnd = hasSemicolon ? endIdx + 1 : endIdx
        const matchLength = fullMatchEnd - match.index
        
        matches.push({
          index: match.index,
          length: matchLength,
          replacement
        })
      }
      
      // Replace from right to left to avoid index shifting
      for (let i = matches.length - 1; i >= 0; i--) {
        const { index, length, replacement } = matches[i]
        result = result.substring(0, index) + replacement + result.substring(index + length)
      }
    }
    
    return { result, hasError }
  }

  static convert(jsCode: string): string {
    let pythonCode = jsCode
    const imports: string[] = []
    
    // Add json import if needed (will be first)
    if (pythonCode.includes('JSON.parse') || pythonCode.includes('JSON.stringify')) {
      imports.push('import json')
    }
    
    // Handle console.log and console.error with nested parentheses support
    const { result, hasError } = this.replaceConsoleCalls(pythonCode)
    pythonCode = result
    
    if (hasError) {
      imports.push('import sys')
    }
    
    // Simple replacements
    pythonCode = pythonCode
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
    
    // Prepend all imports in deterministic order
    if (imports.length > 0) {
      pythonCode = imports.join('\n') + '\n' + pythonCode
    }
    
    return pythonCode.trim()
  }

  static async convertWithFallback(jsCode: string): Promise<string> {
    // Try LLM first if available
    if (this.llmConverter && this.llmConverter.isAvailable()) {
      try {
        return await this.llmConverter.convertWithLLM(jsCode)
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('LLM conversion failed, falling back to simple converter:', errorMessage)
      }
    }

    // Fallback to simple converter
    return this.convert(jsCode)
  }
  
  static canConvert(language: string): boolean {
    return language === 'javascript' || language === 'js'
  }
}
