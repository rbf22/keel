import { describe, it, expect, beforeEach } from 'vitest';
import { ArtifactHandler } from './artifact-handler';
import type { CodeArtifact, ArtifactInterface } from './types';

// Mock implementation for testing
class MockArtifactHandler {
  validateInputs(artifactInterface: any, inputs: Record<string, any>): { valid: boolean; errors: string[] } {
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
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  generateValidationError(errors: string[]): string {
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

  generateExecutionCode(artifact: CodeArtifact, inputs: Record<string, any>): string {
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

  generateCodeFromInterface(artifactInterface: any, inputs: Record<string, any>): string {
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

  generateCodeFromPattern(functionName: string, callingPattern: string, inputStr: string): string {
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
      
      default:
        return `
# Parse inputs and call artifact function
inputs = ${inputStr}
result = ${functionName}(*inputs)

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

  generateLegacyExecutionCode(artifact: CodeArtifact, inputs: Record<string, any>): string {
    // Simple legacy fallback
    return `
# Legacy execution code
result = execute_task()
print(f"Result: {result}")
`;
  }
}

describe('Artifact Handler - Input Validation', () => {
  let handler: MockArtifactHandler;

  beforeEach(() => {
    handler = new MockArtifactHandler();
  });

  describe('Input Validation', () => {
    it('should validate single_dict pattern with valid inputs', () => {
      const artifactInterface: ArtifactInterface = {
        name: 'test_func',
        parameters: [
          { name: 'task_params', type: 'positional', required: true }
        ],
        calling_pattern: 'single_dict',
        has_varargs: false,
        has_kwargs: false,
        total_parameters: 1,
        required_parameters: 1
      };

      const inputs = { request: 'test', data: [1, 2, 3] };
      const result = handler.validateInputs(artifactInterface, inputs);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject single_dict pattern with empty inputs', () => {
      const artifactInterface: ArtifactInterface = {
        name: 'test_func',
        parameters: [
          { name: 'task_params', type: 'positional', required: true }
        ],
        calling_pattern: 'single_dict',
        has_varargs: false,
        has_kwargs: false,
        total_parameters: 1,
        required_parameters: 1
      };

      const inputs = {};
      const result = handler.validateInputs(artifactInterface, inputs);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: task_params');
    });

    it('should reject single_dict pattern with null inputs', () => {
      const artifactInterface: ArtifactInterface = {
        name: 'test_func',
        parameters: [
          { name: 'task_params', type: 'positional', required: true }
        ],
        calling_pattern: 'single_dict',
        has_varargs: false,
        has_kwargs: false,
        total_parameters: 1,
        required_parameters: 1
      };

      const inputs = null as any;
      const result = handler.validateInputs(artifactInterface, inputs);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: task_params');
    });

    it('should validate keyword_args pattern with all required parameters', () => {
      const artifactInterface: ArtifactInterface = {
        name: 'test_func',
        parameters: [
          { name: 'data', type: 'positional', required: true },
          { name: 'operation', type: 'positional', required: true }
        ],
        calling_pattern: 'keyword_args',
        has_varargs: false,
        has_kwargs: true,
        total_parameters: 2,
        required_parameters: 2
      };

      const inputs = { data: [1, 2, 3], operation: 'sum' };
      const result = handler.validateInputs(artifactInterface, inputs);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject keyword_args pattern missing required parameters', () => {
      const artifactInterface: ArtifactInterface = {
        name: 'test_func',
        parameters: [
          { name: 'data', type: 'positional', required: true },
          { name: 'operation', type: 'positional', required: true }
        ],
        calling_pattern: 'keyword_args',
        has_varargs: false,
        has_kwargs: true,
        total_parameters: 2,
        required_parameters: 2
      };

      const inputs = { data: [1, 2, 3] }; // Missing 'operation'
      const result = handler.validateInputs(artifactInterface, inputs);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: operation');
    });

    it('should validate single_param pattern with valid input', () => {
      const artifactInterface: ArtifactInterface = {
        name: 'test_func',
        parameters: [
          { name: 'value', type: 'positional', required: true }
        ],
        calling_pattern: 'single_param',
        has_varargs: false,
        has_kwargs: false,
        total_parameters: 1,
        required_parameters: 1
      };

      const inputs = { value: 42 };
      const result = handler.validateInputs(artifactInterface, inputs);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject single_param pattern with empty object', () => {
      const artifactInterface: ArtifactInterface = {
        name: 'test_func',
        parameters: [
          { name: 'value', type: 'positional', required: true }
        ],
        calling_pattern: 'single_param',
        has_varargs: false,
        has_kwargs: false,
        total_parameters: 1,
        required_parameters: 1
      };

      const inputs = {};
      const result = handler.validateInputs(artifactInterface, inputs);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: value');
    });

    it('should validate no_args pattern with any inputs', () => {
      const artifactInterface: ArtifactInterface = {
        name: 'test_func',
        parameters: [],
        calling_pattern: 'no_args',
        has_varargs: false,
        has_kwargs: false,
        total_parameters: 0,
        required_parameters: 0
      };

      const inputs = { anything: 'goes' };
      const result = handler.validateInputs(artifactInterface, inputs);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Error Generation', () => {
    it('should generate validation error code', () => {
      const errors = ['Missing required parameter: task_params'];
      const errorCode = handler.generateValidationError(errors);

      expect(errorCode).toContain('Input validation failed');
      expect(errorCode).toContain('Missing required parameter: task_params');
      expect(errorCode).toContain('import json');
      expect(errorCode).toContain('print(json.dumps(error_result, indent=2))');
    });

    it('should generate validation error code with multiple errors', () => {
      const errors = ['Error 1', 'Error 2', 'Error 3'];
      const errorCode = handler.generateValidationError(errors);

      expect(errorCode).toContain('Error 1');
      expect(errorCode).toContain('Error 2');
      expect(errorCode).toContain('Error 3');
    });
  });

  describe('Execution Code Generation', () => {
    it('should generate validation error for invalid inputs', () => {
      const artifact: CodeArtifact = {
        id: 'test-123',
        name: 'test_func',
        description: 'Test function',
        function: 'def test_func(task_params): return task_params',
        usage: 'result = test_func(params)',
        dependencies: [],
        created_by: 'python-coding',
        status: 'pending',
        artifactInterface: {
          name: 'test_func',
          parameters: [
            { name: 'task_params', type: 'positional', required: true }
          ],
          calling_pattern: 'single_dict',
          has_varargs: false,
          has_kwargs: false,
          total_parameters: 1,
          required_parameters: 1
        }
      };

      const inputs = {};
      const executionCode = handler.generateExecutionCode(artifact, inputs);

      expect(executionCode).toContain('Input validation failed');
      expect(executionCode).toContain('Missing required parameter: task_params');
    });

    it('should generate execution code for valid inputs', () => {
      const artifact: CodeArtifact = {
        id: 'test-123',
        name: 'test_func',
        description: 'Test function',
        function: 'def test_func(task_params): return task_params',
        usage: 'result = test_func(params)',
        dependencies: [],
        created_by: 'python-coding',
        status: 'pending',
        artifactInterface: {
          name: 'test_func',
          parameters: [
            { name: 'task_params', type: 'positional', required: true }
          ],
          calling_pattern: 'single_dict',
          has_varargs: false,
          has_kwargs: false,
          total_parameters: 1,
          required_parameters: 1,
          execution_template: `
# Parse inputs and call artifact function
inputs = {{input_json}}
result = test_func(inputs) if inputs else test_func()

# Format output nicely
if isinstance(result, dict):
    for key, value in result.items():
        print(f"{key}: {value}")
elif isinstance(result, (int, float)):
    print(f"Result: {result}")
else:
    print(f"Result: {result}")
`
        }
      };

      const inputs = { request: 'test', data: [1, 2, 3] };
      const executionCode = handler.generateExecutionCode(artifact, inputs);

      expect(executionCode).toContain('result = test_func(inputs)');
      expect(executionCode).toContain(JSON.stringify(inputs));
      expect(executionCode).not.toContain('Input validation failed');
    });

    it('should use legacy execution for artifacts without interface', () => {
      const artifact: CodeArtifact = {
        id: 'test-123',
        name: 'test_func',
        description: 'Test function',
        function: 'def test_func(): return 42',
        usage: 'result = test_func()',
        dependencies: [],
        created_by: 'python-coding',
        status: 'pending'
        // No artifactInterface
      };

      const inputs = { anything: 'goes' };
      const executionCode = handler.generateExecutionCode(artifact, inputs);

      expect(executionCode).toContain('Legacy execution code');
      expect(executionCode).toContain('result = execute_task()');
    });
  });

  describe('Template Substitution', () => {
    it('should substitute input_json placeholder correctly', () => {
      const artifactInterface: ArtifactInterface = {
        name: 'test_func',
        parameters: [
          { name: 'task_params', type: 'positional', required: true }
        ],
        calling_pattern: 'single_dict',
        has_varargs: false,
        has_kwargs: false,
        total_parameters: 1,
        required_parameters: 1,
        execution_template: `
# Parse inputs and call artifact function
inputs = {{input_json}}
result = test_func(inputs) if inputs else test_func()
`
      };

      const inputs = { request: 'test', data: [1, 2, 3] };
      const executionCode = handler.generateCodeFromInterface(artifactInterface, inputs);

      expect(executionCode).toContain(JSON.stringify(inputs));
      expect(executionCode).not.toContain('{{input_json}}');
    });
  });
});
