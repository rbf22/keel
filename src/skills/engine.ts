import { PythonRuntime, type PythonOutput } from '../python-runtime'
import { skillStorage } from '../storage/skills'
import { SkillsParser, ParsedSkill, type CodeBlock } from './parser'
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
  private skills = new Map<string, ParsedSkill>()
  private initialized = false
  
  async init(): Promise<void> {
    // Load all stored skills
    const storedSkills = await skillStorage.getAllSkills()
    const failedSkills: string[] = []
    
    for (const stored of storedSkills) {
      try {
        const parsed = SkillsParser.parse(stored.content)
        this.skills.set(stored.name, parsed)
      } catch (error) {
        const skillName = stored.name || 'unknown'
        console.error(`Failed to load skill ${skillName}:`, error)
        failedSkills.push(skillName)
      }
    }
    
    this.initialized = true
    
    // Log summary of initialization
    if (failedSkills.length > 0) {
      logger.warn('skills', 'Some skills failed to load', {
        totalSkills: storedSkills.length,
        failedCount: failedSkills.length,
        failedSkills
      })
    }
    
    logger.info('skills', 'Skills engine initialized', {
      totalLoaded: this.skills.size,
      totalFailed: failedSkills.length
    })
  }
  
  // Register built-in skills
  registerBuiltInSkills(): void {
    // Calculator skill
    this.registerSkill({
      name: 'calculator',
      description: 'Perform mathematical calculations and evaluations',
      content: `---\nname: calculator\ndescription: Perform mathematical calculations and evaluations\n---\n\nUse this skill when you need to:\n- Calculate mathematical expressions\n- Evaluate formulas\n- Perform numeric computations\n\nSimply provide the expression to evaluate.`,
      instructions: `Use this skill when you need to:\n- Calculate mathematical expressions\n- Evaluate formulas\n- Perform numeric computations\n\nSimply provide the expression to evaluate.`,
      codeBlocks: [{
        language: 'python',
        code: `# Calculator skill
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
    print(f"Error: {e}")`
      }]
    })
    
    // Data analysis skill
    this.registerSkill({
      name: 'analyze_data',
      description: 'Analyze data using pandas and create summaries',
      content: `---\nname: analyze_data\ndescription: Analyze data using pandas and create summaries\n---\n\nUse this skill when you need to:\n- Analyze CSV or JSON data\n- Generate data summaries\n- Perform statistical analysis\n- Understand data structure`,
      instructions: `Use this skill when you need to:\n- Analyze CSV or JSON data\n- Generate data summaries\n- Perform statistical analysis\n- Understand data structure`,
      codeBlocks: [{
        language: 'python',
        code: `# Data analysis skill\nimport pandas as pd\nimport json\nimport io\n\n# Parse data\ndata = {{data}}\n\nif isinstance(data, str):\n    try:\n        df = pd.read_json(data)\n    except:\n        df = pd.read_csv(io.StringIO(data))\nelse:\n    df = pd.DataFrame(data)\n\nprint("Data Shape:", df.shape)\nprint("\\nColumns:", list(df.columns))\nprint("\\nFirst 5 rows:")\nprint(df.head())\nprint("\\nData types:")\nprint(df.dtypes)\nprint("\\nDescriptive statistics:")\nprint(df.describe())`
      }]
    })
    
    // Chart creation skill
    this.registerSkill({
      name: 'create_chart',
      description: 'Create various types of charts from data',
      content: `---\nname: create_chart\ndescription: Create various types of charts from data\n---\n\nUse this skill when you need to:\n- Create bar charts\n- Create line charts\n- Create pie charts\n- Create scatter plots\n- Visualize data relationships`,
      instructions: `Use this skill when you need to:\n- Create bar charts\n- Create line charts\n- Create pie charts\n- Create scatter plots\n- Visualize data relationships`,
      codeBlocks: [{
        language: 'python',
        code: `# Chart creation skill\nimport matplotlib.pyplot as plt\nimport json\nimport io\nimport base64\n\n# Parse data\ndata = {{data}}\nchart_type = "{{chart_type}}"\ntitle = data.get('title', 'Chart')\n\nplt.figure(figsize=(10, 6))\n\nif chart_type == "bar":\n    plt.bar(data['labels'], data['values'])\nelif chart_type == "line":\n    plt.plot(data['labels'], data['values'])\nelif chart_type == "pie":\n    plt.pie(data['values'], labels=data['labels'], autopct='%1.1f%%')\nelif chart_type == "scatter":\n    plt.scatter(data['x'], data['y'])\n\nplt.title(title)\nplt.grid(True, alpha=0.3)\n\n# Save chart and return as base64\nbuf = io.BytesIO()\nplt.savefig(buf, format='png', dpi=150, bbox_inches='tight')\nbuf.seek(0)\nimg_base64 = base64.b64encode(buf.read()).decode()\nprint(f"Chart created: data:image/png;base64,{img_base64}")`
      }]
    })
  }
  
  // Register a skill
  registerSkill(skill: ParsedSkill): void {
    this.skills.set(skill.name, skill)
  }
  
  // Get all available skills
  getAvailableSkills(): ParsedSkill[] {
    return Array.from(this.skills.values())
  }
  
  // Get skill descriptions for LLM context
  getSkillsDescription(): string {
    return Array.from(this.skills.values())
      .map(s => `- ${s.name}: ${s.description}`)
      .join('\n')
  }
  
  // Parse LLM response for skill calls
  parseSkillCalls(response: string): Array<{ name: string; params: Record<string, any> }> {
    const skillCalls: Array<{ name: string; params: Record<string, any> }> = []
    
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
    params: Record<string, any>, 
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    if (!this.initialized) {
      await this.init()
    }
    
    const skill = this.skills.get(skillName)
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
          .catch((err) => {
            if (!hasResolved) {
              hasResolved = true
              errorResult = err instanceof Error ? err.message : 'Unknown execution error'
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
  private interpolateParams(code: string, params: Record<string, any>): string {
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
    this.skills.delete(skillName)
    await skillStorage.deleteSkill(skillName)
  }
}

// Export singleton instance
export const skillsEngine = new SkillsEngine()
