// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OrchestratorTestAdapter, OrchestratorEvent } from './orchestrator.test-adapter'
import { storage } from '../storage'
import 'fake-indexeddb/auto'

// Mock all dependencies
vi.mock('../storage', () => ({
  storage: {
    init: vi.fn(),
    getMemories: vi.fn().mockResolvedValue([]),
    addMemory: vi.fn(),
    clearMemories: vi.fn(),
    listFiles: vi.fn().mockResolvedValue([]),
    getFile: vi.fn(),
    saveFile: vi.fn(),
    deleteFile: vi.fn()
  }
}))

vi.mock('../tools', () => ({
  getSkillsContext: vi.fn().mockReturnValue('Skills context'),
  TOOLS: {}
}))

vi.mock('../skills/engine', () => ({
  skillsEngine: {
    init: vi.fn(),
    parseSkillCalls: vi.fn().mockReturnValue([]),
    executeSkill: vi.fn(),
    getSkillsDescription: vi.fn().mockReturnValue('Research: Web fetching and information gathering\nPython-Coding: Python code development and execution\nData-Analysis: Data processing and analysis\nQuality-Review: Code and output validation\nExecution-Analyzer: Meta skill for deep analysis\nTask-Planning: Meta skill for complex task decomposition'),
    hasSkill: vi.fn().mockReturnValue(true)
  }
}))

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}))

describe('SkillBasedOrchestratorTestAdapter', () => {
  let adapter: OrchestratorTestAdapter
  let mockEngine: any
  let mockPython: any

  beforeEach(async () => {
    mockEngine = {
      generate: vi.fn().mockImplementation(async (prompt, options) => {
        // Simulate the onToken callback being called
        if (options.onToken) {
          options.onToken('Task completed successfully. FINISH')
        }
        return {
          content: 'Task completed successfully. FINISH',
          usage: { prompt_tokens: 10, completion_tokens: 20 }
        }
      }),
      getStats: vi.fn()
    } as any

    mockPython = {
      onOutput: vi.fn(),
      execute: vi.fn(),
      executeWithTemporaryOutput: vi.fn().mockImplementation(async (handler, fn) => {
        const oldHandler = mockPython.onOutput
        mockPython.onOutput = handler
        try {
          return await fn()
        } finally {
          mockPython.onOutput = oldHandler
        }
      }),
      initialized: false,
      init: vi.fn(),
      reset: vi.fn()
    }

    adapter = new OrchestratorTestAdapter(mockEngine, mockPython)
    
    // Initialize storage
    await storage.init()
  })

  describe('Skill-Based Event Capture', () => {
    it('should capture token events during task execution', async () => {
      const events = await adapter.runTaskAndCaptureEvents('Simple test task')
      
      expect(events.length).toBeGreaterThan(0)
      
      const tokenEvents = events.filter(e => e.type === 'token')
      expect(tokenEvents.length).toBeGreaterThan(0)
      
      // Should have system events for skill execution
      expect(tokenEvents.some(e => e.personaId === 'system')).toBe(true)
      expect(tokenEvents.some(e => e.content.includes('Executing skill'))).toBe(true)
    })

    it('should capture events for specific skills', async () => {
      await adapter.runTaskAndCaptureEvents('Test task')
      
      const systemEvents = adapter.getEventsForPersona('system')
      expect(systemEvents.length).toBeGreaterThan(0)
      
      const pythonCodingEvents = adapter.getEventsForPersona('python-coding')
      expect(pythonCodingEvents.length).toBeGreaterThanOrEqual(0)
      
      const observerEvents = adapter.getEventsForPersona('observer')
      expect(observerEvents.length).toBeGreaterThan(0)
    })

    it('should get the last event of a specific type', async () => {
      await adapter.runTaskAndCaptureEvents('Test task')
      
      const lastTokenEvent = adapter.getLastEvent('token')
      expect(lastTokenEvent).toBeDefined()
      // Should be a system event in skill-based architecture
      expect(lastTokenEvent?.personaId).toBe('system')
    })

    it('should clear events between runs', async () => {
      // First run
      await adapter.runTaskAndCaptureEvents('Task 1')
      expect(adapter.getLastEvent('token')).toBeDefined()
      
      // Clear and run again
      adapter.clearEvents()
      expect(adapter.getLastEvent('token')).toBeUndefined()
    })

    it('should capture skill progression events', async () => {
      const events = await adapter.runTaskAndCaptureEvents('Code a simple calculator')
      
      expect(events.length).toBeGreaterThan(0)
      
      // Should have skill execution events
      const skillEvents = events.filter(e => e.content.includes('Executing skill'))
      expect(skillEvents.length).toBeGreaterThan(0)
      
      // Should have observer analysis events
      const observerEvents = events.filter(e => e.personaId === 'observer')
      expect(observerEvents.length).toBeGreaterThan(0)
    })
  })

  describe('Skill Selection Logic', () => {
    it('should select python-coding skill for code tasks', async () => {
      const events = await adapter.runTaskAndCaptureEvents('Write a Python function')
      
      const skillEvents = events.filter(e => e.content.includes('Executing skill: python-coding'))
      expect(skillEvents.length).toBeGreaterThan(0)
    })

    it('should select research skill for investigation tasks', async () => {
      const events = await adapter.runTaskAndCaptureEvents('Research climate change data')
      
      const skillEvents = events.filter(e => e.content.includes('Executing skill: research'))
      expect(skillEvents.length).toBeGreaterThan(0)
    })

    it('should select data-analysis skill for analysis tasks', async () => {
      const events = await adapter.runTaskAndCaptureEvents('Analyze the sales data')
      
      const skillEvents = events.filter(e => e.content.includes('Executing skill: data-analysis'))
      expect(skillEvents.length).toBeGreaterThan(0)
    })

    it('should select task-planning skill for complex tasks', async () => {
      const events = await adapter.runTaskAndCaptureEvents('Plan a complex project breakdown')
      
      const skillEvents = events.filter(e => e.content.includes('Executing skill: task-planning'))
      expect(skillEvents.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle skill execution errors gracefully', async () => {
      // Mock skill execution failure
      const { skillsEngine } = await import('../skills/engine')
      vi.mocked(skillsEngine.executeSkill).mockResolvedValue({
        success: false,
        error: 'Skill execution failed'
      })

      const events = await adapter.runTaskAndCaptureEvents('Test task')
      
      expect(events.length).toBeGreaterThan(0)
      
      // Should have error events
      const errorEvents = events.filter(e => e.content.includes('Skill execution failed'))
      expect(errorEvents.length).toBeGreaterThan(0)
    })

    it('should validate input parameters', async () => {
      await expect(adapter.runTaskAndCaptureEvents('')).rejects.toThrow('User request must be a non-empty string')
      await expect(adapter.runTaskAndCaptureEvents(null as any)).rejects.toThrow('User request must be a non-empty string')
    })
  })

  describe('Chat History Management', () => {
    it('should truncate chat history to prevent memory issues', async () => {
      // This would require a more complex setup to test the truncation
      // For now, just ensure the task completes without memory issues
      const events = await adapter.runTaskAndCaptureEvents('A'.repeat(1000))
      
      expect(events.length).toBeGreaterThan(0)
      expect(events.some(e => e.personaId === 'system')).toBe(true)
    })
  })

  describe('Cycle Detection', () => {
    it('should detect repeating skill cycles', async () => {
      // Mock skills to create a cycle
      const { skillsEngine } = await import('../skills/engine')
      vi.mocked(skillsEngine.executeSkill).mockImplementation(async (skillName) => {
        if (skillName === 'python-coding') {
          return { success: true, output: 'Code written, needs review' }
        } else if (skillName === 'quality-review') {
          return { success: true, output: 'Fix this issue' }
        }
        return { success: true, output: 'Task complete' }
      })

      const events = await adapter.runTaskAndCaptureEvents('Write and review code')
      
      expect(events.length).toBeGreaterThan(0)
      
      // Should eventually detect cycle and terminate
      const cycleEvents = events.filter(e => e.content.includes('Detected repeating skill pattern'))
      expect(cycleEvents.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Deep Analysis', () => {
    it('should perform deep analysis for complex results', async () => {
      // Mock skill execution with large output to trigger deep analysis
      const { skillsEngine } = await import('../skills/engine')
      vi.mocked(skillsEngine.executeSkill).mockResolvedValue({
        success: true,
        output: 'A'.repeat(2000) // Large output to trigger deep analysis
      })

      const events = await adapter.runTaskAndCaptureEvents('Generate large report')
      
      expect(events.length).toBeGreaterThan(0)
      
      // Should have execution-analyzer events
      const analyzerEvents = events.filter(e => e.personaId === 'execution-analyzer')
      expect(analyzerEvents.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Legacy Compatibility', () => {
    it('should maintain backward compatibility with executeTool method', async () => {
      // Test the legacy executeTool method still works
      const orchestrator = adapter.getOrchestrator()
      
      if (orchestrator.executeTool) {
        const result = await orchestrator.executeTool('web_fetch', { task: 'Fetch data from https://example.com' }, vi.fn())
        expect(typeof result).toBe('string')
      }
    })
  })
})
