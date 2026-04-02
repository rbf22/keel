// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { skillsEngine } from './engine'
import * as storageModule from '../storage/skills'
import type { StoredSkill } from '../storage/skills'

// Define PythonOutput interface locally
interface PythonOutput {
  type: 'log' | 'error' | 'complete'
  message?: string
}

// Define PythonRuntime interface locally
interface PythonRuntime {
  execute: (code: string) => Promise<void>
  onOutput: ((output: PythonOutput) => void) | null
  initialized: boolean
  init: () => Promise<void>
  reset: () => void
}

// Mock the storage module
vi.mock('../storage/skills', () => ({
  skillStorage: {
    getAllSkills: vi.fn(),
    saveSkill: vi.fn(),
    deleteSkill: vi.fn(),
    getSkill: vi.fn()
  }
}))

// Mock the discovery module
vi.mock('./discovery', () => ({
  SKILL_FILES: {
    './calculator/SKILL.md': `---
name: calculator
description: A simple calculator skill that evaluates mathematical expressions
tags: [math, utility]
---

# Calculator Skill

Evaluates mathematical expressions.

## Usage

<skill name="calculator">{"expression": "2 + 2"}</skill>`,
    './analyze-data/SKILL.md': `---
name: analyze-data
description: Analyzes data using Python
tags: [data, analysis]
---

# Data Analysis Skill

Analyzes data using Python.

## Usage

<skill name="analyze-data">{"data": [1, 2, 3]}</skill>`
  },
  SCRIPT_FILES: {},
  REFERENCE_FILES: {}
}))

// Mock fetch for other things
global.fetch = vi.fn().mockImplementation((url: string) => {
  return Promise.resolve({
    ok: false,
    status: 404
  } as Response)
})

// Mock Python runtime
const mockPythonRuntime: PythonRuntime = {
  execute: vi.fn(),
  executeWithTemporaryOutput: vi.fn().mockImplementation(async (handler, fn) => {
    const oldHandler = mockPythonRuntime.onOutput
    mockPythonRuntime.onOutput = handler
    try {
      return await fn()
    } finally {
      mockPythonRuntime.onOutput = oldHandler
    }
  }),
  onOutput: vi.fn()
}

describe('SkillsEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset engine state
    skillsEngine['skillMetadata'].clear()
    skillsEngine['loadedSkills'].clear()
    skillsEngine['initialized'] = false
  })

  it('should initialize and register built-in skills metadata', async () => {
    const mockSkills: StoredSkill[] = []
    vi.mocked(storageModule.skillStorage.getAllSkills).mockResolvedValue(mockSkills)
    
    await skillsEngine.init()
    await skillsEngine.registerBuiltInSkills()
    
    expect(skillsEngine.getAvailableSkillsMetadata()).toContainEqual(
      expect.objectContaining({ name: 'calculator' })
    )
    expect(skillsEngine.getAvailableSkillsMetadata()).toContainEqual(
      expect.objectContaining({ name: 'analyze-data' })
    )
  })

  it('should parse skill calls from LLM response', () => {
    const response = `I'll use a skill to help you.

<skill name="calculator">{"expression": "2 + 2"}</skill>

The result is 4.`
    
    const skillCalls = skillsEngine.parseSkillCalls(response)
    
    expect(skillCalls).toHaveLength(1)
    expect(skillCalls[0]).toEqual({
      name: 'calculator',
      params: { expression: '2 + 2' }
    })
  })

  it('should parse multiple skill calls', () => {
    const response = `<skill name="calculator">{"expression": "2 + 2"}</skill>
<skill name="analyze-data">{"data": "[1,2,3]"}</skill>`
    
    const skillCalls = skillsEngine.parseSkillCalls(response)
    
    expect(skillCalls).toHaveLength(2)
    expect(skillCalls[0].name).toBe('calculator')
    expect(skillCalls[1].name).toBe('analyze-data')
  })

  it('should handle skill calls with text parameters', () => {
    const response = `<skill name="custom-skill">plain text parameter</skill>`
    
    const skillCalls = skillsEngine.parseSkillCalls(response)
    
    expect(skillCalls).toHaveLength(1)
    expect(skillCalls[0]).toEqual({
      name: 'custom-skill',
      params: { text: 'plain text parameter' }
    })
  })

  it('should handle skill execution errors', async () => {
    await skillsEngine.init()
    skillsEngine.registerBuiltInSkills()
    
    // Mock Python execution error
    vi.mocked(mockPythonRuntime.onOutput).mockImplementation(() => {})
    vi.mocked(mockPythonRuntime.execute).mockRejectedValue(new Error('Python error'))
    
    const result = await skillsEngine.executeSkill(
      'calculator',
      { expression: 'invalid' },
      { pythonRuntime: mockPythonRuntime as any }
    )
    
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('should return error for non-existent skill', async () => {
    const result = await skillsEngine.executeSkill(
      'non-existent',
      {},
      { pythonRuntime: mockPythonRuntime as any }
    )
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('Skill not found')
  })

  it('should interpolate parameters into code', () => {
    const code = 'print({{message}})'
    const params = { message: 'Hello World' }
    
    // Access private method for testing
    const interpolated = (skillsEngine as any).interpolateParams(code, params)
    
    expect(interpolated).toBe("print('Hello World')")
  })

  it('should handle JSON parameters in interpolation', () => {
    const code = 'data = {{data}}'
    const params = { data: [1, 2, 3] }
    
    const interpolated = (skillsEngine as any).interpolateParams(code, params)
    
    expect(interpolated).toBe('data = [1,2,3]')
  })

  it('should load skills metadata from storage on initialization', async () => {
    const mockStoredSkill: StoredSkill = {
      name: 'test-skill',
      description: 'Test skill',
      content: `---
name: test-skill
description: Test skill
---
Test content`,
      source: 'test',
      downloadDate: new Date(),
      converted: false
    }
    
    vi.mocked(storageModule.skillStorage.getAllSkills).mockResolvedValue([mockStoredSkill])
    
    await skillsEngine.init()
    
    const availableSkills = skillsEngine.getAvailableSkillsMetadata()
    expect(availableSkills).toContainEqual(
      expect.objectContaining({
        name: 'test-skill',
        description: 'Test skill'
      })
    )
  })
})
