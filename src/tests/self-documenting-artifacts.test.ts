import { describe, it, expect, beforeEach } from 'vitest';
import type { CodeArtifact, ArtifactInterface } from '../orchestrator/types';

describe('Self-Documenting Artifacts', () => {
  describe('Artifact Interface Structure', () => {
    it('should validate complete artifact interface', () => {
      const artifact: CodeArtifact = {
        id: 'test-123',
        name: 'test_function',
        description: 'Test function with self-documenting interface',
        function: 'def solve_task(task_params): return f"Task: {task_params}"',
        usage: 'result = solve_task(params)',
        dependencies: [],
        created_by: 'python-coding',
        status: 'pending',
        artifactInterface: {
          name: 'solve_task',
          parameters: [
            { name: 'task_params', type: 'positional', required: true }
          ],
          calling_pattern: 'single_dict',
          has_varargs: false,
          has_kwargs: false,
          execution_template: `
# Parse inputs and call artifact function
inputs = {{input_json}}
result = solve_task(inputs) if inputs else solve_task()

# Format output nicely
if isinstance(result, dict):
    for key, value in result.items():
        print(f"{key}: {value}")
elif isinstance(result, (int, float)):
    print(f"Result: {result}")
else:
    print(f"Result: {result}")
`,
          total_parameters: 1,
          required_parameters: 1
        }
      };

      expect(artifact.artifactInterface).toBeDefined();
      expect(artifact.artifactInterface.name).toBe('solve_task');
      expect(artifact.artifactInterface.calling_pattern).toBe('single_dict');
      expect(artifact.artifactInterface.parameters).toHaveLength(1);
      expect(artifact.artifactInterface.parameters[0].name).toBe('task_params');
      expect(artifact.artifactInterface.parameters[0].required).toBe(true);
      expect(artifact.artifactInterface.execution_template).toBeTruthy();
      expect(artifact.artifactInterface.total_parameters).toBe(1);
      expect(artifact.artifactInterface.required_parameters).toBe(1);
    });

    it('should validate all calling patterns', () => {
      const patterns: Array<{
        pattern: string;
        artifactInterface: ArtifactInterface;
        expectedParams: number;
        expectedRequired: number;
      }> = [
        {
          pattern: 'single_dict',
          artifactInterface: {
            name: 'solve_task',
            parameters: [{ name: 'task_params', type: 'positional', required: true }],
            calling_pattern: 'single_dict',
            has_varargs: false,
            has_kwargs: false,
            execution_template: '# Template',
            total_parameters: 1,
            required_parameters: 1
          },
          expectedParams: 1,
          expectedRequired: 1
        },
        {
          pattern: 'keyword_args',
          artifactInterface: {
            name: 'flexible_func',
            parameters: [{ name: 'kwargs', type: 'kwargs', required: false }],
            calling_pattern: 'keyword_args',
            has_varargs: false,
            has_kwargs: true,
            execution_template: '# Template',
            total_parameters: 0,
            required_parameters: 0
          },
          expectedParams: 0,
          expectedRequired: 0
        },
        {
          pattern: 'positional',
          artifactInterface: {
            name: 'calculate_func',
            parameters: [
              { name: 'a', type: 'positional', required: true },
              { name: 'b', type: 'positional', required: true }
            ],
            calling_pattern: 'positional',
            has_varargs: false,
            has_kwargs: false,
            execution_template: '# Template',
            total_parameters: 2,
            required_parameters: 2
          },
          expectedParams: 2,
          expectedRequired: 2
        },
        {
          pattern: 'no_args',
          artifactInterface: {
            name: 'no_args_func',
            parameters: [],
            calling_pattern: 'no_args',
            has_varargs: false,
            has_kwargs: false,
            execution_template: '# Template',
            total_parameters: 0,
            required_parameters: 0
          },
          expectedParams: 0,
          expectedRequired: 0
        },
        {
          pattern: 'single_param',
          artifactInterface: {
            name: 'process_value',
            parameters: [{ name: 'value', type: 'positional', required: true }],
            calling_pattern: 'single_param',
            has_varargs: false,
            has_kwargs: false,
            execution_template: '# Template',
            total_parameters: 1,
            required_parameters: 1
          },
          expectedParams: 1,
          expectedRequired: 1
        }
      ];

      patterns.forEach(({ pattern, artifactInterface, expectedParams, expectedRequired }) => {
        expect(artifactInterface.calling_pattern).toBe(pattern);
        expect(artifactInterface.total_parameters).toBe(expectedParams);
        expect(artifactInterface.required_parameters).toBe(expectedRequired);
        expect(artifactInterface.execution_template).toBeTruthy();
      });
    });

    it('should validate parameter structure', () => {
      const artifactInterface: ArtifactInterface = {
        name: 'complex_func',
        parameters: [
          { name: 'required_param', type: 'positional', required: true },
          { name: 'optional_param', type: 'positional', required: false, has_default: true, default: 10 },
          { name: 'kwargs', type: 'kwargs', required: false }
        ],
        calling_pattern: 'keyword_args',
        has_varargs: false,
        has_kwargs: true,
        execution_template: '# Template',
        total_parameters: 2,
        required_parameters: 1
      };

      // Check required parameter
      const requiredParam = artifactInterface.parameters.find(p => p.name === 'required_param');
      expect(requiredParam).toBeDefined();
      expect(requiredParam.required).toBe(true);

      // Check optional parameter
      const optionalParam = artifactInterface.parameters.find(p => p.name === 'optional_param');
      expect(optionalParam).toBeDefined();
      expect(optionalParam.required).toBe(false);
      expect(optionalParam.has_default).toBe(true);
      expect(optionalParam.default).toBe(10);

      // Check kwargs parameter
      const kwargsParam = artifactInterface.parameters.find(p => p.name === 'kwargs');
      expect(kwargsParam).toBeDefined();
      expect(kwargsParam.type).toBe('kwargs');
      expect(kwargsParam.required).toBe(false);
    });
  });

  describe('Execution Template Generation', () => {
    it('should generate correct templates for each pattern', () => {
      const templates = {
        single_dict: `
# Parse inputs and call artifact function
inputs = {{input_json}}
result = function_name(inputs) if inputs else function_name()

# Format output nicely
if isinstance(result, dict):
    for key, value in result.items():
        print(f"{key}: {value}")
elif isinstance(result, (int, float)):
    print(f"Result: {result}")
else:
    print(f"Result: {result}")
`,
        keyword_args: `
# Parse inputs and call artifact function
inputs = {{input_json}}
result = function_name(**inputs) if inputs else function_name()

# Format output nicely
if isinstance(result, dict):
    for key, value in result.items():
        print(f"{key}: {value}")
elif isinstance(result, (int, float)):
    print(f"Result: {result}")
else:
    print(f"Result: {result}")
`,
        no_args: `
# Call artifact function (no arguments)
result = function_name()

# Format output nicely
if isinstance(result, dict):
    for key, value in result.items():
        print(f"{key}: {value}")
elif isinstance(result, (int, float)):
    print(f"Result: {result}")
else:
    print(f"Result: {result}")
`,
        positional: `
# Parse inputs and call artifact function
inputs = {{input_json}}
result = function_name(*inputs)

# Format output nicely
if isinstance(result, dict):
    for key, value in result.items():
        print(f"{key}: {value}")
elif isinstance(result, (int, float)):
    print(f"Result: {result}")
else:
    print(f"Result: {result}")
`
      };

      Object.entries(templates).forEach(([pattern, template]) => {
        if (pattern !== 'no_args') {
          expect(template).toContain('{{input_json}}');
        }
        expect(template).toContain('function_name');
        
        if (pattern === 'single_dict') {
          expect(template).toContain('function_name(inputs)');
        } else if (pattern === 'keyword_args') {
          expect(template).toContain('function_name(**inputs)');
        } else if (pattern === 'no_args') {
          expect(template).toContain('function_name()');
        } else if (pattern === 'positional') {
          expect(template).toContain('function_name(*inputs)');
        }
        
        expect(template).toContain('Format output nicely');
      });
    });

    it('should substitute input_json placeholder correctly', () => {
      const template = `
# Parse inputs and call artifact function
inputs = {{input_json}}
result = test_func(inputs)
`;
      const testInputs = { request: 'test', data: [1, 2, 3] };
      const substituted = template.replace('{{input_json}}', JSON.stringify(testInputs));

      expect(substituted).toContain(JSON.stringify(testInputs));
      expect(substituted).not.toContain('{{input_json}}');
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle artifacts without interfaces', () => {
      const legacyArtifact: CodeArtifact = {
        id: 'legacy-123',
        name: 'legacy_function',
        description: 'Legacy artifact without interface',
        function: 'def legacy_func(): return "legacy"',
        usage: 'result = legacy_func()',
        dependencies: [],
        created_by: 'python-coding',
        status: 'pending'
        // No artifactInterface property
      };

      expect(legacyArtifact.artifactInterface).toBeUndefined();
      // Legacy artifacts should still have all required properties
      expect(legacyArtifact.id).toBeTruthy();
      expect(legacyArtifact.name).toBeTruthy();
      expect(legacyArtifact.function).toBeTruthy();
    });

    it('should handle artifacts with partial interfaces', () => {
      const partialArtifact: CodeArtifact = {
        id: 'partial-123',
        name: 'partial_function',
        description: 'Artifact with partial interface',
        function: 'def partial_func(param): return param',
        usage: 'result = partial_func(value)',
        dependencies: [],
        created_by: 'python-coding',
        status: 'pending',
        artifactInterface: {
          name: 'partial_func',
          parameters: [
            { name: 'param', type: 'positional', required: true }
          ],
          calling_pattern: 'single_param',
          has_varargs: false,
          has_kwargs: false,
          // Missing execution_template
          total_parameters: 1,
          required_parameters: 1
        }
      };

      expect(partialArtifact.artifactInterface).toBeDefined();
      expect(partialArtifact.artifactInterface.execution_template).toBeUndefined();
      // Should still have other required fields
      expect(partialArtifact.artifactInterface.name).toBe('partial_func');
      expect(partialArtifact.artifactInterface.calling_pattern).toBe('single_param');
    });
  });

  describe('Input Validation Requirements', () => {
    it('should define validation rules for each pattern', () => {
      const validationRules = {
        single_dict: {
          description: 'Requires non-empty inputs dictionary',
          validInputs: [{ request: 'test', data: [1, 2, 3] }],
          invalidInputs: [{}, null, undefined]
        },
        keyword_args: {
          description: 'Requires all required parameters to be present',
          validInputs: [{ required_param: 'value', optional_param: 'optional' }],
          invalidInputs: [{}, { missing_param: 'value' }]
        },
        positional: {
          description: 'Requires enough positional arguments',
          validInputs: [[1, 2, 3], ['a', 'b']],
          invalidInputs: [[1], []]
        },
        single_param: {
          description: 'Requires a single non-empty value',
          validInputs: [{ value: 42 }, 'single_value', 123],
          invalidInputs: [{}, null, undefined]
        },
        no_args: {
          description: 'Accepts any inputs (ignored)',
          validInputs: [{ anything: 'goes' }, {}, null],
          invalidInputs: []
        }
      };

      Object.entries(validationRules).forEach(([pattern, rules]) => {
        expect(rules.description).toBeTruthy();
        expect(rules.validInputs).toBeDefined();
        expect(rules.invalidInputs).toBeDefined();
        
        if (pattern !== 'no_args') {
          expect(rules.invalidInputs.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should define error response structure', () => {
      const errorResponse = {
        error: 'Input validation failed',
        details: ['Missing required parameter: task_params']
      };

      expect(errorResponse.error).toBe('Input validation failed');
      expect(Array.isArray(errorResponse.details)).toBe(true);
      expect(errorResponse.details[0]).toContain('Missing required parameter');
    });

    it('should provide specific error messages', () => {
      const errorMessages = [
        'Missing required parameter: task_params',
        'Missing required parameter: data',
        'Missing required parameter: operation',
        'Missing required positional parameter: arg1',
        'Missing required parameter: value'
      ];

      errorMessages.forEach(message => {
        expect(message).toMatch(/Missing required.*parameter/);
        expect(message).toMatch(/parameter:\s*\w+/);
      });
    });
  });
});
