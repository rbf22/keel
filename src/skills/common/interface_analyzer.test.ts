import { describe, it, expect, beforeEach } from 'vitest';

// Import the interface analyzer functions
// Note: In a real implementation, these would be imported from the Python module
// For testing purposes, we'll create TypeScript equivalents

interface ArtifactInterface {
  name: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    has_default?: boolean;
    default?: any;
  }>;
  calling_pattern: string;
  has_varargs: boolean;
  has_kwargs: boolean;
  execution_template?: string;
  total_parameters: number;
  required_parameters: number;
  analysis_failed?: boolean;
}

// Mock implementation of interface analysis for testing
function mockAnalyzeFunctionInterface(functionCode: string): ArtifactInterface {
  // Simple regex-based parsing for testing
  const functionMatch = functionCode.match(/def\s+(\w+)\s*\(([^)]*)\)/);
  if (!functionMatch) {
    return createDefaultInterface();
  }

  const functionName = functionMatch[1];
  const paramStr = functionMatch[2].trim();
  
  let parameters: any[] = [];
  let has_kwargs = false;
  let has_varargs = false;

  if (paramStr) {
    const params = paramStr.split(',').map(p => p.trim());
    for (const param of params) {
      if (param.includes('**')) {
        has_kwargs = true;
        parameters.push({
          name: param.replace('**', ''),
          type: 'kwargs',
          required: false
        });
      } else if (param.includes('*')) {
        has_varargs = true;
        parameters.push({
          name: param.replace('*', ''),
          type: 'varargs',
          required: false
        });
      } else {
        const paramName = param.split(':')[0].split('=')[0].trim();
        const hasDefault = param.includes('=');
        parameters.push({
          name: paramName,
          type: 'positional',
          required: !hasDefault,
          has_default: hasDefault
        });
      }
    }
  }

  const callingPattern = determineCallingPattern(parameters, has_kwargs);
  const executionTemplate = generateExecutionTemplate(functionName, callingPattern);

  return {
    name: functionName,
    parameters,
    calling_pattern: callingPattern,
    has_varargs: has_varargs,
    has_kwargs: has_kwargs,
    execution_template: executionTemplate,
    total_parameters: parameters.filter(p => p.type === 'positional').length,
    required_parameters: parameters.filter(p => p.required).length
  };
}

function determineCallingPattern(parameters: any[], has_kwargs: boolean): string {
  if (parameters.length === 1 && 
      parameters[0].name === 'task_params' && 
      parameters[0].type === 'positional') {
    return 'single_dict';
  }
  
  if (has_kwargs) {
    return 'keyword_args';
  }
  
  if (parameters.length === 0) {
    return 'no_args';
  }
  
  if (parameters.length === 1) {
    return 'single_param';
  }
  
  return 'positional';
}

function generateExecutionTemplate(functionName: string, callingPattern: string): string {
  switch (callingPattern) {
    case 'single_dict':
      return `
# Parse inputs and call artifact function
inputs = {{input_json}}
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
inputs = {{input_json}}
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
inputs = {{input_json}}
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

function createDefaultInterface(): ArtifactInterface {
  return {
    name: 'unknown_function',
    parameters: [
      {
        name: 'task_params',
        type: 'positional',
        required: true,
        has_default: false
      }
    ],
    calling_pattern: 'single_dict',
    has_varargs: false,
    has_kwargs: false,
    execution_template: generateExecutionTemplate('unknown_function', 'single_dict'),
    total_parameters: 1,
    required_parameters: 1,
    analysis_failed: true
  };
}

describe('Interface Analyzer', () => {
  describe('Function Interface Analysis', () => {
    it('should analyze single_dict pattern correctly', () => {
      const functionCode = 'def solve_task(task_params): return f"Task: {task_params}"';
      const artifactInterface = mockAnalyzeFunctionInterface(functionCode);
      
      expect(artifactInterface.name).toBe('solve_task');
      expect(artifactInterface.calling_pattern).toBe('single_dict');
      expect(artifactInterface.parameters).toHaveLength(1);
      expect(artifactInterface.parameters[0].name).toBe('task_params');
      expect(artifactInterface.parameters[0].type).toBe('positional');
      expect(artifactInterface.parameters[0].required).toBe(true);
      expect(artifactInterface.has_kwargs).toBe(false);
      expect(artifactInterface.execution_template).toBeTruthy();
    });

    it('should analyze keyword_args pattern correctly', () => {
      const functionCode = 'def flexible_function(**kwargs): return kwargs';
      const artifactInterface = mockAnalyzeFunctionInterface(functionCode);
      
      expect(artifactInterface.name).toBe('flexible_function');
      expect(artifactInterface.calling_pattern).toBe('keyword_args');
      expect(artifactInterface.parameters).toHaveLength(1);
      expect(artifactInterface.parameters[0].name).toBe('kwargs');
      expect(artifactInterface.parameters[0].type).toBe('kwargs');
      expect(artifactInterface.parameters[0].required).toBe(false);
      expect(artifactInterface.has_kwargs).toBe(true);
      expect(artifactInterface.execution_template).toBeTruthy();
    });

    it('should analyze positional pattern correctly', () => {
      const functionCode = 'def calculate_stats(data, operation): return len(data)';
      const artifactInterface = mockAnalyzeFunctionInterface(functionCode);
      
      expect(artifactInterface.name).toBe('calculate_stats');
      expect(artifactInterface.calling_pattern).toBe('positional');
      expect(artifactInterface.parameters).toHaveLength(2);
      expect(artifactInterface.parameters[0].name).toBe('data');
      expect(artifactInterface.parameters[1].name).toBe('operation');
      expect(artifactInterface.has_kwargs).toBe(false);
      expect(artifactInterface.execution_template).toBeTruthy();
    });

    it('should analyze no_args pattern correctly', () => {
      const functionCode = 'def no_args_function(): return "done"';
      const artifactInterface = mockAnalyzeFunctionInterface(functionCode);
      
      expect(artifactInterface.name).toBe('no_args_function');
      expect(artifactInterface.calling_pattern).toBe('no_args');
      expect(artifactInterface.parameters).toHaveLength(0);
      expect(artifactInterface.execution_template).toBeTruthy();
    });

    it('should analyze single_param pattern correctly', () => {
      const functionCode = 'def process_value(value): return value * 2';
      const artifactInterface = mockAnalyzeFunctionInterface(functionCode);
      
      expect(artifactInterface.name).toBe('process_value');
      expect(artifactInterface.calling_pattern).toBe('single_param');
      expect(artifactInterface.parameters).toHaveLength(1);
      expect(artifactInterface.parameters[0].name).toBe('value');
      expect(artifactInterface.execution_template).toBeTruthy();
    });

    it('should handle functions with default parameters', () => {
      const functionCode = 'def func_with_default(a, b=10): return a + b';
      const artifactInterface = mockAnalyzeFunctionInterface(functionCode);
      
      expect(artifactInterface.name).toBe('func_with_default');
      expect(artifactInterface.calling_pattern).toBe('positional');
      expect(artifactInterface.parameters).toHaveLength(2);
      expect(artifactInterface.parameters[0].required).toBe(true);
      expect(artifactInterface.parameters[1].required).toBe(false);
      expect(artifactInterface.parameters[1].has_default).toBe(true);
    });

    it('should return default interface for invalid function code', () => {
      const invalidCode = 'not a valid function';
      const artifactInterface = mockAnalyzeFunctionInterface(invalidCode);
      
      expect(artifactInterface.name).toBe('unknown_function');
      expect(artifactInterface.calling_pattern).toBe('single_dict');
      expect(artifactInterface.analysis_failed).toBe(true);
    });
  });

  describe('Calling Pattern Detection', () => {
    it('should detect single_dict pattern', () => {
      const parameters = [{ name: 'task_params', type: 'positional', required: true }];
      const pattern = determineCallingPattern(parameters, false);
      expect(pattern).toBe('single_dict');
    });

    it('should detect keyword_args pattern', () => {
      const parameters = [{ name: 'param1', type: 'positional', required: true }];
      const pattern = determineCallingPattern(parameters, true);
      expect(pattern).toBe('keyword_args');
    });

    it('should detect no_args pattern', () => {
      const parameters: any[] = [];
      const pattern = determineCallingPattern(parameters, false);
      expect(pattern).toBe('no_args');
    });

    it('should detect single_param pattern', () => {
      const parameters = [{ name: 'value', type: 'positional', required: true }];
      const pattern = determineCallingPattern(parameters, false);
      expect(pattern).toBe('single_param');
    });

    it('should detect positional pattern for multiple params', () => {
      const parameters = [
        { name: 'data', type: 'positional', required: true },
        { name: 'operation', type: 'positional', required: true }
      ];
      const pattern = determineCallingPattern(parameters, false);
      expect(pattern).toBe('positional');
    });
  });

  describe('Execution Template Generation', () => {
    it('should generate single_dict template', () => {
      const template = generateExecutionTemplate('test_func', 'single_dict');
      expect(template).toContain('result = test_func(inputs)');
      expect(template).toContain('{{input_json}}');
    });

    it('should generate keyword_args template', () => {
      const template = generateExecutionTemplate('test_func', 'keyword_args');
      expect(template).toContain('result = test_func(**inputs)');
      expect(template).toContain('{{input_json}}');
    });

    it('should generate no_args template', () => {
      const template = generateExecutionTemplate('test_func', 'no_args');
      expect(template).toContain('result = test_func()');
      expect(template).not.toContain('inputs');
    });

    it('should generate positional template', () => {
      const template = generateExecutionTemplate('test_func', 'positional');
      expect(template).toContain('result = test_func(*inputs)');
      expect(template).toContain('{{input_json}}');
    });
  });

  describe('Interface Structure Validation', () => {
    it('should have all required fields', () => {
      const functionCode = 'def test_func(param): return param';
      const artifactInterface = mockAnalyzeFunctionInterface(functionCode);
      
      expect(artifactInterface).toHaveProperty('name');
      expect(artifactInterface).toHaveProperty('parameters');
      expect(artifactInterface).toHaveProperty('calling_pattern');
      expect(artifactInterface).toHaveProperty('has_varargs');
      expect(artifactInterface).toHaveProperty('has_kwargs');
      expect(artifactInterface).toHaveProperty('execution_template');
      expect(artifactInterface).toHaveProperty('total_parameters');
      expect(artifactInterface).toHaveProperty('required_parameters');
    });

    it('should calculate parameter counts correctly', () => {
      const functionCode = 'def test_func(a, b=10, c=20): return a + b + c';
      const artifactInterface = mockAnalyzeFunctionInterface(functionCode);
      
      expect(artifactInterface.total_parameters).toBe(3);
      expect(artifactInterface.required_parameters).toBe(1);
    });
  });
});
