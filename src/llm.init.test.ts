import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocalLLMEngine } from './llm'
import * as webllm from "@mlc-ai/web-llm"
import { logger } from "./logger"
import * as llmModule from './llm'

// Mock web-llm
vi.mock("@mlc-ai/web-llm", async (importOriginal) => {
  const actual = await importOriginal() as any;
  const mockServiceWorkerMLCEngine = vi.fn().mockImplementation(() => ({
    reload: vi.fn(),
  }));
  return {
    ...actual,
    ServiceWorkerMLCEngine: mockServiceWorkerMLCEngine,
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
  const modelId = "SmolLM2-360M-Instruct-q4f16_1-MLC"

  beforeEach(() => {
    vi.clearAllMocks()
    engine = new LocalLLMEngine(modelId, vi.fn())
    
    // Mock navigator.gpu to make checkWebGPU pass
    const mockGpu = {
      requestAdapter: vi.fn().mockResolvedValue({
        features: {
          has: vi.fn().mockReturnValue(true)
        },
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
    ;(webllm.ServiceWorkerMLCEngine as any).mockImplementation(() => ({
      reload: mockReload,
    }))

    await expect(engine.init()).rejects.toThrow(`Failed to download model files for ${modelId}`)
    
    expect(webllm.ServiceWorkerMLCEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        appConfig: expect.objectContaining({
          model_list: expect.any(Array)
        })
      }),
      expect.any(Number)
    )
    expect(mockReload).toHaveBeenCalledWith(modelId, expect.any(Object))

    expect(logger.error).toHaveBeenCalledWith(
      'llm',
      expect.stringContaining(`Failed to initialize local engine (${modelId}): Failed to download model files for ${modelId}`),
      expect.any(Object)
    )
  })

  it('should report specific error message for non-fetch errors', async () => {
    const otherError = new Error('GPU out of memory')
    const mockReload = vi.fn().mockRejectedValue(otherError)
    ;(webllm.ServiceWorkerMLCEngine as any).mockImplementation(() => ({
      reload: mockReload,
    }))

    await expect(engine.init()).rejects.toThrow('GPU out of memory')
    
    expect(logger.error).toHaveBeenCalledWith(
      'llm',
      expect.stringContaining(`Failed to initialize local engine (${modelId}): GPU out of memory`),
      expect.any(Object)
    )
  })
})
