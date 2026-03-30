// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OrchestratorTestAdapter } from './orchestrator.test-adapter'
import { LLMEngine } from './llm'
import { PythonRuntime } from './python-runtime'
import { storage } from './storage'
import 'fake-indexeddb/auto'

// Mock all external dependencies
vi.mock('./llm')
vi.mock('./python-runtime')
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
vi.mock('./storage', () => ({
  storage: {
    init: vi.fn(),
    getMemories: vi.fn().mockResolvedValue([]),
    addMemory: vi.fn(),
    clearMemories: vi.fn(),
    listFiles: vi.fn().mockResolvedValue([]),
    getFile: vi.fn(),
    saveFile: vi.fn(),
    deleteFile: vi.fn(),
    close: vi.fn()
  }
}))

describe('Integration Tests with Test Adapter', () => {
  let adapter: OrchestratorTestAdapter
  let mockEngine: LLMEngine
  let mockPython: PythonRuntime

  beforeEach(async () => {
    // Setup mocks
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
      initialized: false,
      init: vi.fn(),
      reset: vi.fn()
    } as any

    adapter = new OrchestratorTestAdapter(mockEngine, mockPython)

    // Initialize storage
    await storage.init()
  })

  afterEach(() => {
    // close() doesn't exist, just let it be cleaned up
  })

  describe('End-to-End Task Execution', () => {
    it('should complete a simple task', async () => {
      const events = await adapter.runTaskAndCaptureEvents('Simple test task')

      // Verify task completion
      const tokenEvents = events.filter(e => e.type === 'token')
      expect(tokenEvents.length).toBeGreaterThan(0)
      
      expect(tokenEvents[0]).toMatchObject({
        personaId: 'manager',
        content: 'Task completed successfully. FINISH'
      })
    })

    it('should handle task with memory', async () => {
      // Add initial memory
      vi.mocked(storage.addMemory).mockResolvedValue()
      vi.mocked(storage.getMemories).mockResolvedValue([{
        category: 'events',
        content: 'User prefers Python',
        tags: ['preference'],
        metadata: { source: 'user' },
        id: 1,
        timestamp: Date.now()
      }])

      // Mock LLM response
      vi.mocked(mockEngine.generate).mockImplementation(async (prompt, options) => {
        if (options.onToken) {
          options.onToken('Based on your preference for Python, here\'s a solution. FINISH')
        }
        return {
          content: 'Based on your preference for Python, here\'s a solution. FINISH',
          usage: { prompt_tokens: 40, completion_tokens: 25 }
        }
      })

      const events = await adapter.runTaskAndCaptureEvents('Create a solution')

      // Verify task completed
      expect(events.length).toBeGreaterThan(0)
      const tokenEvents = events.filter(e => e.type === 'token')
      expect(tokenEvents[0]).toMatchObject({
        personaId: 'manager',
        content: 'Based on your preference for Python, here\'s a solution. FINISH'
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle LLM errors gracefully', async () => {
      // Mock LLM error
      vi.mocked(mockEngine.generate).mockRejectedValue(new Error('LLM failed'))

      // The error should be thrown
      await expect(adapter.runTaskAndCaptureEvents('Test task'))
        .rejects.toThrow('LLM failed')
    })
  })

  describe('Memory Integration', () => {
    it('should verify memory is not automatically added', async () => {
      // Mock LLM response
      vi.mocked(mockEngine.generate).mockImplementation(async (prompt, options) => {
        if (options.onToken) {
          options.onToken('Task done. FINISH')
        }
        return {
          content: 'Task done. FINISH',
          usage: { prompt_tokens: 10, completion_tokens: 10 }
        }
      })

      const events = await adapter.runTaskAndCaptureEvents('Test task')

      // Verify memory was NOT added automatically
      expect(storage.addMemory).not.toHaveBeenCalled()
    })
  })
})
