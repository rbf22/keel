import { PythonRuntime } from '../python-runtime'
import { PythonOutput } from '../types'
import { skillStorage } from '../storage/skills'
import { SkillsParser, ParsedSkill, CodeBlock, SkillMetadata } from './parser.js'
import { logger } from '../logger'

export interface SkillExecutionContext {
  pythonRuntime: PythonRuntime
  userMessage?: string
  conversationHistory?: Array<{ role: string; content: string }>
  timeout?: number // Optional timeout in milliseconds
}

export interface SkillExecutionResult {
  success: boolean
  output?: string
  pythonCode?: string
  error?: string
}

export class SkillsEngine {
  private skillMetadata = new Map<string, SkillMetadata>()
  private loadedSkills = new Map<string, ParsedSkill>()
  private initialized = false
  
  async init(): Promise<void> {
    // Load all stored skills metadata first (Level 1)
    const storedSkills = await skillStorage.getAllSkills()
    const failedSkills: string[] = []
    
    for (const stored of storedSkills) {
      try {
        const metadata = SkillsParser.parseMetadata(stored.content)
        this.skillMetadata.set(stored.name, metadata)
      } catch (error) {
        const skillName = stored.name || 'unknown'
        console.error(`Failed to load skill metadata for ${skillName}:`, error)
        failedSkills.push(skillName)
      }
    }
    
    this.initialized = true
    
    // Log summary of initialization
    if (failedSkills.length > 0) {
      logger.warn('skills', 'Some skills failed to load metadata', {
        totalSkills: storedSkills.length,
        failedCount: failedSkills.length,
        failedSkills
      })
    }
    
    logger.info('skills', 'Skills engine initialized with metadata', {
      totalMetadataLoaded: this.skillMetadata.size,
      totalFailed: failedSkills.length
    })
  }
  
  // Register built-in skills
  registerBuiltInSkills(): void {
    // Calculator skill
    const calculatorContent = `---
name: calculator
description: Perform mathematical calculations and evaluations. Use when you need to calculate expressions, evaluate formulas, or perform numeric computations.
---

Use this skill when you need to:
- Calculate mathematical expressions
- Evaluate formulas
- Perform numeric computations

Simply provide the expression to evaluate.

\`\`\`python
# Calculator skill
import math
import numpy as np
import ast
import operator

expression = "{{expression}}"

# Safe mathematical expression evaluator
def safe_eval(expression: str):
    """
    Safely evaluate a mathematical expression using AST parsing.
    Only allows mathematical operations and functions.
    """
    try:
        # Parse the expression into an AST
        node = ast.parse(expression, mode='eval')
        
        # Define allowed operators
        operators = {
            ast.Add: operator.add,
            ast.Sub: operator.sub,
            ast.Mult: operator.mul,
            ast.Div: operator.truediv,
            ast.Pow: operator.pow,
            ast.Mod: operator.mod,
            ast.FloorDiv: operator.floordiv,
            ast.USub: operator.neg,
            ast.UAdd: operator.pos,
        }
        
        # Define allowed functions
        allowed_functions = {
            'sqrt': math.sqrt,
            'sin': math.sin,
            'cos': math.cos,
            'tan': math.tan,
            'asin': math.asin,
            'acos': math.acos,
            'atan': math.atan,
            'log': math.log,
            'log10': math.log10,
            'exp': math.exp,
            'factorial': math.factorial,
            'ceil': math.ceil,
            'floor': math.floor,
            'abs': abs,
            'round': round,
            'min': min,
            'max': max,
            'sum': sum,
        }
        
        # Define allowed constants
        allowed_constants = {
            'pi': math.pi,
            'e': math.e,
            'tau': math.tau,
            'inf': math.inf,
            'nan': math.nan,
        }
        
        def _eval(node):
            if isinstance(node, ast.Expression):
                return _eval(node.body)
            elif isinstance(node, ast.Constant):
                if isinstance(node.value, (int, float, complex)):
                    return node.value
                else:
                    raise ValueError(f"Invalid constant: {node.value}")
            elif isinstance(node, ast.UnaryOp):
                if type(node.op) in operators:
                    return operators[type(node.op)](_eval(node.operand))
                else:
                    raise ValueError(f"Unsupported unary operator: {node.op}")
            elif isinstance(node, ast.BinOp):
                if type(node.op) in operators:
                    return operators[type(node.op)](_eval(node.left), _eval(node.right))
                else:
                    raise ValueError(f"Unsupported binary operator: {node.op}")
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    func_name = node.func.id
                    if func_name in allowed_functions:
                        args = [_eval(arg) for arg in node.args]
                        return allowed_functions[func_name](*args)
                    else:
                        raise ValueError(f"Function '{func_name}' not allowed")
                else:
                    raise ValueError("Only direct function calls allowed")
            elif isinstance(node, ast.Name):
                if node.id in allowed_constants:
                    return allowed_constants[node.id]
                elif node.id in ['np', 'numpy']:
                    return np
                else:
                    raise ValueError(f"Name '{node.id}' not allowed")
            elif isinstance(node, ast.Attribute):
                if isinstance(node.value, ast.Name) and node.value.id in ['np', 'numpy']:
                    # Allow numpy attributes like np.pi
                    return getattr(np, node.attr)
                else:
                    raise ValueError(f"Attribute access not allowed: {node.attr}")
            else:
                raise ValueError(f"Unsupported expression: {type(node).__name__}")
        
        result = _eval(node)
        return result
        
    except SyntaxError as e:
        print(f"Syntax error: {e}")
        return None
    except Exception as e:
        print(f"Error evaluating expression: {e}")
        return None

try:
    result = safe_eval(expression)
    if result is not None:
        print(f"Result: {result}")
    else:
        print("Failed to evaluate expression")
except Exception as e:
    print(f"Error: {e}")
\`\`\``
    this.registerSkill(SkillsParser.parse(calculatorContent))
    
    // Data analysis skill
    const analyzeDataContent = `---
name: analyze-data
description: Perform advanced data analysis using pandas. Use when you need to group, aggregate, filter, sort, or clean datasets.
---

Use this skill when you need to:
- Group and aggregate data
- Filter and sort datasets
- Calculate statistics
- Clean and transform data

\`\`\`python
import pandas as pd
import numpy as np

# Load data
df = pd.DataFrame({{data}})

# Perform analysis
result = df.describe()
print("Data Analysis Result:")
print(result)
\`\`\``
    this.registerSkill(SkillsParser.parse(analyzeDataContent))
  }
  
  // Register a skill
  registerSkill(skill: ParsedSkill): void {
    this.skillMetadata.set(skill.name, {
      name: skill.name,
      description: skill.description,
      tags: skill.tags,
      metadata: skill.metadata
    })
    this.loadedSkills.set(skill.name, skill)
  }
  
  // Get all available skills (metadata only for Level 1 disclosure)
  getAvailableSkillsMetadata(): SkillMetadata[] {
    return Array.from(this.skillMetadata.values())
  }

  // Get full skill (loads from storage if needed - Level 2 disclosure)
  async getFullSkill(name: string): Promise<ParsedSkill | undefined> {
    if (this.loadedSkills.has(name)) {
      return this.loadedSkills.get(name)
    }

    const stored = await skillStorage.getSkill(name)
    if (!stored) return undefined

    try {
      const parsed = SkillsParser.parse(stored.content)
      this.loadedSkills.set(name, parsed)
      return parsed
    } catch (error) {
      logger.error('skills', `Failed to load full skill content for ${name}`, { error })
      return undefined
    }
  }
  
  // Get skill descriptions for LLM context (Level 1)
  getSkillsDescription(): string {
    return Array.from(this.skillMetadata.values())
      .map(s => `- ${s.name}: ${s.description}`)
      .join('\n')
  }
  
  // Parse LLM response for skill calls
  parseSkillCalls(response: string): Array<{ name: string; params: Record<string, unknown> }> {
    const skillCalls: Array<{ name: string; params: Record<string, unknown> }> = []
    
    // Look for <skill name="skillName">params</skill> pattern
    const skillRegex = /<skill\s+name="([^"]+)">([\s\S]*?)<\/skill>/g
    let match
    
    while ((match = skillRegex.exec(response)) !== null) {
      const [, name, paramsStr] = match
      
      try {
        // Try to parse params as JSON
        const params = paramsStr.trim() ? JSON.parse(paramsStr) : {}
        skillCalls.push({ name, params })
      } catch (e) {
        // If not JSON, treat as simple text
        skillCalls.push({ name, params: { text: paramsStr.trim() } })
      }
    }
    
    return skillCalls
  }
  
  // Execute a skill
  async executeSkill(
    skillName: string, 
    params: Record<string, unknown>, 
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    if (!this.initialized) {
      await this.init()
    }

    // Load full skill on demand (Level 2 disclosure)
    const skill = await this.getFullSkill(skillName)
    if (!skill) {
      return {
        success: false,
        error: `Skill not found: ${skillName}`
      }
    }

    try {
      // Find Python code blocks (prefer converted if available)
      const pythonBlock = skill.codeBlocks.find((block: CodeBlock) => 
        block.language === 'python' || block.converted
      )

      if (!pythonBlock) {
        return {
          success: false,
          error: `No Python code found in skill: ${skillName}`
        }
      }

      // Use converted code if available
      let pythonCode = pythonBlock.converted || pythonBlock.code

      // Interpolate parameters
      pythonCode = this.interpolateParams(pythonCode, params)

      // Execute in Python runtime
      let outputResult = ''
      let errorResult: string | undefined

      // Create a promise to capture the output with proper race condition handling
      const executionPromise = new Promise<void>((resolve, reject) => {
        const originalOutputHandler = context.pythonRuntime.onOutput
        let hasResolved = false

        // Set handler BEFORE executing
        context.pythonRuntime.onOutput = (output: PythonOutput) => {
          if (output.type === 'log' && output.message) {
            outputResult += output.message + '\n'
          } else if (output.type === 'error' && output.message) {
            errorResult = output.message
            // Resolve immediately on error - don't wait for complete
            if (!hasResolved) {
              hasResolved = true
              resolve()
            }
          } else if (output.type === 'complete') {
            if (!hasResolved) {
              hasResolved = true
              resolve()
            }
          }
        }

        // Execute the code with proper error handling
        context.pythonRuntime.execute(pythonCode)
          .catch((err: unknown) => {
            if (!hasResolved) {
              hasResolved = true
              errorResult = err instanceof Error ? err.message : String(err)
              reject(err)
            }
          })
          .finally(() => {
            // Always restore original handler
            context.pythonRuntime.onOutput = originalOutputHandler
          })
      })

      // Wait for execution with timeout (configurable, default 30 seconds)
      const timeoutMs = context.timeout || 30000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Skill execution timeout after ${timeoutMs}ms`)), timeoutMs)
      })

      // Race the execution against timeout with proper cleanup
      await Promise.race([executionPromise, timeoutPromise])

      return {
        success: !errorResult,
        output: outputResult || '',
        pythonCode,
        error: errorResult
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Interpolate parameters into code
  private interpolateParams(code: string, params: Record<string, unknown>): string {
    let result = code
    
    for (const [key, value] of Object.entries(params)) {
      const placeholder = `{{${key}}}`
      
      if (typeof value === 'string') {
        result = result.replace(
          new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'),
          `'${value.replace(/'/g, "\\'")}'`
        )
      } else {
        result = result.replace(
          new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'),
          JSON.stringify(value)
        )
      }
    }
    
    return result
  }
  
  // Install a skill from storage
  async installSkill(skillName: string): Promise<void> {
    const stored = await skillStorage.getSkill(skillName)
    if (!stored) {
      throw new Error(`Skill not found in storage: ${skillName}`)
    }
    
    const parsed = SkillsParser.parse(stored.content)
    this.registerSkill(parsed)
  }
  
  // Uninstall a skill
  async uninstallSkill(skillName: string): Promise<void> {
    this.skillMetadata.delete(skillName)
    this.loadedSkills.delete(skillName)
    await skillStorage.deleteSkill(skillName)
  }
}

// Export singleton instance
export const skillsEngine = new SkillsEngine()
