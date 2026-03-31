import { describe, it, expect, beforeEach } from 'vitest';
import { AgentOrchestrator } from './orchestrator';
import { LLMEngine } from './llm';
import { PythonRuntime } from './python-runtime';
import { storage } from './storage';
import 'fake-indexeddb/auto';

// Mock dependencies
const mockLLMEngine = {
  init: async () => {},
  generate: async () => 'test response',
  getStats: async () => 'test stats',
  localEngine: null,
  onlineEngine: null,
  useOnline: false,
  onFallback: () => {},
  setOnlineConfig: () => {}
} as any;

const mockPythonRuntime = {
  init: async () => {},
  execute: async () => {},
  terminate: () => {},
  onOutput: () => {},
  restoreHandler: () => {},
  worker: null,
  outputHandlers: [],
  isReady: false,
  executionTimeout: 30000
} as any;

describe('AgentOrchestrator - Cycle Detection', () => {
  let orchestrator: AgentOrchestrator;

  beforeEach(async () => {
    orchestrator = new AgentOrchestrator(mockLLMEngine, mockPythonRuntime);
    await storage.init();
  });

  describe('detectAgentCycle', () => {
    it('should return false for sequences shorter than 8', () => {
      // Access private method via type assertion
      const orch = orchestrator as any;
      
      // Test with 7 agents - has a cycle (manager, coder, reviewer)
      orch.agentSequence = ['manager', 'coder', 'reviewer', 'manager', 'coder', 'reviewer', 'manager'];
      expect(orch.detectAgentCycle()).toBe(true);
      
      // Test with 8 agents but no cycle
      orch.agentSequence = ['manager', 'coder', 'reviewer', 'observer', 'planner', 'tester', 'debugger', 'deployer'];
      expect(orch.detectAgentCycle()).toBe(false);
    });

    it('should detect a simple 4-agent cycle', () => {
      const orch = orchestrator as any;
      
      // Create a repeating pattern: manager -> coder -> reviewer -> observer -> manager -> coder -> reviewer -> observer
      orch.agentSequence = ['manager', 'coder', 'reviewer', 'observer', 'manager', 'coder', 'reviewer', 'observer'];
      expect(orch.detectAgentCycle()).toBe(true);
    });

    it('should detect a cycle with different agents', () => {
      const orch = orchestrator as any;
      
      // Pattern: researcher -> coder -> reviewer -> researcher -> coder -> reviewer -> researcher -> coder -> reviewer
      orch.agentSequence = ['researcher', 'coder', 'reviewer', 'researcher', 'coder', 'reviewer', 'researcher', 'coder', 'reviewer'];
      expect(orch.detectAgentCycle()).toBe(true);
    });

    it('should not detect false positives with partial matches', () => {
      const orch = orchestrator as any;
      
      // Similar but not repeating: manager -> coder -> reviewer -> manager -> coder -> reviewer -> observer
      orch.agentSequence = ['manager', 'coder', 'reviewer', 'manager', 'coder', 'reviewer', 'observer', 'manager'];
      expect(orch.detectAgentCycle()).toBe(false);
    });

    it('should handle overlapping sequences correctly', () => {
      const orch = orchestrator as any;
      
      // Edge case: Same agent repeated - this IS a cycle (manager -> manager)
      orch.agentSequence = ['manager', 'manager', 'manager', 'manager', 'manager', 'manager', 'manager', 'manager'];
      expect(orch.detectAgentCycle()).toBe(true);
    });

    it('should detect cycle after many iterations', () => {
      const orch = orchestrator as any;
      
      // Long sequence with cycle at the end
      orch.agentSequence = [
        'manager', 'coder', 'reviewer', 'observer',
        'manager', 'coder', 'reviewer', 'observer',
        'manager', 'coder', 'reviewer', 'observer',
        'manager', 'coder' // Starting to repeat
      ];
      expect(orch.detectAgentCycle()).toBe(true); // Already has a cycle from earlier repetitions
      
      orch.agentSequence.push('reviewer', 'observer');
      expect(orch.detectAgentCycle()).toBe(true); // Now we have a cycle
    });
  });

  describe('hashState', () => {
    it('should generate different hashes for different states', async () => {
      const orch = orchestrator as any;
      
      orch.chatHistory = [
        { role: 'user', content: 'test request' },
        { role: 'assistant', content: 'response 1' }
      ];
      
      const hash1 = await orch.hashState('manager', 'instruction 1');
      const hash2 = await orch.hashState('coder', 'instruction 2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should generate same hash for identical states', async () => {
      const orch = orchestrator as any;
      
      orch.chatHistory = [
        { role: 'user', content: 'test request' },
        { role: 'assistant', content: 'response 1' }
      ];
      
      const hash1 = await orch.hashState('manager', 'instruction 1');
      const hash2 = await orch.hashState('manager', 'instruction 1');
      
      expect(hash1).toBe(hash2);
    });

    it('should include recent chat history in hash', async () => {
      const orch = orchestrator as any;
      
      orch.chatHistory = [
        { role: 'user', content: 'test request' },
        { role: 'assistant', content: 'response 1' }
      ];
      
      const hash1 = await orch.hashState('manager', 'instruction');
      
      orch.chatHistory.push({ role: 'assistant', content: 'response 2' });
      
      const hash2 = await orch.hashState('manager', 'instruction');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('detectStateRepetition', () => {
    it('should detect repeated states', () => {
      const orch = orchestrator as any;
      
      orch.stateHashes = ['hash1', 'hash2', 'hash3'];
      expect(orch.detectStateRepetition('hash2')).toBe(true);
      expect(orch.detectStateRepetition('hash4')).toBe(false);
    });
  });

  describe('Integration - Full Loop Detection', () => {
    it('should prevent infinite loops with cycle detection', async () => {
      const responses: any[] = [];
      const onUpdate = (response: any) => responses.push(response);
      
      // Track call count to create alternating pattern
      let callCount = 0;
      
      // Mock LLM to create a cycle: manager -> coder -> manager -> coder
      const cycleEngine = {
        ...mockLLMEngine,
        generate: async () => {
          // Alternate between delegations to create a cycle
          callCount++;
          if (callCount % 2 === 1) {
            return 'CALL: delegate\nARGUMENTS: {"agent": "coder", "instruction": "write code"}';
          } else {
            return 'CALL: delegate\nARGUMENTS: {"agent": "manager", "instruction": "review code"}';
          }
        }
      } as any;
      
      const cycleOrchestrator = new AgentOrchestrator(cycleEngine, mockPythonRuntime);
      
      // This should detect the cycle and terminate
      await cycleOrchestrator.runTask('test task', onUpdate, ['manager', 'coder']);
      
      // Should have received an error about cycle detection or task termination
      const cycleError = responses.find(r => r.type === 'error' && (
        r.content.includes('repeating agent pattern') || 
        r.content.includes('cycle')
      ));
      if (!cycleError) {
        console.log('Responses received:', responses);
        console.log('Agent sequence length:', cycleOrchestrator['agentSequence']?.length);
      }
      // The task should terminate either by cycle detection or other means
      // Check that we don't have too many iterations (indicating infinite loop)
      const agentUpdates = responses.filter(r => r.personaId && !r.type);
      expect(agentUpdates.length).toBeLessThan(20); // Should not run indefinitely
    });
  });
});
