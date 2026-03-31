import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocalLLMEngine } from './llm'
import * as webllm from "@mlc-ai/web-llm"
import { logger } from "./logger"
import * as llmModule from './llm'

// Mock web-llm
vi.mock("@mlc-ai/web-llm", async (importOriginal) => {
  const actual = await importOriginal() as any;
  const mockCreateServiceWorkerMLCEngine = vi.fn();
  return {
    ...actual,
    CreateServiceWorkerMLCEngine: mockCreateServiceWorkerMLCEngine,
    ServiceWorkerMLCEngine: vi.fn(), // Keep for backward compatibility
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

  it('should include modelId in error message when CreateServiceWorkerMLCEngine fails', async () => {
    const fetchError = new Error('Failed to fetch')
    ;(webllm.CreateServiceWorkerMLCEngine as any).mockRejectedValue(fetchError)

    await expect(engine.init()).rejects.toThrow(`Failed to initialize ServiceWorkerMLCEngine: Failed to fetch`)
    
    expect(webllm.CreateServiceWorkerMLCEngine).toHaveBeenCalledWith(
      modelId,
      expect.objectContaining({
        appConfig: expect.objectContaining({
          model_list: expect.any(Array)
        }),
        initProgressCallback: expect.any(Function)
      })
    )

    expect(logger.error).toHaveBeenCalledWith(
      'llm',
      'ServiceWorkerMLCEngine initialization failed',
      expect.objectContaining({ error: fetchError })
    )
  })

  it('should report specific error message for non-fetch errors', async () => {
    const otherError = new Error('GPU out of memory')
    ;(webllm.CreateServiceWorkerMLCEngine as any).mockRejectedValue(otherError)

    await expect(engine.init()).rejects.toThrow(`Failed to initialize ServiceWorkerMLCEngine: GPU out of memory`)
    
    expect(logger.error).toHaveBeenCalledWith(
      'llm',
      'ServiceWorkerMLCEngine initialization failed',
      expect.objectContaining({ error: otherError })
    )
  })
})
