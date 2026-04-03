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

const mockModelEntries = [
  {
    url: 'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/params_shard_0.bin',
    data: new ArrayBuffer(125250000) // 125.25 MB
  },
  {
    url: 'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/params_shard_1.bin',
    data: new ArrayBuffer(16000000) // 16.00 MB
  },
  {
    url: 'https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC/resolve/main/params_shard_0.bin',
    data: new ArrayBuffer(31910000) // 31.91 MB
  },
  {
    url: 'https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC/resolve/main/tokenizer.json',
    data: new ArrayBuffer(2100000) // 2.1 MB
  }
];

describe('Model Cache Regression Tests', () => {
  beforeEach(() => {
    // Clear all caches before each test
    vi.clearAllMocks();
    
    // Mock indexedDB.databases
    (globalThis as any).indexedDB = {
      databases: vi.fn().mockResolvedValue(mockDatabases),
      open: vi.fn(),
      deleteDatabase: vi.fn()
    };
    
    // Mock navigator.storage.estimate
    (globalThis as any).navigator = {
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
    };
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
    it('should detect models from webllm/model database', async () => {
      // Mock the database opening and cursor operations
      const mockDb = {
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            openCursor: vi.fn().mockImplementation(() => {
              const mockEntries = mockModelEntries;
              let index = 0;
              
              return {
                result: index < mockEntries.length ? {
                  value: mockEntries[index++],
                  continue: vi.fn().mockImplementation(() => {
                    // Simulate cursor continuation
                    if (index < mockEntries.length) {
                      return Promise.resolve();
                    }
                  })
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

      const mockOpenRequest = {
        onsuccess: null,
        onerror: null,
        result: mockDb
      };

      (indexedDB.open as any).mockImplementation((dbName: string) => {
        if (dbName === 'webllm/model') {
          setTimeout(() => {
            if (mockOpenRequest.onsuccess) {
              mockOpenRequest.onsuccess({ target: mockOpenRequest });
            }
          }, 0);
          return mockOpenRequest;
        }
        return mockOpenRequest;
      });

      const models = await getAllCachedModels();
      
      expect(models).toBeDefined();
      expect(models.length).toBeGreaterThan(0);
      
      // Should find the expected models
      const modelIds = models.map((m: any) => m.modelId);
      expect(modelIds.some((id: string) => id.includes('Llama-3.2-1B-Instruct'))).toBe(true);
      expect(modelIds.some((id: string) => id.includes('SmolLM2-360M-Instruct'))).toBe(true);
      
      // Should have reasonable sizes
      const llamaModel = models.find((m: any) => m.modelId.includes('Llama-3.2-1B'));
      if (llamaModel) {
        expect(llamaModel.size).toBeGreaterThan(100000000); // Should be > 100MB
      }
    });

    it('should handle database access errors gracefully', async () => {
      // Mock database error
      (indexedDB.open as any).mockImplementation(() => {
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

    it('should cache results to avoid repeated database access', async () => {
      // Mock successful database access
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

      (indexedDB.open as any).mockImplementation(() => {
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

      // Call multiple times
      await getAllCachedModels();
      await getAllCachedModels();
      await getAllCachedModels();

      // Should only open database once due to caching
      expect(indexedDB.open).toHaveBeenCalledTimes(1);
    });
  });

  describe('initializeModelSizes', () => {
    it('should initialize sizes for configured models', async () => {
      // Mock successful size calculation
      const mockDb = {
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            openCursor: vi.fn().mockImplementation(() => {
              const mockEntries = mockModelEntries;
              let index = 0;
              
              return {
                result: index < mockEntries.length ? {
                  value: mockEntries[index++],
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

      (indexedDB.open as any).mockImplementation(() => {
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

      // Should have cached sizes for the configured models
      expect(getCachedModelSizeFromWebLLM('Llama-3.2-1B-Instruct-q4f16_1-MLC')).toBeGreaterThan(0);
      expect(getCachedModelSizeFromWebLLM('Llama-3.2-3B-Instruct-q4f16_1-MLC')).toBe(0); // No entries for this model
      expect(getCachedModelSizeFromWebLLM('SmolLM2-360M-Instruct-q4f16_1-MLC')).toBeGreaterThan(0);
    });

    it('should skip already cached models', async () => {
      // Pre-cache a model size
      setCachedModelSizeFromWebLLM('Llama-3.2-1B-Instruct-q4f16_1-MLC', 100000000);

      // Mock database
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

      (indexedDB.open as any).mockImplementation(() => {
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

      // Should not have opened database for already cached model
      expect(indexedDB.open).toHaveBeenCalledTimes(0);
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock database error
      (indexedDB.open as any).mockImplementation(() => {
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
  });

  describe('Performance Regression Tests', () => {
    it('should complete getAllCachedModels within reasonable time', async () => {
      const startTime = Date.now();

      // Mock database with many entries
      const manyEntries = Array.from({ length: 100 }, (_, i) => ({
        url: `https://example.com/model_${i}.bin`,
        data: new ArrayBuffer(1000000) // 1MB each
      }));

      const mockDb = {
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            openCursor: vi.fn().mockImplementation(() => {
              let index = 0;
              
              return {
                result: index < manyEntries.length ? {
                  value: manyEntries[index++],
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

      (indexedDB.open as any).mockImplementation(() => {
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
      
      // Should complete within 5 seconds (much faster than the old implementation)
      expect(duration).toBeLessThan(5000);
    });

    it('should not load all entries into memory simultaneously', async () => {
      let maxOpenCursors = 0;
      let currentOpenCursors = 0;

      const mockDb = {
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            openCursor: vi.fn().mockImplementation(() => {
              currentOpenCursors++;
              maxOpenCursors = Math.max(maxOpenCursors, currentOpenCursors);
              
              return {
                result: {
                  continue: vi.fn().mockImplementation(() => {
                    currentOpenCursors--;
                  })
                },
                addEventListener: vi.fn(),
                onsuccess: null,
                onerror: null
              };
            })
          })
        }),
        close: vi.fn()
      };

      (indexedDB.open as any).mockImplementation(() => {
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
      
      // Should never have more than a few cursors open at once
      expect(maxOpenCursors).toBeLessThan(10);
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

      (indexedDB.open as any).mockImplementation(() => {
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

      (indexedDB.open as any).mockImplementation(() => {
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
            openCursor: vi.fn().mockImplementation(() => {
              return {
                result: largeEntry,
                continue: vi.fn(),
                addEventListener: vi.fn(),
                onsuccess: null,
                onerror: null
              };
            })
          })
        }),
        close: vi.fn()
      };

      (indexedDB.open as any).mockImplementation(() => {
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
  });
});
