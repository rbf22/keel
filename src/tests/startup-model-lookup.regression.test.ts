import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { discoverMLCModels, getDynamicModelList, getSortedModelList } from '../llm/models'
import { LocalLLMEngine } from '../llm'

// Mock dependencies
vi.mock('../storage', () => ({
  storage: {
    init: vi.fn(() => Promise.resolve())
  }
}))

vi.mock('../python-runtime', () => ({
  PythonRuntime: vi.fn(() => ({
    init: vi.fn(() => Promise.resolve())
  }))
}))

vi.mock('../skills/engine', () => ({
  skillsEngine: {
    init: vi.fn(() => Promise.resolve()),
    registerBuiltInSkills: vi.fn(() => Promise.resolve())
  }
}))

vi.mock('../ui', () => ({
  UI: vi.fn(() => ({
    status: {
      setStatus: vi.fn(),
      setPythonStatus: vi.fn()
    },
    skills: {
      refresh: vi.fn()
    },
    vfs: {
      refresh: vi.fn()
    },
    setTab: vi.fn()
  }))
}))

// Mock fetch for GitHub API
vi.mock('global.fetch', () => {
  return vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve([
      { name: 'v0_2_80', type: 'dir' },
      { name: 'SmolLM2-360M-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm', type: 'file', size: 5900000 },
      { name: 'Llama-3.2-1B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm', type: 'file', size: 5500000 }
    ])
  }))
})

describe('Model Lookup Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should discover models from GitHub API', async () => {
    const models = await discoverMLCModels()
    
    expect(models).toBeDefined()
    expect(models.length).toBeGreaterThan(0)
    
    // Should have the expected models from mock data
    expect(models.some(m => m.modelId.includes('SmolLM2-360M'))).toBe(true)
    expect(models.some(m => m.modelId.includes('Llama-3.2-1B'))).toBe(true)
  })

  it('should filter available models only', async () => {
    const models = await discoverMLCModels()
    
    // All models should be marked as available (mocked fetch always succeeds)
    models.forEach(model => {
      expect(model.available).toBe(true)
      expect(model.size).toBeGreaterThan(0)
      expect(model.version).toBe('v0_2_80')
    })
  })

  it('should cache discovery results', async () => {
    const startTime = Date.now()
    
    // First call
    await discoverMLCModels()
    const firstCallDuration = Date.now() - startTime
    
    const secondStartTime = Date.now()
    
    // Second call should be faster (cached)
    await discoverMLCModels()
    const secondCallDuration = Date.now() - secondStartTime
    
    // Second call should be significantly faster due to caching
    expect(secondCallDuration).toBeLessThan(firstCallDuration)
  })

  it('should convert to WebLLM format correctly', async () => {
    const models = await getDynamicModelList()
    
    models.forEach(model => {
      expect(model).toHaveProperty('model_id')
      expect(model).toHaveProperty('model')
      expect(model).toHaveProperty('model_lib')
      expect(model).toHaveProperty('vram_required_MB')
      expect(model).toHaveProperty('required_features')
      expect(model).toHaveProperty('overrides')
      
      // Verify URL structure
      expect(model.model).toContain('huggingface.co')
      expect(model.model_lib).toContain('raw.githubusercontent.com')
      expect(model.model_lib).toContain('.wasm')
    })
  })

  it('should provide sorted models for UI', async () => {
    const models = await getSortedModelList()
    
    expect(models.length).toBeGreaterThan(0)
    
    // Should be sorted by VRAM requirement (descending)
    for (let i = 1; i < models.length; i++) {
      const prev = models[i - 1].vramRequiredMB || 0
      const curr = models[i].vramRequiredMB || 0
      expect(prev).toBeGreaterThanOrEqual(curr)
    }
    
    // Each model should have UI properties
    models.forEach(model => {
      expect(model).toHaveProperty('modelId')
      expect(model).toHaveProperty('displayName')
      expect(model).toHaveProperty('vramRequiredMB')
      expect(model).toHaveProperty('recommendedConfig')
    })
  })

  it('should handle GitHub API failures gracefully', async () => {
    // Mock fetch to fail
    const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')))
    globalThis.fetch = mockFetch
    
    const models = await discoverMLCModels()
    
    // Should return empty array instead of throwing
    expect(models).toEqual([])
  })

  it('should handle empty model list gracefully', async () => {
    // Mock fetch to return empty list for both version and files
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ name: 'v0_2_80', type: 'dir' }])
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([])
      } as Response)
    globalThis.fetch = mockFetch
    
    const models = await getDynamicModelList()
    
    // Should return empty array instead of throwing
    expect(models).toEqual([])
  })

  it('should detect best model from available options', async () => {
    const { detectBestModel } = await import('../llm/models')
    
    // Mock navigator properties
    Object.defineProperty(globalThis.navigator, 'deviceMemory', { value: 8, configurable: true })
    Object.defineProperty(globalThis.navigator, 'gpu', { value: { requestAdapter: vi.fn() }, configurable: true })
    
    const bestModel = await detectBestModel()
    
    expect(bestModel).toBeDefined()
    expect(bestModel.length).toBeGreaterThan(0)
  })
})

describe('LocalLLMEngine Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should use dynamic app config', async () => {
    // Mock web-llm and WebGPU
    vi.mock('@mlc-ai/web-llm', () => ({
      CreateMLCEngine: vi.fn(() => ({
        init: vi.fn(() => Promise.resolve()),
        chat: {
          completions: {
            create: vi.fn(() => Promise.resolve({ choices: [{ message: { content: 'test' } }] }))
          }
        }
      })),
      prebuiltAppConfig: { model_list: [] }
    }))
    
    // Mock WebGPU
    Object.defineProperty(globalThis.navigator, 'gpu', { 
      value: { 
        requestAdapter: vi.fn(() => ({
          features: { has: vi.fn(() => true) },
          limits: { maxStorageBufferBindingSize: 1000000000 }
        }))
      }, 
      configurable: true 
    })

    const engine = new LocalLLMEngine('test-model', vi.fn())
    
    // Should not throw when initializing with dynamic config
    await expect(engine.init()).resolves.toBeUndefined()
  })

  it('should handle model not found in dynamic config', async () => {
    // Mock web-llm with empty model list and WebGPU
    vi.mock('@mlc-ai/web-llm', () => ({
      CreateMLCEngine: vi.fn(() => ({
        init: vi.fn(() => Promise.resolve()),
        chat: {
          completions: {
            create: vi.fn(() => Promise.resolve({ choices: [{ message: { content: 'test' } }] }))
          }
        }
      })),
      prebuiltAppConfig: { model_list: [] }
    }))
    
    // Mock WebGPU
    Object.defineProperty(globalThis.navigator, 'gpu', { 
      value: { 
        requestAdapter: vi.fn(() => ({
          features: { has: vi.fn(() => true) },
          limits: { maxStorageBufferBindingSize: 1000000000 }
        }))
      }, 
      configurable: true 
    })

    const engine = new LocalLLMEngine('non-existent-model', vi.fn())
    
    // Should throw error for non-existent model
    await expect(engine.init()).rejects.toThrow('not found in app config')
  })
})
