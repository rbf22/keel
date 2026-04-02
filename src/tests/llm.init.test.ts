import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocalLLMEngine } from '../llm'
import * as webllm from "@mlc-ai/web-llm"
import { logger } from "../logger"
import * as llmModule from '../llm'

// Mock web-llm
vi.mock("@mlc-ai/web-llm", async (importOriginal) => {
  const actual = await importOriginal() as any;
  const mockCreateServiceWorkerMLCEngine = vi.fn();
  const mockCreateMLCEngine = vi.fn();
  return {
    ...actual,
    CreateServiceWorkerMLCEngine: mockCreateServiceWorkerMLCEngine,
    CreateMLCEngine: mockCreateMLCEngine,
    ServiceWorkerMLCEngine: vi.fn(),
    prebuiltAppConfig: actual.prebuiltAppConfig || { model_list: [] },
  };
})

// Mock logger
vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
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

  it('should include modelId in error message when CreateMLCEngine fails', async () => {
    const fetchError = new Error('Failed to fetch')
    ;(webllm.CreateMLCEngine as any).mockRejectedValue(fetchError)

    // The mapError function transforms 'Failed to fetch' into a user-friendly message
    await expect(engine.init()).rejects.toThrow('Failed to download model files for')
    await expect(engine.init()).rejects.toThrow(modelId)
    
    expect(webllm.CreateMLCEngine).toHaveBeenCalledWith(
      modelId,
      expect.objectContaining({
        appConfig: expect.objectContaining({
          model_list: expect.any(Array)
        }),
        initProgressCallback: expect.any(Function)
      })
    )
  })

  it('should report specific error message for non-fetch errors', async () => {
    const otherError = new Error('GPU out of memory')
    ;(webllm.CreateMLCEngine as any).mockRejectedValue(otherError)

    await expect(engine.init()).rejects.toThrow('GPU out of memory')
    
    expect(webllm.CreateMLCEngine).toHaveBeenCalledWith(
      modelId,
      expect.objectContaining({
        appConfig: expect.objectContaining({
          model_list: expect.any(Array)
        }),
        initProgressCallback: expect.any(Function)
      })
    )
  })
})
