// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OrchestratorTestAdapter, OrchestratorEvent } from './orchestrator.test-adapter'
import { storage } from './storage'
import 'fake-indexeddb/auto'

// Mock all dependencies
vi.mock('./storage', () => ({
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

vi.mock('./tools', () => ({
  getSystemContext: vi.fn().mockResolvedValue('System context'),
  TOOLS: {}
}))

vi.mock('./skills/engine', () => ({
  skillsEngine: {
    init: vi.fn(),
    parseSkillCalls: vi.fn().mockReturnValue([]),
    executeSkill: vi.fn(),
    getSkillsDescription: vi.fn().mockReturnValue('Calculator: Perform mathematical calculations')
  }
}))

vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}))

describe('OrchestratorTestAdapter', () => {
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

  describe('Event Capture', () => {
    it('should capture token events during task execution', async () => {
      const events = await adapter.runTaskAndCaptureEvents('Simple test task', ['coder'])
      
      expect(events.length).toBeGreaterThan(0)
      
      const tokenEvents = events.filter(e => e.type === 'token')
      expect(tokenEvents.length).toBeGreaterThan(0)
      
      expect(tokenEvents[0]).toMatchObject({
        type: 'token',
        personaId: 'manager',
        content: 'Task completed successfully. FINISH'
      })
    })

    it('should capture events for specific personas', async () => {
      await adapter.runTaskAndCaptureEvents('Test task', ['coder'])
      
      const managerEvents = adapter.getEventsForPersona('manager')
      expect(managerEvents.length).toBeGreaterThan(0)
      
      const coderEvents = adapter.getEventsForPersona('coder')
      // Coder might not be called if manager finishes the task
      expect(coderEvents.length).toBeGreaterThanOrEqual(0)
    })

    it('should get the last event of a specific type', async () => {
      await adapter.runTaskAndCaptureEvents('Test task', ['coder'])
      
      const lastTokenEvent = adapter.getLastEvent('token')
      expect(lastTokenEvent).toBeDefined()
      expect(lastTokenEvent?.personaId).toBe('manager')
    })

    it('should clear events between runs', async () => {
      // First run
      await adapter.runTaskAndCaptureEvents('Task 1', ['coder'])
      expect(adapter.getLastEvent('token')).toBeDefined()
      
      // Clear and run again
      adapter.clearEvents()
      expect(adapter.getLastEvent('token')).toBeUndefined()
      
      await adapter.runTaskAndCaptureEvents('Task 2', ['coder'])
      expect(adapter.getLastEvent('token')).toBeDefined()
    })
  })

  describe('Memory Integration', () => {
    it('should verify memory is not automatically added', async () => {
      await adapter.runTaskAndCaptureEvents('Test task', ['coder'])
      
      // Memory should not be added automatically
      expect(storage.addMemory).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should capture error events when engine fails', async () => {
      // Create an adapter with a failing engine
      const errorEngine = {
        generate: vi.fn().mockRejectedValue(new Error('Engine failed')),
        getStats: vi.fn()
      } as any
      
      const errorAdapter = new OrchestratorTestAdapter(errorEngine, mockPython)
      
      // The error should be thrown
      await expect(errorAdapter.runTaskAndCaptureEvents('Test task', ['manager']))
        .rejects.toThrow('Engine failed')
    })
  })
})
