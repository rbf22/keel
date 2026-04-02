import { logger } from "../logger";
import { PythonRuntime } from "../python-runtime";
import { CodeArtifact } from "./types";
import { storage } from "../storage";

export class ArtifactHandler {
  private python: PythonRuntime;

  constructor(python: PythonRuntime) {
    this.python = python;
  }

  /**
   * Execute an approved code artifact with user inputs
   */
  async executeArtifact(artifact: CodeArtifact, userRequest: string): Promise<string> {
    logger.info("orchestrator", `Executing artifact ${artifact.id} for user request`);
    
    try {
      const executionInputs = this.extractInputsFromRequest(userRequest, artifact);
      const fullCode = `
# Artifact function
${artifact.function}

# Execution with extracted inputs
${this.generateExecutionCode(artifact, executionInputs)}
`;
      
      let outputResult = '';
      const artifactPath = `keel://artifacts/${artifact.id || 'unnamed'}.py`;
      
      // Save code to VFS for persistence and visibility
      await (this.python as any).executeWithTemporaryOutput ? 
        this.python.executeWithTemporaryOutput((output) => {
          if (output.message) outputResult += output.message + '\n';
        }, async () => {
          await storage.writeFile(artifactPath, fullCode);
          await this.python.execute(fullCode);
        }) : 
        (async () => {
          await storage.writeFile(artifactPath, fullCode);
          await this.python.execute(fullCode);
        })();
      
      return outputResult || "Execution completed but no output captured";
    } catch (error) {
      logger.error("orchestrator", `Failed to execute artifact ${artifact.id}`, { error });
      return `Error executing artifact: ${error}`;
    }
  }

  /**
   * Extract inputs from user request based on artifact type
   */
  private extractInputsFromRequest(request: string, artifact: CodeArtifact): Record<string, any> {
    const inputs: Record<string, any> = {};
    if (artifact.name.includes('sum') || artifact.name.includes('calculator')) {
      // Extract numbers for math operations
      const numbers = request.match(/-?\d+(\.\d+)?/g);
      if (numbers) {
        inputs.numbers = numbers.map(Number);
      }
    }
    return inputs;
  }

  /**
   * Generate Python execution code for an artifact
   */
  private generateExecutionCode(artifact: CodeArtifact, inputs: Record<string, any>): string {
    if (artifact.name.includes('sum')) {
      return `result = calculate_sum(${JSON.stringify(inputs.numbers || [])})\nprint(f"The sum is: {result}")`;
    } else if (artifact.name.includes('product')) {
      return `result = calculate_product(${JSON.stringify(inputs.numbers || [])})\nprint(f"The product is: {result}")`;
    } else if (artifact.name.includes('math_calculator')) {
      return `result = calculate('sum', ${JSON.stringify(inputs.numbers || [])})\nprint(f"Result: {result}")`;
    }
    
    const fnName = (artifact.id || artifact.name || 'unnamed_artifact').replace(/-/g, '_');
    const inputStr = JSON.stringify(inputs);
    return `
# Parse inputs and call artifact function
inputs = ${inputStr}
print(${fnName}(**inputs) if inputs else ${fnName}())
`;
  }

  /**
   * Enhanced artifact command handling for persistent context
   */
  async handleArtifactCommand(userRequest: string, artifacts: CodeArtifact[] = []): Promise<string | null> {
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
        return await this.executeArtifact(artifact, userRequest);
      }
    }
    
    return null;
  }
}
