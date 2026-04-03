import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  getAllCachedModels, 
  initializeModelSizes, 
  getCachedModelSizeFromWebLLM,
  setCachedModelSizeFromWebLLM,
  calculateSize
} from './cache';

// Mock IndexedDB
const mockDatabases = [
  { name: 'webllm/model', version: 1 },
  { name: 'webllm/config', version: 1 },
  { name: 'webllm:wasm', version: 1 },
  { name: 'webllm:Llama-3.2-1B-Instruct-q4f16_1-MLC', version: 1 },
  { name: 'webllm:SmolLM2-360M-Instruct-q4f16_1-MLC', version: 1 }
];

describe('Model Cache Regression Tests', () => {
  beforeEach(() => {
    // Clear all caches before each test
    vi.clearAllMocks();
    
    // Mock indexedDB.databases
    Object.defineProperty(globalThis, 'indexedDB', {
      value: {
        databases: vi.fn().mockResolvedValue(mockDatabases),
        open: vi.fn(),
        deleteDatabase: vi.fn()
      },
      writable: true,
      configurable: true
    });
    
    // Mock navigator.storage.estimate
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        storage: {
          estimate: vi.fn().mockResolvedValue({
            usage: 2800000000, // 2.8GB
            quota: 12884901888, // 12GB
            usageDetails: {
              indexedDB: 2790000000,
              serviceWorkerRegistrations: 6260000
            }
          })
        }
      },
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateSize', () => {
    it('should correctly calculate WebLLM data object size', () => {
      const webllmData = {
        data: new ArrayBuffer(1000000),
        url: 'https://example.com/model.bin'
      };
      
      const size = calculateSize(webllmData);
      expect(size).toBe(1000000);
    });

    it('should correctly calculate ArrayBuffer size', () => {
      const buffer = new ArrayBuffer(500000);
      expect(calculateSize(buffer)).toBe(500000);
    });

    it('should correctly calculate Uint8Array size', () => {
      const uint8Array = new Uint8Array(250000);
      expect(calculateSize(uint8Array)).toBe(250000);
    });

    it('should handle null/undefined values', () => {
      expect(calculateSize(null)).toBe(0);
      expect(calculateSize(undefined)).toBe(0);
    });

    it('should estimate string size correctly', () => {
      const str = 'hello world';
      expect(calculateSize(str)).toBe(str.length * 2);
    });

    it('should handle simple objects efficiently', () => {
      const obj = {
        name: 'test',
        value: 42,
        flag: true
      };
      const size = calculateSize(obj);
      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThan(1000); // Should be reasonable
    });
  });

  describe('Model Size Caching', () => {
    it('should cache and retrieve model sizes', () => {
      const modelId = 'test-model';
      const sizeBytes = 123456789;
      
      setCachedModelSizeFromWebLLM(modelId, sizeBytes);
      const retrieved = getCachedModelSizeFromWebLLM(modelId);
      
      expect(retrieved).toBe(sizeBytes);
    });

    it('should return 0 for non-cached models', () => {
      const result = getCachedModelSizeFromWebLLM('non-existent-model');
      expect(result).toBe(0);
    });
  });

  describe('getAllCachedModels', () => {
    it('should handle missing webllm/model database', async () => {
      // Mock databases without webllm/model
      (globalThis.indexedDB as any).databases.mockResolvedValue([
        { name: 'other-db', version: 1 }
      ]);

      const models = await getAllCachedModels();
      expect(models).toEqual([]);
    });

    it('should handle database access errors gracefully', async () => {
      // Mock database error
      (globalThis.indexedDB as any).open.mockImplementation(() => {
        const request = {
          onsuccess: null,
          onerror: null
        };
        setTimeout(() => {
          if (request.onerror) {
            request.onerror({ target: { error: new Error('Database error') } });
          }
        }, 0);
        return request;
      });

      const models = await getAllCachedModels();
      expect(models).toEqual([]);
    });

    it('should return empty array when no models found', async () => {
      // Mock database with no entries
      const mockDb = {
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            openCursor: vi.fn().mockReturnValue({
              result: null,
              addEventListener: vi.fn(),
              onsuccess: null,
              onerror: null
            })
          })
        }),
        close: vi.fn()
      };

      (globalThis.indexedDB as any).open.mockImplementation(() => {
        const request = {
          onsuccess: null,
          onerror: null,
          result: mockDb
        };
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      const models = await getAllCachedModels();
      expect(models).toEqual([]);
    });
  });

  describe('initializeModelSizes', () => {
    it('should handle initialization errors gracefully', async () => {
      // Mock database error
      (globalThis.indexedDB as any).open.mockImplementation(() => {
        const request = {
          onsuccess: null,
          onerror: null
        };
        setTimeout(() => {
          if (request.onerror) {
            request.onerror({ target: { error: new Error('Database error') } });
          }
        }, 0);
        return request;
      });

      // Should not throw
      await expect(initializeModelSizes()).resolves.toBeUndefined();
    });

    it('should skip already cached models', async () => {
      // Pre-cache a model size
      setCachedModelSizeFromWebLLM('Llama-3.2-1B-Instruct-q4f16_1-MLC', 100000000);

      // Should not attempt database access for already cached model
      await initializeModelSizes();
      
      // Verify database wasn't opened (since all models are cached)
      expect(globalThis.indexedDB.open).not.toHaveBeenCalled();
    });

    it('should complete initialization within reasonable time', async () => {
      const startTime = Date.now();

      // Mock database with no entries (fast path)
      const mockDb = {
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            openCursor: vi.fn().mockReturnValue({
              result: null,
              addEventListener: vi.fn(),
              onsuccess: null,
              onerror: null
            })
          })
        }),
        close: vi.fn()
      };

      (globalThis.indexedDB as any).open.mockImplementation(() => {
        const request = {
          onsuccess: null,
          onerror: null,
          result: mockDb
        };
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      await initializeModelSizes();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete quickly
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty webllm/model database', async () => {
      const mockDb = {
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            openCursor: vi.fn().mockReturnValue({
              result: null, // No entries
              addEventListener: vi.fn(),
              onsuccess: null,
              onerror: null
            })
          })
        }),
        close: vi.fn()
      };

      (globalThis.indexedDB as any).open.mockImplementation(() => {
        const request = {
          onsuccess: null,
          onerror: null,
          result: mockDb
        };
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      const models = await getAllCachedModels();
      expect(models).toEqual([]);
    });

    it('should handle very large model entries', async () => {
      const largeEntry = {
        url: 'https://huggingface.co/mlc-ai/Large-Model-MLC/resolve/main/params.bin',
        data: new ArrayBuffer(2000000000) // 2GB
      };

      const mockDb = {
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            openCursor: vi.fn().mockReturnValue({
              result: largeEntry,
              continue: vi.fn(),
              addEventListener: vi.fn(),
              onsuccess: null,
              onerror: null
            })
          })
        }),
        close: vi.fn()
      };

      (globalThis.indexedDB as any).open.mockImplementation(() => {
        const request = {
          onsuccess: null,
          onerror: null,
          result: mockDb
        };
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      const models = await getAllCachedModels();
      expect(models).toHaveLength(1);
      expect(models[0].size).toBe(2000000000);
    });

    it('should handle malformed URLs gracefully', async () => {
      const malformedEntries = [
        { url: '', data: new ArrayBuffer(1000) },
        { url: 'not-a-valid-url', data: new ArrayBuffer(1000) },
        { url: 'https://example.com/no-mlc-pattern.bin', data: new ArrayBuffer(1000) }
      ];

      const mockDb = {
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            openCursor: vi.fn().mockImplementation(() => {
              let index = 0;
              
              return {
                result: index < malformedEntries.length ? {
                  value: malformedEntries[index++],
                  continue: vi.fn()
                } : null,
                addEventListener: vi.fn(),
                onsuccess: null,
                onerror: null
              };
            })
          })
        }),
        close: vi.fn()
      };

      (globalThis.indexedDB as any).open.mockImplementation(() => {
        const request = {
          onsuccess: null,
          onerror: null,
          result: mockDb
        };
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      const models = await getAllCachedModels();
      expect(models).toEqual([]);
    });
  });

  describe('Performance Tests', () => {
    it('should complete getAllCachedModels within reasonable time', async () => {
      const startTime = Date.now();

      // Mock database with many entries but fast cursor
      const mockDb = {
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            openCursor: vi.fn().mockReturnValue({
              result: null, // No entries for fast test
              addEventListener: vi.fn(),
              onsuccess: null,
              onerror: null
            })
          })
        }),
        close: vi.fn()
      };

      (globalThis.indexedDB as any).open.mockImplementation(() => {
        const request = {
          onsuccess: null,
          onerror: null,
          result: mockDb
        };
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      await getAllCachedModels();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within 1 second
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Integration Tests', () => {
    it('should work end-to-end with realistic data', async () => {
      // Test the complete workflow
      const modelId = 'test-integration-model';
      const size = 123456789;

      // Set size
      setCachedModelSizeFromWebLLM(modelId, size);
      
      // Retrieve size
      const retrieved = getCachedModelSizeFromWebLLM(modelId);
      expect(retrieved).toBe(size);
      
      // Initialize (should skip already cached model)
      await initializeModelSizes();
      
      // Should still have the cached size
      expect(getCachedModelSizeFromWebLLM(modelId)).toBe(size);
    });
  });
});
