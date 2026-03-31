import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgentOrchestrator } from './orchestrator'
import { LLMEngine } from './llm'
import { PythonRuntime } from './python-runtime'
import { PERSONAS } from './personas'
import { storage } from './storage'

// Mock dependencies
vi.mock('./storage', () => ({
  storage: {
    init: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    listFiles: vi.fn(),
    addMemory: vi.fn()
  }
}))

vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

vi.mock('./tools', () => ({
  getSystemContext: vi.fn().mockResolvedValue('System Context')
}))

vi.mock('./skills/engine', () => ({
  skillsEngine: {
    getSkillsDescription: vi.fn().mockReturnValue('Skills description'),
    parseSkillCalls: vi.fn().mockReturnValue([])
  }
}))

describe('AgentOrchestrator Abort Support', () => {
  let orchestrator: AgentOrchestrator
  let mockEngine: any
  let mockPython: any

  beforeEach(() => {
    mockEngine = {
      generate: vi.fn(),
      getStats: vi.fn()
    }
    mockPython = {
      execute: vi.fn(),
      onOutput: null,
      restoreHandler: vi.fn()
    }
    orchestrator = new AgentOrchestrator(mockEngine as any, mockPython as any)
  })

  it('should abort task execution when signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    const onUpdate = vi.fn()
    await expect(orchestrator.runTask('test task', onUpdate, undefined, controller.signal))
      .rejects.toThrow('Task aborted')
    
    expect(mockEngine.generate).not.toHaveBeenCalled()
  })

  it('should stop orchestration between agent steps if aborted', async () => {
    const controller = new AbortController()
    
    // First call succeeds, then we abort
    mockEngine.generate.mockImplementationOnce(async (prompt: string, options: any) => {
      options.onToken('Step 1 complete. CALL: delegate ARGUMENTS: {"agent": "coder", "instruction": "do something"}')
      controller.abort()
      return 'Step 1 complete'
    })

    const onUpdate = vi.fn()
    await expect(orchestrator.runTask('test task', onUpdate, undefined, controller.signal))
      .rejects.toThrow('Task aborted')

    // Manager was called, but coder (the delegated agent) should NOT be called
    expect(mockEngine.generate).toHaveBeenCalledTimes(2) // 1 for Manager, 1 for Observer
    // The second loop iteration should have been blocked by the signal check at the top of the while loop
  })

  it('should pass signal to LLM generate calls', async () => {
    const controller = new AbortController()
    mockEngine.generate.mockResolvedValue('FINISH')

    const onUpdate = vi.fn()
    await orchestrator.runTask('test task', onUpdate, ["manager"], controller.signal)

    expect(mockEngine.generate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: controller.signal
      })
    )
  })
})
