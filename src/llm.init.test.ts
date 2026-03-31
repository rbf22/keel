import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocalLLMEngine } from './llm'
import * as webllm from "@mlc-ai/web-llm"
import { logger } from "./logger"
import * as llmModule from './llm'

// Mock web-llm
vi.mock("@mlc-ai/web-llm", async (importOriginal) => {
  const actual = await importOriginal() as any;
  const mockMLCEngine = vi.fn().mockImplementation(() => ({
    reload: vi.fn(),
    setInitProgressCallback: vi.fn(),
  }));
  return {
    ...actual,
    CreateMLCEngine: vi.fn(),
    MLCEngine: mockMLCEngine,
    prebuiltAppConfig: actual.prebuiltAppConfig || { model_list: [] },
  };
})

// Mock logger
vi.mock("./logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }
}))

describe('LocalLLMEngine Initialization Diagnostics', () => {
  let engine: LocalLLMEngine
  const modelId = 'test-model'

  beforeEach(() => {
    vi.clearAllMocks()
    engine = new LocalLLMEngine(modelId, vi.fn())
    
    // Mock navigator.gpu to make checkWebGPU pass
    const mockGpu = {
      requestAdapter: vi.fn().mockResolvedValue({
        limits: {
          maxStorageBufferBindingSize: 2 * 1024 * 1024 * 1024
        }
      })
    }
    vi.stubGlobal('navigator', { gpu: mockGpu })
  })

  it('should include modelId in error message when reload fails', async () => {
    const fetchError = new Error('Failed to fetch')
    const mockReload = vi.fn().mockRejectedValue(fetchError)
    ;(webllm.MLCEngine as any).mockImplementation(() => ({
      reload: mockReload,
      setInitProgressCallback: vi.fn(),
    }))

    // Use a model ID that exists in CUSTOM_MODEL_LIST to trigger the MLCEngine path
    const customModelId = "SmolLM2-360M-Instruct-q4f16_1-MLC"
    const customEngine = new LocalLLMEngine(customModelId, vi.fn())

    await expect(customEngine.init()).rejects.toThrow(`Failed to download model files for ${customModelId}`)
    
    expect(webllm.MLCEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        appConfig: expect.objectContaining({
          model_list: expect.any(Array)
        })
      })
    )
    expect(mockReload).toHaveBeenCalledWith(customModelId)

    expect(logger.error).toHaveBeenCalledWith(
      'llm',
      expect.stringContaining(`Failed to initialize local engine (${customModelId}): Failed to fetch`),
      expect.any(Object)
    )
  })

  it('should fallback to CreateMLCEngine for unknown models', async () => {
    const unknownModelId = 'unknown-model'
    const unknownEngine = new LocalLLMEngine(unknownModelId, vi.fn())
    
    ;(webllm.CreateMLCEngine as any).mockResolvedValue({})

    await unknownEngine.init()
    
    expect(webllm.CreateMLCEngine).toHaveBeenCalledWith(
      unknownModelId,
      expect.any(Object)
    )
  })

  it('should report specific error message for non-fetch errors', async () => {
    const otherError = new Error('GPU out of memory')
    ;(webllm.CreateMLCEngine as any).mockRejectedValue(otherError)

    await expect(engine.init()).rejects.toThrow('GPU out of memory')
    
    expect(logger.error).toHaveBeenCalledWith(
      'llm',
      expect.stringContaining(`Failed to initialize local engine (${modelId}): GPU out of memory`),
      expect.any(Object)
    )
  })
})
