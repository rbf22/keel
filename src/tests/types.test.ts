import { describe, it, expect } from 'vitest';
import { 
  VFSFile, 
  MemoryCategory, 
  AgentMemory, 
  PythonOutput, 
  ResponseType, 
  AgentResponse, 
  ToolCall, 
  PendingPythonExecution 
} from '../types';

describe('Type Definitions', () => {
  describe('VFSFile', () => {
    it('should create a valid VFSFile', () => {
      const file: VFSFile = {
        path: 'keel://resources/test.txt',
        content: 'Test content',
        l0: 'Abstract',
        l1: 'Overview',
        mimeType: 'text/plain',
        metadata: { size: 12 },
        updatedAt: Date.now()
      };

      expect(file.path).toBe('keel://resources/test.txt');
      expect(file.content).toBe('Test content');
      expect(file.l0).toBe('Abstract');
      expect(file.l1).toBe('Overview');
      expect(file.mimeType).toBe('text/plain');
      expect(file.metadata).toEqual({ size: 12 });
      expect(typeof file.updatedAt).toBe('number');
    });

    it('should allow optional l0 and l1 fields', () => {
      const file: VFSFile = {
        path: 'keel://resources/test.txt',
        content: 'Test content',
        mimeType: 'text/plain',
        metadata: {},
        updatedAt: Date.now()
      };

      expect(file.l0).toBeUndefined();
      expect(file.l1).toBeUndefined();
    });
  });

  describe('MemoryCategory', () => {
    it('should accept valid memory categories', () => {
      const validCategories: MemoryCategory[] = [
        'profile', 'preferences', 'entities', 'events', 'cases', 'patterns'
      ];

      validCategories.forEach(category => {
        expect(['profile', 'preferences', 'entities', 'events', 'cases', 'patterns']).toContain(category);
      });
    });
  });

  describe('AgentMemory', () => {
    it('should create a valid AgentMemory', () => {
      const memory: AgentMemory = {
        id: 1,
        category: 'profile',
        content: 'Test memory content',
        tags: ['test', 'memory'],
        timestamp: Date.now(),
        metadata: { source: 'user' }
      };

      expect(memory.category).toBe('profile');
      expect(memory.content).toBe('Test memory content');
      expect(memory.tags).toEqual(['test', 'memory']);
      expect(memory.id).toBe(1);
      expect(typeof memory.timestamp).toBe('number');
      expect(memory.metadata).toEqual({ source: 'user' });
    });

    it('should allow optional id field', () => {
      const memory: AgentMemory = {
        category: 'preferences',
        content: 'Test content',
        tags: [],
        timestamp: Date.now(),
        metadata: {}
      };

      expect(memory.id).toBeUndefined();
    });
  });

  describe('PythonOutput', () => {
    it('should create valid PythonOutput for different types', () => {
      const logOutput: PythonOutput = {
        type: 'log',
        message: 'Processing data...'
      };

      const errorOutput: PythonOutput = {
        type: 'error',
        message: 'Syntax error'
      };

      const downloadOutput: PythonOutput = {
        type: 'download',
        filename: 'data.csv',
        content: 'csv,data\n1,2'
      };

      const completeOutput: PythonOutput = {
        type: 'complete',
        data: { result: 42 }
      };

      expect(logOutput.type).toBe('log');
      expect(logOutput.message).toBe('Processing data...');

      expect(errorOutput.type).toBe('error');
      expect(errorOutput.message).toBe('Syntax error');

      expect(downloadOutput.type).toBe('download');
      expect(downloadOutput.filename).toBe('data.csv');
      expect(downloadOutput.content).toBe('csv,data\n1,2');

      expect(completeOutput.type).toBe('complete');
      expect(completeOutput.data).toEqual({ result: 42 });
    });
  });

  describe('AgentResponse', () => {
    it('should create a valid AgentResponse', () => {
      const response: AgentResponse = {
        personaId: 'manager',
        content: 'Task delegated to coder',
        type: 'text',
        data: { targetAgent: 'coder' }
      };

      expect(response.personaId).toBe('manager');
      expect(response.content).toBe('Task delegated to coder');
      expect(response.type).toBe('text');
      expect(response.data).toEqual({ targetAgent: 'coder' });
    });

    it('should allow optional type and data fields', () => {
      const response: AgentResponse = {
        personaId: 'coder',
        content: 'Code written'
      };

      expect(response.type).toBeUndefined();
      expect(response.data).toBeUndefined();
    });
  });

  describe('ToolCall', () => {
    it('should create a valid ToolCall', () => {
      const toolCall: ToolCall = {
        name: 'delegate',
        args: {
          agent: 'coder',
          instruction: 'Write Python code'
        }
      };

      expect(toolCall.name).toBe('delegate');
      expect(toolCall.args).toEqual({
        agent: 'coder',
        instruction: 'Write Python code'
      });
    });
  });

  describe('PendingPythonExecution', () => {
    it('should create a valid PendingPythonExecution', () => {
      const pendingCall: PendingPythonExecution = {
        name: 'execute_python',
        args: {
          code: 'print("Hello, World!")'
        }
      };

      expect(pendingCall.name).toBe('execute_python');
      expect(pendingCall.args.code).toBe('print("Hello, World!")');
    });

    it('should extend ToolCall', () => {
      const pendingCall: PendingPythonExecution = {
        name: 'execute_python',
        args: {
          code: 'result = 2 * 3'
        }
      };

      // Should be assignable to ToolCall
      const toolCall: ToolCall = pendingCall;
      expect(toolCall.name).toBe('execute_python');
      expect(toolCall.args).toHaveProperty('code');
    });
  });

  describe('ResponseType', () => {
    it('should accept valid response types', () => {
      const validTypes: ResponseType[] = [
        'text', 'error', 'plan', 'observation', 'token', 'complete', 'tool_call', 'memory_added'
      ];

      validTypes.forEach(type => {
        expect(['text', 'error', 'plan', 'observation', 'token', 'complete', 'tool_call', 'memory_added']).toContain(type);
      });
    });
  });
});
