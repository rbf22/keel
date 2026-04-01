import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  HybridLLMEngine, 
  OnlineLLMEngine, 
  GenerateOptions,
  detectBestModel
} from './llm.js';

// Mock dependencies
vi.mock('@mlc-ai/web-llm', () => ({
  prebuiltAppConfig: {
    model_list: []
  },
  modelLibURLPrefix: 'https://mock-prefix.com/',
  modelVersion: 'v1',
  CreateWebWorkerMLCEngine: vi.fn(),
  CreateMLCEngine: vi.fn()
}));

vi.mock('./logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

// Mock fetch for online engine
const mockFetch = vi.fn();
Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true
});

describe('LLM Simple Coverage Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('OnlineLLMEngine', () => {
    let onlineEngine: OnlineLLMEngine;

    beforeEach(() => {
      onlineEngine = new OnlineLLMEngine('test-api-key', 'gemini-1.5-flash');
    });

    it('should initialize correctly', async () => {
      await onlineEngine.init();
      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should handle abort signal', async () => {
      const abortController = new AbortController();
      abortController.abort();

      await expect(
        onlineEngine.generate('test prompt', { signal: abortController.signal })
      ).rejects.toThrow('Generation aborted');
    });

    it('should handle successful streaming response', async () => {
      const mockStreamData = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        'data: [DONE]\n\n'
      ];

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ 
            value: new TextEncoder().encode(mockStreamData[0]), 
            done: false 
          })
          .mockResolvedValueOnce({ 
            value: new TextEncoder().encode(mockStreamData[1]), 
            done: false 
          })
          .mockResolvedValueOnce({ 
            value: new TextEncoder().encode(mockStreamData[2]), 
            done: true 
          })
      };

      const mockResponse = {
        ok: true,
        body: {
          getReader: () => mockReader
        }
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const onToken = vi.fn();
      await onlineEngine.generate('test prompt', { onToken });

      expect(onToken).toHaveBeenCalledWith('Hello world');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('test prompt')
        })
      );
    });

    it('should handle API error response', async () => {
      const mockResponse = {
        ok: false,
        statusText: 'Bad Request',
        json: vi.fn().mockResolvedValue({
          error: { message: 'Invalid API key' }
        })
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(
        onlineEngine.generate('test prompt', {})
      ).rejects.toThrow('Online engine error: Invalid API key');
    });

    it('should handle missing response body', async () => {
      const mockResponse = {
        ok: true,
        body: null
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(
        onlineEngine.generate('test prompt', {})
      ).rejects.toThrow('Failed to get reader from response body');
    });

    it('should handle custom system prompt', async () => {
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ 
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"test"}}]}\n\n'), 
            done: true 
          })
      };

      const mockResponse = {
        ok: true,
        body: { getReader: () => mockReader }
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      await onlineEngine.generate('test prompt', { 
        systemOverride: 'Custom system prompt' 
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('Custom system prompt')
        })
      );
    });
  });

  describe('HybridLLMEngine', () => {
    let hybridEngine: HybridLLMEngine;
    let mockLocalEngine: any;

    beforeEach(() => {
      mockLocalEngine = {
        init: vi.fn(),
        generate: vi.fn(),
        getStats: vi.fn(),
        unload: vi.fn()
      };
      hybridEngine = new HybridLLMEngine(mockLocalEngine);
    });

    it('should initialize local engine', async () => {
      await hybridEngine.init();
      expect(mockLocalEngine.init).toHaveBeenCalled();
    });

    it('should use local engine for generation', async () => {
      mockLocalEngine.generate.mockResolvedValue('Local response');
      
      const result = await hybridEngine.generate('test prompt', {});
      
      expect(result).toBe('Local response');
      expect(mockLocalEngine.generate).toHaveBeenCalledWith('test prompt', {});
    });

    it('should get stats from local engine', async () => {
      mockLocalEngine.getStats.mockResolvedValue('Engine stats');
      
      const stats = await hybridEngine.getStats();
      
      expect(stats).toBe('Engine stats');
      expect(mockLocalEngine.getStats).toHaveBeenCalled();
    });

    it('should unload local engine', async () => {
      await hybridEngine.unload();
      expect(mockLocalEngine.unload).toHaveBeenCalled();
    });
  });

  describe('Model detection', () => {
    it('should detect best model based on WebGPU support', async () => {
      // Mock WebGPU support
      Object.defineProperty(navigator, 'gpu', {
        value: {
          requestAdapter: vi.fn().mockResolvedValue({})
        },
        writable: true
      });

      const bestModel = await detectBestModel();
      
      expect(bestModel).toBeDefined();
      expect(typeof bestModel).toBe('string');
    });

    it('should handle no WebGPU support', async () => {
      // Mock no WebGPU support
      Object.defineProperty(navigator, 'gpu', {
        value: undefined,
        writable: true
      });

      const bestModel = await detectBestModel();
      
      expect(bestModel).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle network errors in online engine', async () => {
      const onlineEngine = new OnlineLLMEngine('test-api-key');
      
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        onlineEngine.generate('test prompt', {})
      ).rejects.toThrow('Network error');
    });

    it('should handle malformed streaming data', async () => {
      const onlineEngine = new OnlineLLMEngine('test-api-key');
      
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ 
            value: new TextEncoder().encode('invalid data'), 
            done: true 
          })
      };

      const mockResponse = {
        ok: true,
        body: { getReader: () => mockReader }
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      // Should handle gracefully
      const result = await onlineEngine.generate('test prompt', {});
      expect(typeof result).toBe('string');
    });

    it('should handle empty streaming response', async () => {
      const onlineEngine = new OnlineLLMEngine('test-api-key');
      
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ 
            value: new TextEncoder().encode(''), 
            done: true 
          })
      };

      const mockResponse = {
        ok: true,
        body: { getReader: () => mockReader }
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await onlineEngine.generate('test prompt', {});
      expect(result).toBe('');
    });
  });
});
