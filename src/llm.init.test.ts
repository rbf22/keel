import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocalLLMEngine } from './llm'
import * as webllm from "@mlc-ai/web-llm"
import { logger } from "./logger"
import * as llmModule from './llm'

// Mock web-llm
vi.mock("@mlc-ai/web-llm", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    CreateMLCEngine: vi.fn(),
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

  it('should include modelId in error message when fetch fails', async () => {
    const fetchError = new Error('Failed to fetch')
    ;(webllm.CreateMLCEngine as any).mockRejectedValue(fetchError)

    await expect(engine.init()).rejects.toThrow(`Failed to download model files for ${modelId}`)
    
    expect(logger.error).toHaveBeenCalledWith(
      'llm',
      expect.stringContaining(`Failed to initialize local engine (${modelId}): Failed to fetch`),
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
