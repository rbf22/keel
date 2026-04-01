// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgentOrchestrator } from './orchestrator'
import { LLMEngine } from './llm'
import { PythonRuntime } from './python-runtime'
import { skillsEngine } from './skills/engine'
import 'fake-indexeddb/auto'

// Mock dependencies
vi.mock('./skills/engine', () => ({
  skillsEngine: {
    init: vi.fn(),
    executeSkill: vi.fn(),
    getSkillsDescription: vi.fn().mockReturnValue('Research: Web fetching and information gathering\nPython-Coding: Python code development and execution'),
    hasSkill: vi.fn().mockReturnValue(true)
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

describe('SkillBasedOrchestrator - Core Functionality', () => {
  let orchestrator: AgentOrchestrator
  let mockEngine: LLMEngine
  let mockPython: PythonRuntime
  let capturedEvents: any[] = []

  beforeEach(() => {
    mockEngine = {
      generate: vi.fn(),
      getStats: vi.fn()
    } as any

    mockPython = {
      onOutput: vi.fn(),
      execute: vi.fn(),
      executeWithTemporaryOutput: vi.fn(),
      initialized: false,
      init: vi.fn(),
      reset: vi.fn()
    }

    orchestrator = new AgentOrchestrator(mockEngine, mockPython)
    capturedEvents = []

    // Mock successful skill execution by default
    vi.mocked(skillsEngine.executeSkill).mockResolvedValue({
      success: true,
      output: 'Task completed successfully'
    })
  })

  describe('Basic Functionality', () => {
    it('should execute a simple task successfully', async () => {
      await orchestrator.runTask('Simple test task', (event) => {
        capturedEvents.push(event)
      })

      expect(capturedEvents.length).toBeGreaterThan(0)
      
      // Should have skill execution events
      const skillEvents = capturedEvents.filter(e => 
        e.content.includes('Executing skill')
      )
      expect(skillEvents.length).toBeGreaterThan(0)

      // Should have observer analysis events
      const observerEvents = capturedEvents.filter(e => 
        e.personaId === 'observer'
      )
      expect(observerEvents.length).toBeGreaterThan(0)
    })

    it('should return chat history', async () => {
      const chatHistory = await orchestrator.runTask('Test task', () => {})
      
      expect(Array.isArray(chatHistory)).toBe(true)
      expect(chatHistory.length).toBeGreaterThan(0)
      expect(chatHistory[0]).toHaveProperty('role')
      expect(chatHistory[0]).toHaveProperty('content')
    })

    it('should validate input parameters', async () => {
      await expect(orchestrator.runTask('', () => {})).rejects.toThrow('User request must be a non-empty string')
      await expect(orchestrator.runTask(null as any, () => {})).rejects.toThrow('User request must be a non-empty string')
      await expect(orchestrator.runTask('test', null as any)).rejects.toThrow('onUpdate must be a function')
    })
  })

  describe('Skill Selection', () => {
    it('should select research skill for investigation tasks', async () => {
      await orchestrator.runTask('Research climate change', (event) => {
        capturedEvents.push(event)
      })

      const researchEvents = capturedEvents.filter(e => 
        e.content.includes('Executing skill: research')
      )
      expect(researchEvents.length).toBeGreaterThan(0)
    })

    it('should select python-coding skill for code tasks', async () => {
      await orchestrator.runTask('Write a Python function', (event) => {
        capturedEvents.push(event)
      })

      const codingEvents = capturedEvents.filter(e => 
        e.content.includes('Executing skill: python-coding')
      )
      expect(codingEvents.length).toBeGreaterThan(0)
    })

    it('should select data-analysis skill for analysis tasks', async () => {
      await orchestrator.runTask('Analyze the dataset', (event) => {
        capturedEvents.push(event)
      })

      const analysisEvents = capturedEvents.filter(e => 
        e.content.includes('Executing skill: data-analysis')
      )
      expect(analysisEvents.length).toBeGreaterThan(0)
    })

    it('should default to python-coding for general tasks', async () => {
      await orchestrator.runTask('Do something', (event) => {
        capturedEvents.push(event)
      })

      const codingEvents = capturedEvents.filter(e => 
        e.content.includes('Executing skill: python-coding')
      )
      expect(codingEvents.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle skill execution errors gracefully', async () => {
      vi.mocked(skillsEngine.executeSkill).mockResolvedValue({
        success: false,
        error: 'Skill execution failed'
      })

      await orchestrator.runTask('Test task', (event) => {
        capturedEvents.push(event)
      })

      const errorEvents = capturedEvents.filter(e => 
        e.content.includes('Skill execution failed')
      )
      expect(errorEvents.length).toBeGreaterThan(0)
    })

    it('should handle skill not found errors', async () => {
      vi.mocked(skillsEngine.hasSkill).mockReturnValue(false)

      await orchestrator.runTask('Test task', (event) => {
        capturedEvents.push(event)
      })

      // Should still complete without crashing
      expect(capturedEvents.length).toBeGreaterThan(0)
    })

    it('should handle invalid skill results', async () => {
      vi.mocked(skillsEngine.executeSkill).mockResolvedValue(null as any)

      await orchestrator.runTask('Test task', (event) => {
        capturedEvents.push(event)
      })

      const errorEvents = capturedEvents.filter(e => 
        e.content.includes('Skill execution failed')
      )
      expect(errorEvents.length).toBeGreaterThan(0)
    })
  })

  describe('Legacy Compatibility', () => {
    it('should support executeTool method for backward compatibility', async () => {
      const result = await orchestrator.executeTool('web_fetch', { task: 'Fetch data from https://example.com' }, vi.fn())
      
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should map tool names to skills correctly', async () => {
      const webFetchResult = await orchestrator.executeTool('web_fetch', { task: 'Fetch data from test' }, vi.fn())
      const pythonResult = await orchestrator.executeTool('execute_python', { task: 'Execute Python code' }, vi.fn())
      
      expect(typeof webFetchResult).toBe('string')
      expect(typeof pythonResult).toBe('string')
    })
  })
})
