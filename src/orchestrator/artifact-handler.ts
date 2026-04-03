import { logger } from "../logger";
import { PythonRuntime } from "../python-runtime";
import { CodeArtifact } from "./types";
import { storage } from "../storage";
import { SkillManager } from "./skill-manager";
import { ChatCompletionMessageParam } from "@mlc-ai/web-llm";

export class ArtifactHandler {
  private python: PythonRuntime;
  private skillManager: SkillManager;

  constructor(python: PythonRuntime, skillManager: SkillManager) {
    this.python = python;
    this.skillManager = skillManager;
  }

  /**
   * Execute an approved code artifact with user inputs
   */
  async executeArtifact(artifact: CodeArtifact, userRequest: string, chatHistory: ChatCompletionMessageParam[] = []): Promise<string> {
    logger.info("orchestrator", `Executing artifact ${artifact.id} for user request`);
    
    try {
      const executionInputs = await this.extractInputsFromRequest(userRequest, artifact, chatHistory);
      const fullCode = `
# Artifact function
${artifact.function}

# Execution with extracted inputs
${this.generateExecutionCode(artifact, executionInputs)}
`;
      
      const artifactPath = `keel://artifacts/${artifact.id || 'unnamed'}.py`;
      
      // Save code to VFS for persistence and visibility
      await storage.writeFile(artifactPath, fullCode);
      
      // Execute using Python runtime with output capturing
      let outputResult = '';
      await this.python.executeWithTemporaryOutput(
        (output) => {
          if (output.type === 'log' && output.message) {
            outputResult += output.message + '\n';
          }
        },
        async () => {
          await this.python.execute(fullCode);
        }
      );
      
      return outputResult.trim() || "Execution completed but no output captured";
    } catch (error) {
      logger.error("orchestrator", `Failed to execute artifact ${artifact.id}`, { error });
      return `Error executing artifact: ${error}`;
    }
  }

  /**
   * Extract inputs from user request using LLM-driven parameter analysis
   */
  private async extractInputsFromRequest(request: string, _artifact: CodeArtifact, chatHistory: ChatCompletionMessageParam[] = []): Promise<Record<string, any>> {
    try {
      logger.info("orchestrator", "Using LLM-driven parameter analysis");
      
      // Use parameter-analyzer skill for intelligent parameter extraction
      const analysisResult = await this.skillManager.executeSkill(
        'parameter-analyzer', 
        { task: request }, 
        chatHistory
      );
      
      const analysis = JSON.parse(analysisResult.output);
      
      // Handle clarifications if needed
      if (analysis.clarifications_needed && analysis.clarifications_needed.length > 0) {
        logger.warn("orchestrator", "Parameter analysis needs clarification", { 
          clarifications: analysis.clarifications_needed 
        });
        
        // For now, proceed with extracted parameters despite clarifications
        // In a full implementation, we would ask the user for clarification
      }
      
      // Convert structured parameters to simple format for execution
      const inputs: Record<string, any> = {};
      
      // Handle both old format (direct parameters) and new format (structured parameters)
      if (analysis.parameters && typeof analysis.parameters === 'object') {
        // New structured format
        for (const [key, paramInfo] of Object.entries(analysis.parameters)) {
          if (typeof paramInfo === 'object' && paramInfo !== null && 'value' in paramInfo) {
            inputs[key] = (paramInfo as any).value;
          }
        }
      } else {
        // Legacy format - handle direct key-value pairs
        for (const [key, value] of Object.entries(analysis)) {
          if (!['confidence', 'clarifications_needed', 'reasoning'].includes(key)) {
            inputs[key] = value;
          }
        }
      }
      
      // Always include the original request for context
      inputs.request = request;
      inputs.analysis_confidence = analysis.confidence || 0.3;
      inputs.analysis_reasoning = analysis.reasoning || "Parameter analysis completed";
      
      // Maintain backward compatibility with numbers array
      const numberValues = Object.values(inputs).filter(v => typeof v === 'number');
      if (numberValues.length > 0) {
        inputs.numbers = numberValues;
      }
      
      logger.info("orchestrator", "Parameter analysis completed", { 
        parameterCount: Object.keys(inputs).length,
        confidence: analysis.confidence
      });
      
      return inputs;
      
    } catch (error) {
      logger.error("orchestrator", "LLM parameter analysis failed, using fallback", { error });
      
      // Fallback to basic parameter extraction
      return this.fallbackParameterExtraction(request);
    }
  }

  /**
   * Fallback parameter extraction for when LLM analysis fails
   */
  private fallbackParameterExtraction(request: string): Record<string, any> {
    const inputs: Record<string, any> = {
      parameters: {},
      confidence: 0.3,
      clarifications_needed: [],
      reasoning: "Fallback parameter extraction used"
    };
    
    // Basic number extraction
    const numbers = request.match(/-?\d+(\.\d+)?/g);
    if (numbers) {
      const numValues = numbers.map(Number);
      
      // Extract semantic meaning from the request
      const requestLower = request.toLowerCase();
      
      // Determine parameter names based on context
      if (requestLower.includes('cat') && requestLower.includes('dog')) {
        // Animal weight calculation
        inputs.parameters = {
          'cat_weight': { value: numValues[0] || 4.5, type: 'number', unit: 'kg' },
          'dog_weight': { value: numValues[1] || 20, type: 'number', unit: 'kg' }
        };
        inputs.reasoning = "Detected animal weight comparison calculation";
      } else if (requestLower.includes('weight') || requestLower.includes('difference')) {
        // Generic weight/difference calculation
        inputs.parameters = {
          'param_1': { value: numValues[0] || 0, type: 'number' },
          'param_2': { value: numValues[1] || 0, type: 'number' }
        };
        inputs.reasoning = "Detected mathematical difference calculation";
      } else {
        // Generic parameters
        numValues.forEach((num, index) => {
          inputs.parameters[`param_${index + 1}`] = { 
            value: num, 
            type: 'number' 
          };
        });
        inputs.reasoning = "Extracted numeric parameters from request";
      }
      
      // Add numbers array for backward compatibility
      inputs.numbers = numValues;
    } else {
      // No numbers found - create empty parameter structure
      inputs.parameters = {
        'task_params': { value: request, type: 'string' }
      };
      inputs.reasoning = "No numeric parameters found, using task as parameter";
    }
    
    // Pass the original request for context
    inputs.request = request;
    
    return inputs;
  }

  /**
   * Generate Python execution code for an artifact
   */
  private generateExecutionCode(artifact: CodeArtifact, inputs: Record<string, any>): string {
    // Validate inputs if artifact has self-documenting interface
    if (artifact.artifactInterface) {
      const validation = this.validateInputs(artifact.artifactInterface, inputs);
      if (!validation.valid) {
        // Return error code instead of execution code
        return this.generateValidationError(validation.errors);
      }
      return this.generateCodeFromInterface(artifact.artifactInterface, inputs);
    }
    
    // Fallback to legacy parsing for artifacts without interfaces
    return this.generateLegacyExecutionCode(artifact, inputs);
  }

  /**
   * Validate inputs against interface requirements
   */
  private validateInputs(artifactInterface: any, inputs: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check required parameters
    const requiredParams = artifactInterface.parameters.filter((p: any) => p.required);
    for (const param of requiredParams) {
      if (artifactInterface.calling_pattern === 'single_dict' && param.name === 'task_params') {
        if (!inputs || Object.keys(inputs).length === 0) {
          errors.push(`Missing required parameter: ${param.name}`);
        }
      } else if (artifactInterface.calling_pattern === 'keyword_args') {
        if (!(param.name in inputs)) {
          errors.push(`Missing required parameter: ${param.name}`);
        }
      } else if (artifactInterface.calling_pattern === 'positional') {
        // For positional, check if we have enough inputs
        if (Array.isArray(inputs) && inputs.length <= artifactInterface.parameters.indexOf(param)) {
          errors.push(`Missing required positional parameter: ${param.name}`);
        }
      } else if (artifactInterface.calling_pattern === 'single_param') {
        if (!inputs || (typeof inputs === 'object' && Object.keys(inputs).length === 0)) {
          errors.push(`Missing required parameter: ${param.name}`);
        }
      }
    }
    
    // Check for unexpected parameters (for strict patterns)
    if (artifactInterface.calling_pattern === 'single_dict') {
      const expectedParam = artifactInterface.parameters.find((p: any) => p.name === 'task_params');
      if (expectedParam && inputs && typeof inputs === 'object') {
        const inputKeys = Object.keys(inputs);
        // Allow common metadata keys
        const allowedKeys = ['request', 'analysis_confidence', 'analysis_reasoning', 'numbers'];
        const unexpectedKeys = inputKeys.filter(key => !allowedKeys.includes(key));
        if (unexpectedKeys.length > 0) {
          // This is just a warning, not an error
          console.warn(`Unexpected parameters found: ${unexpectedKeys.join(', ')}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate validation error code
   */
  private generateValidationError(errors: string[]): string {
    const errorJson = JSON.stringify({
      error: 'Input validation failed',
      details: errors
    });
    
    return `
# Input validation failed
import json
error_result = ${errorJson}
print(json.dumps(error_result, indent=2))
`;
  }

  /**
   * Generate execution code using self-documenting interface
   */
  private generateCodeFromInterface(artifactInterface: any, inputs: Record<string, any>): string {
    const inputStr = JSON.stringify(inputs);
    const executionTemplate = artifactInterface.execution_template;
    
    if (executionTemplate) {
      // Use the artifact-provided execution template
      return executionTemplate.replace('{input_json}', inputStr);
    }
    
    // Fallback: generate code based on calling pattern
    const callingPattern = artifactInterface.calling_pattern || 'single_dict';
    const functionName = artifactInterface.name || 'execute_task';
    
    return this.generateCodeFromPattern(functionName, callingPattern, inputStr);
  }

  /**
   * Generate execution code based on calling pattern
   */
  private generateCodeFromPattern(functionName: string, callingPattern: string, inputStr: string): string {
    switch (callingPattern) {
      case 'single_dict':
        return `
# Parse inputs and call artifact function
inputs = ${inputStr}
result = ${functionName}(inputs) if inputs else ${functionName}()

# Format output nicely
if isinstance(result, dict):
    for key, value in result.items():
        print(f"{key}: {value}")
elif isinstance(result, (int, float)):
    print(f"Result: {result}")
else:
    print(f"Result: {result}")
`;
      
      case 'keyword_args':
        return `
# Parse inputs and call artifact function
inputs = ${inputStr}
result = ${functionName}(**inputs) if inputs else ${functionName}()

# Format output nicely
if isinstance(result, dict):
    for key, value in result.items():
        print(f"{key}: {value}")
elif isinstance(result, (int, float)):
    print(f"Result: {result}")
else:
    print(f"Result: {result}")
`;
      
      case 'no_args':
        return `
# Call artifact function (no arguments)
result = ${functionName}()

# Format output nicely
if isinstance(result, dict):
    for key, value in result.items():
        print(f"{key}: {value}")
elif isinstance(result, (int, float)):
    print(f"Result: {result}")
else:
    print(f"Result: {result}")
`;
      
      case 'single_param':
        return `
# Parse inputs and call artifact function
inputs = ${inputStr}
# Extract the single parameter (try common keys or use first value)
param_value = None
if isinstance(inputs, dict):
    # Try common parameter names
    for key in ['value', 'param', 'input', 'data']:
        if key in inputs:
            param_value = inputs[key]
            break
    # If no common key found, use first value
    if param_value is None and inputs:
        param_value = next(iter(inputs.values()))
elif inputs is not None:
    param_value = inputs

result = ${functionName}(param_value) if param_value is not None else ${functionName}()

# Format output nicely
if isinstance(result, dict):
    for key, value in result.items():
        print(f"{key}: {value}")
elif isinstance(result, (int, float)):
    print(f"Result: {result}")
else:
    print(f"Result: {result}")
`;
      
      default: // positional
        return `
# Parse inputs and call artifact function
inputs = ${inputStr}
# Map inputs to positional parameters (basic implementation)
positional_args = []
if isinstance(inputs, dict):
    # This is a simplified mapping - in a real implementation,
    # you'd want more sophisticated parameter matching
    for key in sorted(inputs.keys()):
        positional_args.append(inputs[key])
elif inputs is not None:
    positional_args = [inputs]

result = ${functionName}(*positional_args)

# Format output nicely
if isinstance(result, dict):
    for key, value in result.items():
        print(f"{key}: {value}")
elif isinstance(result, (int, float)):
    print(f"Result: {result}")
else:
    print(f"Result: {result}")
`;
    }
  }

  /**
   * Legacy execution code generation for artifacts without interfaces
   */
  private generateLegacyExecutionCode(artifact: CodeArtifact, inputs: Record<string, any>): string {
    // Extract function name and signature from the artifact's function definition
    let fnName = 'execute_task'; // default fallback
    let paramNames: string[] = [];
    let hasKeywordArgs = false;
    
    if (artifact.function) {
      const functionMatch = artifact.function.match(/def\s+(\w+)\s*\(([^)]*)\)/);
      if (functionMatch && functionMatch[1]) {
        fnName = functionMatch[1];
        
        // Parse parameter names from signature
        const paramStr = functionMatch[2].trim();
        if (paramStr) {
          // Extract parameter names (ignore type hints and default values)
          const params = paramStr.split(',').map(p => p.trim().split(':')[0].split('=')[0].trim());
          paramNames = params.filter(p => p && p !== 'self');
        }
      }
    }
    
    // Determine if function accepts keyword arguments (common for generated functions)
    hasKeywordArgs = artifact.function?.includes('**') || artifact.function?.includes('task_params') || paramNames.length === 0;
    
    const inputStr = JSON.stringify(inputs);
    
    if (hasKeywordArgs || paramNames.length === 0) {
      // Function accepts keyword arguments or has no parameters
      if (artifact.function?.includes('task_params') && paramNames.length === 1 && paramNames[0] === 'task_params') {
        // Special case: function expects single task_params parameter
        return `
# Parse inputs and call artifact function
inputs = ${inputStr}
result = ${fnName}(inputs) if inputs else ${fnName}()

# Format output nicely
if isinstance(result, dict):
    for key, value in result.items():
        print(f"{key}: {value}")
elif isinstance(result, (int, float)):
    print(f"Result: {result}")
else:
    print(f"Result: {result}")
`;
      } else {
        // Function accepts keyword arguments or has no parameters
        return `
# Parse inputs and call artifact function
inputs = ${inputStr}
result = ${fnName}(**inputs) if inputs else ${fnName}()

# Format output nicely
if isinstance(result, dict):
    for key, value in result.items():
        print(f"{key}: {value}")
elif isinstance(result, (int, float)):
    print(f"Result: {result}")
else:
    print(f"Result: {result}")
`;
      }
    } else {
      // Function expects positional arguments - try to match parameters
      const positionalArgs = paramNames.map((param, index) => {
        // Try to find matching input key or use index
        if (param === 'task_params') {
          return 'inputs';
        } else if (inputs[param] !== undefined) {
          return `inputs["${param}"]`;
        } else if (Array.isArray(inputs.numbers) && index < inputs.numbers.length) {
          return `inputs["numbers"][${index}]`;
        } else {
          return `inputs.get("${param}", ${index < inputs.numbers?.length ? inputs.numbers[index] : 'None'})`;
        }
      });
      
      return `
# Parse inputs and call artifact function
inputs = ${inputStr}
result = ${fnName}(${positionalArgs.join(', ')})

# Format output nicely
if isinstance(result, dict):
    for key, value in result.items():
        print(f"{key}: {value}")
elif isinstance(result, (int, float)):
    print(f"Result: {result}")
else:
    print(f"Result: {result}")
`;
    }
  }

  /**
   * Enhanced artifact command handling for persistent context
   */
  async handleArtifactCommand(userRequest: string, artifacts: CodeArtifact[] = [], chatHistory: ChatCompletionMessageParam[] = []): Promise<string | null> {
    const requestLower = userRequest.toLowerCase();
    
    if (requestLower.includes('list artifacts') || requestLower.includes('show all artifacts')) {
      if (artifacts.length === 0) return "No artifacts have been created in this session.";
      return "Current session artifacts:\n" + artifacts.map(a => `- ${a.id}: ${a.name} (${a.status})`).join('\n');
    }
    
    if (requestLower.includes('run artifact') || requestLower.includes('execute artifact')) {
      const match = userRequest.match(/(run|execute) artifact ([\w-]+)/i);
      if (match) {
        const artifactId = match[2];
        const artifact = artifacts.find(a => a.id === artifactId);
        if (!artifact) return `Artifact '${artifactId}' not found.`;
        if (artifact.status !== 'approved') return `Artifact '${artifactId}' is not approved for execution (current status: ${artifact.status}).`;
        return await this.executeArtifact(artifact, userRequest, chatHistory);
      }
    }
    
    return null;
  }
}
