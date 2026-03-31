import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocalLLMEngine, OnlineLLMEngine, HybridLLMEngine } from './llm'
import * as webllm from "@mlc-ai/web-llm"
import { logger } from "./logger"

// Mock web-llm
vi.mock("@mlc-ai/web-llm", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    ServiceWorkerMLCEngine: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn()
        }
      },
      runtimeStatsText: vi.fn().mockResolvedValue('stats'),
      reload: vi.fn().mockResolvedValue(undefined),
      unload: vi.fn().mockResolvedValue(undefined)
    })),
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

describe('LLM Abort Support', () => {
  describe('LocalLLMEngine', () => {
    let engine: LocalLLMEngine
    let mockMLCEngine: any

    beforeEach(async () => {
      mockMLCEngine = {
        chat: {
          completions: {
            create: vi.fn()
          }
        },
        runtimeStatsText: vi.fn().mockResolvedValue('stats')
      }
      ;(webllm.CreateMLCEngine as any).mockResolvedValue(mockMLCEngine)
      
      // Mock checkWebGPU to pass
      vi.mock('./llm', async (importOriginal) => {
        const actual = await importOriginal() as any
        return {
          ...actual,
          checkWebGPU: vi.fn().mockResolvedValue(true)
        }
      })

      engine = new LocalLLMEngine('test-model', vi.fn())
      // Use internal property access for testing if needed, or just mock the init
      ;(engine as any).engine = mockMLCEngine
    })

    it('should abort local generation when signal is already aborted', async () => {
      const controller = new AbortController()
      controller.abort()

      await expect(engine.generate('test prompt', {
        onToken: vi.fn(),
        signal: controller.signal
      })).rejects.toThrow('Generation aborted')
    })

    it('should abort local generation during streaming', async () => {
      const controller = new AbortController()
      
      // Mock an async generator for chunks
      const mockChunks = (async function* () {
        yield { choices: [{ delta: { content: 'hello' } }] }
        controller.abort() // Abort after first token
        yield { choices: [{ delta: { content: ' world' } }] }
      })()

      mockMLCEngine.chat.completions.create.mockResolvedValue(mockChunks)

      const onToken = vi.fn()
      await expect(engine.generate('test prompt', {
        onToken,
        signal: controller.signal
      })).rejects.toThrow('Generation aborted')

      expect(onToken).toHaveBeenCalledWith('hello')
      expect(onToken).not.toHaveBeenCalledWith('hello world')
    })
  })

  describe('OnlineLLMEngine', () => {
    let engine: OnlineLLMEngine

    beforeEach(() => {
      engine = new OnlineLLMEngine('test-api-key')
      // Mock global fetch
      vi.stubGlobal('fetch', vi.fn())
    })

    it('should abort online generation when signal is already aborted', async () => {
      const controller = new AbortController()
      controller.abort()

      await expect(engine.generate('test prompt', {
        onToken: vi.fn(),
        signal: controller.signal
      })).rejects.toThrow('Generation aborted')
      
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should pass signal to fetch in online engine', async () => {
      const controller = new AbortController()
      
      const mockResponse = {
        ok: true,
        body: {
          getReader: vi.fn().mockReturnValue({
            read: vi.fn().mockResolvedValue({ done: true })
          })
        }
      }
      ;(fetch as any).mockResolvedValue(mockResponse)

      await engine.generate('test prompt', {
        onToken: vi.fn(),
        signal: controller.signal
      })

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          signal: controller.signal
        })
      )
    })
  })

  describe('HybridLLMEngine', () => {
    let hybrid: HybridLLMEngine
    let mockLocal: any
    let mockOnline: any

    beforeEach(() => {
      mockLocal = {
        generate: vi.fn(),
        init: vi.fn()
      }
      mockOnline = {
        generate: vi.fn(),
        init: vi.fn()
      }
      hybrid = new HybridLLMEngine(mockLocal, vi.fn())
      ;(hybrid as any).onlineEngine = mockOnline
      ;(hybrid as any).useOnline = true
    })

    it('should NOT fallback to local if online engine fails due to abort', async () => {
      const controller = new AbortController()
      const error = new Error('Generation aborted')
      mockOnline.generate.mockRejectedValue(error)
      controller.abort()

      await expect(hybrid.generate('test prompt', {
        onToken: vi.fn(),
        signal: controller.signal
      })).rejects.toThrow('Generation aborted')

      expect(mockLocal.generate).not.toHaveBeenCalled()
    })

    it('should fallback to local if online engine fails for other reasons', async () => {
      const controller = new AbortController()
      mockOnline.generate.mockRejectedValue(new Error('Network error'))
      mockLocal.generate.mockResolvedValue('local response')

      const result = await hybrid.generate('test prompt', {
        onToken: vi.fn(),
        signal: controller.signal
      })

      expect(result).toBe('local response')
      expect(mockLocal.generate).toHaveBeenCalled()
    })
  })
})
