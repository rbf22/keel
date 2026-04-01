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
  private readonly MAX_LOADED_SKILLS = 50
  private loadedSkillsOrder: string[] = []
  
  async init(): Promise<void> {
    logger.info('skills', 'Initializing SkillsEngine');
    // Load all stored skills metadata first (Level 1)
    const storedSkills = await skillStorage.getAllSkills()
    const failedSkills: string[] = []
    
    logger.info('skills', 'Loading stored skills metadata', { 
      totalStoredSkills: storedSkills.length 
    });
    
    for (const stored of storedSkills) {
      try {
        const metadata = SkillsParser.parseMetadata(stored.content)
        this.skillMetadata.set(stored.name, metadata)
        logger.debug('skills', 'Loaded skill metadata', { 
          skillName: stored.name,
          hasTags: !!metadata.tags,
          tagCount: metadata.tags?.length || 0
        });
      } catch (error) {
        const skillName = stored.name || 'unknown'
        logger.error('skills', `Failed to load skill metadata for ${skillName}`, { error })
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

  // Load skills from filesystem (for development)
  async loadSkillsFromFilesystem(): Promise<void> {
    // Discover all skill directories by fetching the skills index
    const response = await fetch('/keel/src/skills/index.json')
    if (!response.ok) {
      throw new Error(`Failed to load skills index: ${response.status}`)
    }
    
    const skillIndex = await response.json()
    logger.info('skills', 'Loading skills from index', { 
      skillCount: skillIndex.skills.length 
    })
    
    for (const skillPath of skillIndex.skills) {
      try {
        const skillResponse = await fetch(`/keel/src/skills/${skillPath}/SKILL.md`)
        if (!skillResponse.ok) {
          logger.warn('skills', `Failed to load skill ${skillPath}`, { 
            status: skillResponse.status 
          })
          continue
        }
        
        const content = await skillResponse.text()
        const skill = SkillsParser.parse(content)
        this.registerSkill(skill)
        
        logger.info('skills', `Loaded skill from filesystem: ${skill.name}`)
      } catch (error) {
        logger.error('skills', `Failed to load skill ${skillPath} from filesystem`, { error })
      }
    }
  }
  
  // Register a skill
  registerSkill(skill: ParsedSkill): void {
    this.skillMetadata.set(skill.name, {
      name: skill.name,
      description: skill.description,
      tags: skill.tags,
      metadata: skill.metadata
    })
    this.addToLoadedSkills(skill.name, skill)
  }

  private addToLoadedSkills(name: string, skill: ParsedSkill): void {
    if (this.loadedSkills.has(name)) {
      // Move to end of order to mark as recently used
      this.loadedSkillsOrder = this.loadedSkillsOrder.filter(n => n !== name)
    } else if (this.loadedSkills.size >= this.MAX_LOADED_SKILLS) {
      // Remove least recently used
      const lruName = this.loadedSkillsOrder.shift()
      if (lruName) {
        this.loadedSkills.delete(lruName)
      }
    }
    
    this.loadedSkills.set(name, skill)
    this.loadedSkillsOrder.push(name)
  }
  
  // Get all available skills (metadata only for Level 1 disclosure)
  getAvailableSkillsMetadata(): SkillMetadata[] {
    return Array.from(this.skillMetadata.values())
  }

  // Get full skill (loads from storage if needed - Level 2 disclosure)
  async getFullSkill(name: string): Promise<ParsedSkill | undefined> {
    if (this.loadedSkills.has(name)) {
      // Mark as recently used
      const skill = this.loadedSkills.get(name)!
      this.loadedSkillsOrder = this.loadedSkillsOrder.filter(n => n !== name)
      this.loadedSkillsOrder.push(name)
      return skill
    }

    const stored = await skillStorage.getSkill(name)
    if (!stored) return undefined

    try {
      const parsed = SkillsParser.parse(stored.content)
      // IMPORTANT: Add resources from stored skill (Level 3 disclosure)
      if (stored.resources) {
        parsed.resources = stored.resources
      }
      this.addToLoadedSkills(name, parsed)
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
    logger.info('skills', 'Skill execution requested', { 
      skillName,
      paramCount: Object.keys(params).length,
      paramNames: Object.keys(params),
      hasUserMessage: !!context.userMessage,
      hasConversationHistory: !!context.conversationHistory,
      timeout: context.timeout
    });
    
    if (!this.initialized) {
      logger.debug('skills', 'SkillsEngine not initialized, initializing now');
      await this.init()
    }

    // Load full skill on demand (Level 2 disclosure)
    const skill = await this.getFullSkill(skillName)
    if (!skill) {
      logger.error('skills', 'Skill not found', { skillName });
      return {
        success: false,
        error: `Skill not found: ${skillName}`
      }
    }

    logger.debug('skills', 'Found skill', { 
      skillName,
      hasInstructions: !!skill.instructions,
      codeBlockCount: skill.codeBlocks.length,
      hasTags: !!skill.tags
    });

    try {
      // Find Python code blocks (prefer converted if available)
      const pythonBlock = skill.codeBlocks.find((block: CodeBlock) => 
        block.language === 'python' || block.converted
      )

      if (!pythonBlock) {
        logger.error('skills', 'No Python code found in skill', { 
          skillName,
          availableLanguages: skill.codeBlocks.map(b => b.language)
        });
        return {
          success: false,
          error: `No Python code found in skill: ${skillName}`
        }
      }

      logger.debug('skills', 'Found Python code block', { 
        skillName,
        isConverted: !!pythonBlock.converted,
        codeLength: pythonBlock.code.length
      });

      // Use converted code if available
      let pythonCode = pythonBlock.converted || pythonBlock.code

      // Interpolate parameters
      pythonCode = this.interpolateParams(pythonCode, params)
      logger.debug('skills', 'Parameters interpolated', { 
        skillName,
        finalCodeLength: pythonCode.length
      });

      // Execute in Python runtime with resources (Level 3 disclosure)
      let outputResult = ''
      let errorResult: string | undefined

      // Use a temporary output handler to capture the output with proper race condition handling
      logger.info('skills', 'Starting Python execution for skill', { 
        skillName,
        codeLength: pythonCode.length,
        hasResources: !!skill.resources,
        timeoutMs: context.timeout || 30000
      });
      
      const executionPromise = context.pythonRuntime.executeWithTemporaryOutput(
        (output: PythonOutput) => {
          logger.debug('skills', `Python output: ${output.type}`, { 
            skillName,
            outputType: output.type,
            hasMessage: !!output.message
          });
          
          if (output.type === 'log' && output.message) {
            outputResult += output.message + '\n'
          } else if (output.type === 'error' && output.message) {
            logger.warn('skills', 'Python execution error', { 
              skillName,
              errorMessage: output.message 
            });
            errorResult = output.message
          }
        },
        async () => {
          try {
            await context.pythonRuntime.execute(pythonCode, skill.resources);
          } catch (err: unknown) {
            errorResult = err instanceof Error ? err.message : String(err);
            logger.error('skills', 'Python execution threw error', { 
              skillName,
              error: errorResult
            });
            throw err;
          }
        }
      );

      // Wait for execution with timeout (configurable, default 30 seconds)
      const timeoutMs = context.timeout || 30000;
      logger.debug('skills', 'Setting up execution timeout', { skillName, timeoutMs });
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          logger.error('skills', 'Skill execution timed out', { skillName, timeoutMs });
          reject(new Error(`Skill execution timeout after ${timeoutMs}ms`))
        }, timeoutMs)
      })

      // Race the execution against timeout with proper cleanup
      await Promise.race([executionPromise, timeoutPromise])

      const result = {
        success: !errorResult,
        output: outputResult || '',
        pythonCode,
        error: errorResult
      };
      
      logger.info('skills', 'Skill execution completed', { 
        skillName,
        success: result.success,
        hasOutput: !!result.output,
        outputLength: result.output.length,
        hasError: !!result.error,
        pythonCodeLength: pythonCode.length
      });
      
      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('skills', 'Skill execution failed with exception', { 
        skillName,
        error: errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown'
      });
      
      return {
        success: false,
        error: errorMessage
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
    this.loadedSkillsOrder = this.loadedSkillsOrder.filter(n => n !== skillName)
    await skillStorage.deleteSkill(skillName)
  }

  // Check if skill exists
  hasSkill(name: string): boolean {
    return this.skillMetadata.has(name)
  }

  // Get skill names
  getSkillNames(): string[] {
    return Array.from(this.skillMetadata.keys())
  }

  // Get skills by tag (Level 1)
  getByTag(tag: string): SkillMetadata[] {
    return Array.from(this.skillMetadata.values()).filter(metadata =>
      metadata.tags?.includes(tag)
    )
  }

  // Search skills (Level 1)
  search(query: string): SkillMetadata[] {
    const lowerQuery = query.toLowerCase()
    return Array.from(this.skillMetadata.values()).filter(metadata =>
      metadata.name.toLowerCase().includes(lowerQuery) ||
      metadata.description.toLowerCase().includes(lowerQuery) ||
      metadata.tags?.some((t: string) => t.toLowerCase().includes(lowerQuery))
    )
  }

  // Get skill count
  count(): number {
    return this.skillMetadata.size
  }

  // Reload all skills from storage
  async reload(): Promise<void> {
    this.skillMetadata.clear()
    this.loadedSkills.clear()
    this.loadedSkillsOrder = []
    this.initialized = false
    await this.init()
  }
}

// Export singleton instance
export const skillsEngine = new SkillsEngine()
