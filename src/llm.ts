import * as webllm from "@mlc-ai/web-llm";
import { logger } from "./logger"
import { 
  MODEL_VRAM_THRESHOLDS, 
  LLM_GENERATION_DELAY,
  LLM_ENGINE_INIT_TIMEOUT,
  LLM_ABSOLUTE_TIMEOUT
} from "./constants"
// import { modelVerifier } from "./utils/model-verification";

// Track cached model sizes reported by WebLLM during loading
const cachedModelSizes = new Map<string, number>();

export function getCachedModelSizeFromWebLLM(modelId: string): number {
  return cachedModelSizes.get(modelId) || 0;
}

export function setCachedModelSizeFromWebLLM(modelId: string, sizeBytes: number): void {
  cachedModelSizes.set(modelId, sizeBytes);
}

// Default model ID - using SmolLM2 as it's the smallest and most compatible
const DEFAULT_MODEL_ID = "SmolLM2-360M-Instruct-q4f16_1-MLC";

export async function checkWebGPU() {
  logger.debug('llm', 'Checking WebGPU support');
  if (!(navigator as any).gpu) {
    logger.error('llm', 'WebGPU not supported on this browser');
    throw new Error("WebGPU is not supported on this browser.");
  }
  const adapter = await (navigator as any).gpu.requestAdapter();
  if (!adapter) {
    logger.error('llm', 'WebGPU adapter not found');
    throw new Error("WebGPU adapter not found.");
  }
  logger.info('llm', 'WebGPU support confirmed', { 
    adapterInfo: (adapter as any).info || 'Unknown',
    hasShaderF16: adapter.features.has('shader-f16')
  });
  return true;
}

export async function detectBestModel(): Promise<string> {
  logger.info('llm', 'Starting best model detection');
  try {
    const memory = (navigator as any).deviceMemory; // in GB
    const gpu = (navigator as any).gpu;
    if (!gpu) {
      logger.warn('llm', 'No GPU available, using default model');
      return DEFAULT_MODEL_ID;
    }

    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      logger.warn('llm', 'GPU adapter not found, using default model');
      return DEFAULT_MODEL_ID;
    }

    const hasShaderF16 = adapter.features.has("shader-f16");
    const limits = adapter.limits;
    
    logger.debug('llm', 'GPU capabilities detected', {
      deviceMemoryGB: memory,
      adapterInfo: (adapter as any).info || 'Unknown',
      hasShaderF16,
      maxStorageBufferBindingSize: limits.maxStorageBufferBindingSize
    });
    
    // Heuristic for available VRAM: often maxStorageBufferBindingSize is a good indicator
    // but not always the whole picture. 
    const maxBufferMB = limits.maxStorageBufferBindingSize / (1024 * 1024);

    // Get cached sorted models by VRAM requirement (descending) to find the best fit
    const candidates = getSortedModelList();

    for (const model of candidates) {
      // Check feature requirements
      if (model.requiredFeatures?.includes("shader-f16") && !hasShaderF16) {
        logger.debug('llm', 'Skipping model due to missing shader-f16 feature', { 
          modelId: model.modelId 
        });
        continue;
      }

      // Check VRAM requirements
      // We use a safety margin: required VRAM should be less than ~80% of what max buffer size suggests
      // OR if we have deviceMemory info, use that as a proxy for total system capacity.
      const vramLimit = model.vramRequiredMB || 0;
      
      logger.debug('llm', 'Evaluating model', { 
        modelId: model.modelId,
        vramRequiredMB: vramLimit,
        maxBufferMB
      });
      
      // Heuristic: If we have 8GB+ system RAM, we can likely handle Llama 3B (2.2GB VRAM)
      // if the GPU adapter limits allow large enough buffers.
      if (memory && memory >= MODEL_VRAM_THRESHOLDS.HIGH_MEMORY_THRESHOLD && vramLimit > MODEL_VRAM_THRESHOLDS.MEDIUM_MODEL) {
        if (maxBufferMB >= MODEL_VRAM_THRESHOLDS.HIGH_BUFFER_SIZE) {
          logger.info('llm', 'Selected high-memory model', { 
            modelId: model.modelId,
            systemMemoryGB: memory,
            vramRequiredMB: vramLimit
          });
          return model.modelId;
        }
      }
      
      if (memory && memory >= MODEL_VRAM_THRESHOLDS.MEDIUM_MEMORY_THRESHOLD && vramLimit > MODEL_VRAM_THRESHOLDS.SMALL_MODEL) {
        if (maxBufferMB >= MODEL_VRAM_THRESHOLDS.MEDIUM_BUFFER_SIZE) {
          logger.info('llm', 'Selected medium-memory model', { 
            modelId: model.modelId,
            systemMemoryGB: memory,
            vramRequiredMB: vramLimit
          });
          return model.modelId;
        }
      }

      // If it's a very small model (like SmolLM 360M), just check shader support
      if (vramLimit < MODEL_VRAM_THRESHOLDS.SMALL_MODEL) {
        logger.info('llm', 'Selected small model', { 
          modelId: model.modelId,
          vramRequiredMB: vramLimit
        });
        return model.modelId;
      }
    }

    logger.warn('llm', 'No suitable model found, using default', { 
      defaultModel: DEFAULT_MODEL_ID 
    });
    return DEFAULT_MODEL_ID;
  } catch (e) {
    logger.warn("llm", "Error detecting best model, falling back to default", { error: e });
    return DEFAULT_MODEL_ID;
  }
}

export interface ModelInfo {
  modelId: string;
  displayName: string;
  vramRequiredMB?: number;
  requiredFeatures?: string[];
  recommendedConfig?: {
    temperature?: number;
    top_p?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    repetition_penalty?: number;
  };
}

// Custom model configuration to handle potential fetch failures from default CDNs
export const CUSTOM_MODEL_LIST: (webllm.ModelRecord & { recommended_config?: ModelInfo['recommendedConfig'] })[] = [
  {
    model_id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    model: "https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC/resolve/main/",
    model_lib: webllm.modelLibURLPrefix + webllm.modelVersion + "/SmolLM2-360M-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
    vram_required_MB: 376.06,
    low_resource_required: true,
    required_features: ["shader-f16"],
    recommended_config: {
      temperature: 0.7,
      top_p: 0.9,
      repetition_penalty: 1.0
    }
  },
  {
    model_id: "TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC", 
    model: "https://huggingface.co/mlc-ai/TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC/resolve/main/",
    model_lib: webllm.modelLibURLPrefix + webllm.modelVersion + "/TinyLlama-1.1B-Chat-v0.4-q4f16_1-ctx4k_cs1k-webgpu.wasm",
    vram_required_MB: 0,
    required_features: [],
    recommended_config: {
      temperature: 0.7,
      top_p: 0.9,
      repetition_penalty: 1.0
    }
  },
  {
    model_id: "SmolLM2-135M-Instruct-q0f16-MLC",
    model: "https://huggingface.co/mlc-ai/SmolLM2-135M-Instruct-q0f16-MLC/resolve/main/",
    model_lib: webllm.modelLibURLPrefix + webllm.modelVersion + "/SmolLM2-135M-Instruct-q0f16-ctx4k_cs1k-webgpu.wasm",
    vram_required_MB: 0,
    low_resource_required: true,
    required_features: ["shader-f16"],
    overrides: {
      context_window_size: 4096,
    },
    recommended_config: {
      temperature: 0.7,
      top_p: 0.9,
      repetition_penalty: 1.0
    }
  },
  {
    model_id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    model: "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/",
    model_lib: webllm.modelLibURLPrefix + webllm.modelVersion + "/Llama-3.2-1B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
    vram_required_MB: 879.04,
    low_resource_required: true,
    required_features: ["shader-f16"],
    overrides: {
      context_window_size: 4096,
    },
    recommended_config: {
      temperature: 0.6,
      top_p: 0.9,
    }
  },
  {
    model_id: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
    model: "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f32_1-MLC/resolve/main/",
    model_lib: webllm.modelLibURLPrefix + webllm.modelVersion + "/Llama-3.2-1B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
    vram_required_MB: 1700.00,
    low_resource_required: true,
    overrides: {
      context_window_size: 4096,
    },
    recommended_config: {
      temperature: 0.6,
      top_p: 0.9,
    }
  },
  {
    model_id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    model: "https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC/resolve/main/",
    model_lib: webllm.modelLibURLPrefix + webllm.modelVersion + "/Llama-3.2-3B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
    vram_required_MB: 2263.69,
    low_resource_required: true,
    required_features: ["shader-f16"],
    overrides: {
      context_window_size: 4096,
    },
    recommended_config: {
      temperature: 0.6,
      top_p: 0.9,
    }
  },
];

export const CUSTOM_APP_CONFIG: webllm.AppConfig = {
  ...webllm.prebuiltAppConfig,
  model_list: [
    ...webllm.prebuiltAppConfig.model_list.filter(m => !CUSTOM_MODEL_LIST.some(cm => cm.model_id === m.model_id)),
    ...CUSTOM_MODEL_LIST
  ],
  useIndexedDBCache: true,
};

// Map our custom models to the ModelInfo format for the UI
export const SUPPORTED_MODELS: ModelInfo[] = CUSTOM_MODEL_LIST.map(m => ({
  modelId: m.model_id,
  displayName: m.model_id.split('-MLC')[0].replace(/-/g, ' '),
  vramRequiredMB: m.vram_required_MB,
  requiredFeatures: m.required_features,
  recommendedConfig: m.recommended_config || {
    temperature: 0.7,
    top_p: 0.9,
    repetition_penalty: 1.0,
    presence_penalty: 0.0,
    frequency_penalty: 0.0
  }
}));

// Cache sorted model list for performance
let sortedModelList: typeof SUPPORTED_MODELS | null = null;

function getSortedModelList(): typeof SUPPORTED_MODELS {
  if (!sortedModelList) {
    sortedModelList = [...SUPPORTED_MODELS].sort((a, b) => 
      (b.vramRequiredMB || 0) - (a.vramRequiredMB || 0)
    );
  }
  return sortedModelList;
}

export interface GenerateOptions {
  onToken?: (text: string) => void;
  history?: webllm.ChatCompletionMessageParam[];
  systemOverride?: string;
  signal?: AbortSignal;
}

export interface ILLMEngine {
  init(): Promise<void>;
  generate(prompt: string, options: GenerateOptions): Promise<string>;
  getStats(): Promise<string | null>;
  unload?(): Promise<void>;
}

const DEFAULT_SYSTEM_PROMPT = `You are Keel, a local-first AI agent with access to Python execution and skills.

Available Skills:
- Use <skill name="skillName">{"param": "value"}</skill> for specific high-level tasks.

Python Environment:
- Use triple-backtick blocks: \`\`\`python
- Libraries: 'pandas', 'numpy' are pre-installed.
- Output Helpers:
  - download_file(filename, content): Provide a downloadable file.
  - log(message): Print text to the output panel.

Guidelines:
- If previous code failed, analyze the error and provide a corrected version.
- Be concise and focus on solving the user's request efficiently.`;

// Fix various problems in webllm generation
export function fixMessage(message: string) {
  // RedPajama model incorrectly includes `<human` in response
  message = message.replace(/(<human\s*)+$/, "");
  // Remove Qwen think tags and content if needed (optional based on UX)
  // message = message.replace(/<think>[\s\S]*?<\/think>/g, "");
  return message;
}

export function mapError(err: unknown, modelId: string): string {
  const errorMessage = err instanceof Error ? err.message : String(err);
  
  if (errorMessage.includes("WebGPU") && errorMessage.includes("compatibility chart")) {
    return `WebGPU error: Your browser or hardware may not support this model. Check the [WebGPU compatibility chart](https://caniuse.com/webgpu).`;
  }
  
  if (errorMessage.includes("Failed to fetch")) {
    return `Failed to download model files for ${modelId}. Please check your internet connection.`;
  }

  return errorMessage;
}

export class LocalLLMEngine implements ILLMEngine {
  private engine: webllm.MLCEngine | null = null;
  private onUpdate: (message: string) => void;
  private modelId: string;
  private isGenerating = false;
  
  // Timeout properties
  private engineInitTimeout = LLM_ENGINE_INIT_TIMEOUT;
  private absoluteTimeout = LLM_ABSOLUTE_TIMEOUT;

  constructor(modelId: string, onUpdate: (message: string) => void) {
    this.modelId = modelId;
    this.onUpdate = onUpdate;
    logger.info("llm", `LocalLLMEngine initialized with Service Worker`);
  }

  // Check if model is cached in IndexedDB
  async isModelCached(): Promise<boolean> {
    logger.info("llm", "[CACHE] Starting IndexedDB cache check", { modelId: this.modelId });
    
    try {
      // WebLLM stores model data in IndexedDB with database name pattern: webllm:${modelId}
      const dbName = `webllm:${this.modelId}`;
      logger.debug("llm", "[CACHE] Checking IndexedDB database", { dbName });
      
      return new Promise((resolve) => {
        const request = indexedDB.open(dbName);
        
        request.onsuccess = () => {
          const db = request.result;
          const hasStores = db.objectStoreNames.length > 0;
          db.close();
          
          logger.info("llm", "[CACHE] IndexedDB check complete", {
            modelId: this.modelId,
            dbName,
            isCached: hasStores,
            storeCount: db.objectStoreNames.length
          });
          
          resolve(hasStores);
        };
        
        request.onerror = () => {
          logger.debug("llm", "[CACHE] Failed to open IndexedDB (model not cached)", { dbName });
          resolve(false);
        };
        
        request.onupgradeneeded = (event) => {
          // Database doesn't exist, model is not cached
          const db = (event.target as IDBOpenDBRequest).result;
          db.close();
          logger.debug("llm", "[CACHE] IndexedDB doesn't exist (model not cached)", { dbName });
        };
        
        // Timeout in case IndexedDB hangs
        setTimeout(() => {
          logger.debug("llm", "[CACHE] IndexedDB check timed out", { dbName });
          resolve(false);
        }, 2000);
      });
    } catch (error) {
      logger.error("llm", "[CACHE] Failed to check model cache", { 
        error, 
        modelId: this.modelId 
      });
      return false;
    }
  }

  // Get cached model size from IndexedDB or WebLLM tracked size
  async getCachedModelSize(): Promise<number> {
    logger.info("llm", "[CACHE] Getting cached model size", { modelId: this.modelId });
    
    // First check WebLLM-tracked size (captured during loading)
    const webllmSize = getCachedModelSizeFromWebLLM(this.modelId);
    if (webllmSize > 0) {
      logger.info("llm", "[CACHE] Using WebLLM-tracked size", {
        modelId: this.modelId,
        size: webllmSize,
        sizeMB: (webllmSize / 1024 / 1024).toFixed(2)
      });
      return webllmSize;
    }
    
    // Fall back to IndexedDB size calculation
    try {
      const dbName = `webllm:${this.modelId}`;
      const size = await this.getIndexedDBModelSize(dbName);
      
      logger.info("llm", "[CACHE] IndexedDB size calculated", {
        modelId: this.modelId,
        totalSize: size,
        totalSizeMB: (size / 1024 / 1024).toFixed(2)
      });
      
      return size;
    } catch (error) {
      logger.error("llm", "[CACHE] Failed to get cached model size", { 
        error, 
        modelId: this.modelId,
        errorType: error?.constructor?.name
      });
      return 0;
    }
  }

  // Get model size from WebLLM's IndexedDB storage
  private async getIndexedDBModelSize(dbName: string): Promise<number> {
    try {
      return new Promise((resolve) => {
        const request = indexedDB.open(dbName);
        
        request.onsuccess = () => {
          const db = request.result;
          const storeNames = Array.from(db.objectStoreNames);
          
          logger.debug("llm", "[CACHE] IndexedDB stores found", { 
            dbName,
            storeCount: storeNames.length 
          });
          
          if (storeNames.length === 0) {
            db.close();
            resolve(0);
            return;
          }
          
          // Helper to recursively calculate size of nested objects
          const calculateSize = (value: unknown): number => {
            if (value === null || value === undefined) return 0;
            
            if (value instanceof ArrayBuffer) {
              return value.byteLength;
            }
            
            if (ArrayBuffer.isView(value)) {
              return value.byteLength;
            }
            
            if (typeof value === 'string') {
              return value.length * 2;
            }
            
            if (typeof value === 'number') {
              return 8;
            }
            
            if (typeof value === 'boolean') {
              return 4;
            }
            
            if (Array.isArray(value)) {
              return value.reduce((sum, item) => sum + calculateSize(item), 0);
            }
            
            if (typeof value === 'object') {
              let size = 0;
              for (const key in value as Record<string, unknown>) {
                if (Object.prototype.hasOwnProperty.call(value, key)) {
                  size += key.length * 2;
                  size += calculateSize((value as Record<string, unknown>)[key]);
                }
              }
              return size;
            }
            
            return 0;
          };
          
          const checkStore = (storeName: string) => {
            return new Promise<number>((storeResolve) => {
              try {
                const transaction = db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                let storeSize = 0;
                const cursorRequest = store.openCursor();
                
                cursorRequest.onsuccess = (event) => {
                  const cursor = (event.target as IDBRequest).result;
                  if (cursor) {
                    storeSize += calculateSize(cursor.value);
                    cursor.continue();
                  } else {
                    logger.debug("llm", "[CACHE] IndexedDB store size", { 
                      storeName,
                      size: storeSize,
                      sizeMB: (storeSize / 1024 / 1024).toFixed(2)
                    });
                    storeResolve(storeSize);
                  }
                };
                
                cursorRequest.onerror = () => storeResolve(0);
              } catch (e) {
                storeResolve(0);
              }
            });
          };
          
          Promise.all(storeNames.map(checkStore)).then((sizes) => {
            const totalSize = sizes.reduce((sum, s) => sum + s, 0);
            db.close();
            resolve(totalSize);
          }).catch(() => {
            db.close();
            resolve(0);
          });
        };
        
        request.onerror = () => {
          logger.debug("llm", "[CACHE] Failed to open IndexedDB", { dbName });
          resolve(0);
        };
        
        setTimeout(() => resolve(0), 5000);
      });
    } catch (error) {
      logger.debug("llm", "[CACHE] Error checking IndexedDB", { error });
      return 0;
    }
  }

  // Clear cached model from IndexedDB
  async clearCachedModel(): Promise<void> {
    try {
      const dbName = `webllm:${this.modelId}`;
      await indexedDB.deleteDatabase(dbName);
      logger.info("llm", `Cleared cached model from IndexedDB: ${this.modelId}`);
    } catch (error) {
      logger.error("llm", "Failed to clear cached model", { error, modelId: this.modelId });
      throw error;
    }
  }

  // Clear corrupted model and retry
  async clearCorruptedModelAndRetry(): Promise<void> {
    logger.warn("llm", "Clearing potentially corrupted model cache", { modelId: this.modelId });
    await this.clearCachedModel();
    // Also clear any other IndexedDB databases for this model
    try {
      if (typeof indexedDB !== 'undefined') {
        const dbName = `webllm:${this.modelId}`;
        await indexedDB.deleteDatabase(dbName);
        logger.info("llm", `Deleted IndexedDB for model: ${this.modelId}`);
      }
    } catch (error) {
      logger.warn("llm", "Failed to clear IndexedDB", { error });
    }
  }

  // Clear all cached models from IndexedDB
  static async clearAllCachedModels(): Promise<void> {
    try {
      if (typeof indexedDB === 'undefined') {
        logger.warn("llm", "IndexedDB not available");
        return;
      }
      
      const databases = await indexedDB.databases();
      const webLLmDBs = databases.filter(db => db.name && db.name.startsWith('webllm:'));
      
      for (const db of webLLmDBs) {
        if (db.name) {
          await indexedDB.deleteDatabase(db.name);
          logger.info("llm", `Deleted IndexedDB: ${db.name}`);
        }
      }
      
      logger.info("llm", `Cleared ${webLLmDBs.length} cached model(s) from IndexedDB`);
    } catch (error) {
      logger.error("llm", "Failed to clear all cached models", { error });
      throw error;
    }
  }

  // Get all cached models info from IndexedDB
  static async getAllCachedModels(): Promise<Array<{modelId: string, size: number, isCorrupted?: boolean, isEmpty?: boolean}>> {
    try {
      if (typeof indexedDB === 'undefined') {
        logger.warn("llm", "IndexedDB not available");
        return [];
      }
      
      const databases = await indexedDB.databases();
      const webLLmDBs = databases.filter(db => db.name && db.name.startsWith('webllm:'));
      const models = [];
      
      logger.info("llm", "Checking cached models in IndexedDB", {
        totalDatabases: databases.length,
        webLLmDatabases: webLLmDBs.length
      });
      
      for (const dbInfo of webLLmDBs) {
        const dbName = dbInfo.name!;
        const modelId = dbName.replace('webllm:', '');
        
        logger.info("llm", "Checking model in IndexedDB", {
          modelId,
          dbName
        });
        
        // Get size - first check WebLLM-tracked size, then fall back to IndexedDB
        let size = getCachedModelSizeFromWebLLM(modelId);
        if (size === 0) {
          size = await LocalLLMEngine.getIndexedDBSizeStatic(dbName);
        } else {
          logger.debug("llm", "[CACHE] Using WebLLM-tracked size", { modelId, size });
        }
        
        // A model is corrupted if it has very small size (>0 but < 1MB)
        // Empty means 0 size or couldn't read
        const isCorrupted = size > 0 && size < 1024 * 1024;
        const isEmpty = size === 0;
        
        logger.info("llm", "Model cache summary", {
          modelId,
          totalSize: size,
          totalSizeMB: (size / 1024 / 1024).toFixed(2),
          isCorrupted,
          isEmpty
        });
        
        models.push({ modelId, size, isCorrupted, isEmpty });
      }
      
      return models;
    } catch (error) {
      logger.error("llm", "Failed to get all cached models", { error });
      return [];
    }
  }

  // Static helper to get IndexedDB size for getAllCachedModels
  private static async getIndexedDBSizeStatic(dbName: string): Promise<number> {
    return new Promise((resolve) => {
      const request = indexedDB.open(dbName);
      
      request.onsuccess = () => {
        const db = request.result;
        const storeNames = Array.from(db.objectStoreNames);
        
        logger.debug("llm", "[CACHE] IndexedDB opened", { 
          dbName,
          storeNames,
          storeCount: storeNames.length 
        });
        
        if (storeNames.length === 0) {
          db.close();
          resolve(0);
          return;
        }
        
        // Helper to recursively calculate size of nested objects
        const calculateSize = (value: unknown): number => {
          if (value === null || value === undefined) return 0;
          
          if (value instanceof ArrayBuffer) {
            return value.byteLength;
          }
          
          if (ArrayBuffer.isView(value)) {
            return value.byteLength;
          }
          
          if (typeof value === 'string') {
            return value.length * 2; // UTF-16 roughly
          }
          
          if (typeof value === 'number') {
            return 8;
          }
          
          if (typeof value === 'boolean') {
            return 4;
          }
          
          if (Array.isArray(value)) {
            return value.reduce((sum, item) => sum + calculateSize(item), 0);
          }
          
          if (typeof value === 'object') {
            let size = 0;
            for (const key in value as Record<string, unknown>) {
              if (Object.prototype.hasOwnProperty.call(value, key)) {
                size += key.length * 2; // key size
                size += calculateSize((value as Record<string, unknown>)[key]);
              }
            }
            return size;
          }
          
          return 0;
        };
        
        const checkStore = (storeName: string) => {
          return new Promise<number>((storeResolve) => {
            try {
              const transaction = db.transaction([storeName], 'readonly');
              const store = transaction.objectStore(storeName);
              let storeSize = 0;
              const cursorRequest = store.openCursor();
              
              cursorRequest.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor) {
                  const value = cursor.value;
                  // Log first few entries for debugging
                  if (storeSize === 0) {
                    logger.debug("llm", "[CACHE] First entry sample", { 
                      storeName,
                      valueType: typeof value,
                      isArray: Array.isArray(value),
                      isArrayBuffer: value instanceof ArrayBuffer,
                      keys: value && typeof value === 'object' ? Object.keys(value).slice(0, 5) : null
                    });
                  }
                  storeSize += calculateSize(value);
                  cursor.continue();
                } else {
                  storeResolve(storeSize);
                }
              };
              
              cursorRequest.onerror = () => storeResolve(0);
            } catch (e) {
              storeResolve(0);
            }
          });
        };
        
        Promise.all(storeNames.map(checkStore)).then((sizes) => {
          const totalSize = sizes.reduce((sum, s) => sum + s, 0);
          logger.debug("llm", "[CACHE] Total size calculated", { 
            dbName,
            totalSize,
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
            storeSizes: sizes
          });
          db.close();
          resolve(totalSize);
        }).catch((err) => {
          logger.error("llm", "[CACHE] Error calculating size", { dbName, error: err });
          db.close();
          resolve(0);
        });
      };
      
      request.onerror = () => resolve(0);
      setTimeout(() => resolve(0), 5000);
    });
  }

  async init() {
    logger.info("llm", "=== Starting LLM Engine Initialization ===", { 
      modelId: this.modelId,
      timestamp: new Date().toISOString()
    });
    
    this.onUpdate("Checking WebGPU...");
    logger.debug("llm", "Starting WebGPU check");
    try {
      await checkWebGPU();
      logger.info("llm", "WebGPU check passed");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.onUpdate(`❌ WebGPU Error: ${msg}`);
      throw error;
    }
    
    // Validate ServiceWorker
    logger.debug("llm", "Checking ServiceWorker availability");
    if (typeof navigator !== 'undefined' && !navigator.serviceWorker) {
      logger.warn("llm", "ServiceWorker API not available in this environment");
      const isTest = typeof window !== 'undefined' && (window as any).__vitest_worker__;
      if (!isTest) {
        throw new Error("ServiceWorker API not available");
      }
    }
    
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      logger.debug("llm", "Waiting for ServiceWorker to be ready");
      const registration = await navigator.serviceWorker.ready;
      logger.info("llm", "ServiceWorker ready", { scope: registration.scope });
      if (!navigator.serviceWorker.controller) {
        this.onUpdate("Activating Service Worker...");
        registration.active?.postMessage({ type: 'claim' });
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (!navigator.serviceWorker.controller) {
          logger.warn("llm", "ServiceWorker not controlling page after activation attempt");
        }
      }
    }
    
    // Check if model exists in our config
    logger.debug("llm", "Checking if model exists in config", { modelId: this.modelId });
    const modelInConfig = CUSTOM_APP_CONFIG.model_list.find(m => m.model_id === this.modelId);
    if (!modelInConfig) {
      throw new Error(`Model ${this.modelId} not found in app config`);
    }
    logger.info("llm", "Model found in config", { modelId: this.modelId });
    
    // Check cache status in IndexedDB
    const isCached = await this.isModelCached();
    if (isCached) {
      const cachedSize = await this.getCachedModelSize();
      if (cachedSize < 1024 * 1024) { // Less than 1MB is likely corrupted
        this.onUpdate("Detected corrupted cache, clearing...");
        await this.clearCorruptedModelAndRetry();
      } else {
        const sizeMB = (cachedSize / 1024 / 1024).toFixed(1);
        this.onUpdate(`Loading ${this.modelId} from IndexedDB cache (${sizeMB}MB)...`);
      }
    } else {
      this.onUpdate(`Downloading ${this.modelId} (first time may take minutes)...`);
    }

    const engineConfig: webllm.MLCEngineConfig = {
      appConfig: CUSTOM_APP_CONFIG,
      initProgressCallback: (report: webllm.InitProgressReport) => {
        logger.info("llm", "Init progress", { text: report.text, progress: report.progress });
        this.onUpdate(`Loading: ${report.text}`);
        
        // Capture cache size from WebLLM's loading messages
        // Format: "Loading model from cache[X/Y]: 123MB loaded"
        const cacheMatch = report.text.match(/(\d+)MB loaded/);
        if (cacheMatch) {
          const sizeMB = parseInt(cacheMatch[1], 10);
          const sizeBytes = sizeMB * 1024 * 1024;
          setCachedModelSizeFromWebLLM(this.modelId, sizeBytes);
          logger.debug("llm", "[CACHE] Captured model size from WebLLM", { 
            modelId: this.modelId, 
            sizeMB, 
            sizeBytes 
          });
        }
      },
    };

    const initStartTime = Date.now();
    let timeoutId: any;
    let absoluteTimeoutId: any;

    try {
      // Use Promise.race for timeout handling
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Initialization timed out after ${this.engineInitTimeout}ms`));
        }, this.engineInitTimeout);
      });

      const absolutePromise = new Promise<never>((_, reject) => {
        absoluteTimeoutId = setTimeout(() => {
          reject(new Error(`Absolute initialization timeout reached (${this.absoluteTimeout}ms)`));
        }, this.absoluteTimeout);
      });

    logger.info("llm", "Starting engine creation with WebLLM", { modelId: this.modelId });
    
    // Use standard MLCEngine - most reliable for model downloads
    let enginePromise: Promise<webllm.MLCEngine>;
    try {
      logger.debug("llm", "Attempting CreateMLCEngine creation");
      enginePromise = webllm.CreateMLCEngine(this.modelId, engineConfig);
      logger.debug("llm", "MLCEngine promise created");
    } catch (createError) {
      logger.error("llm", "Failed to create MLCEngine", { error: createError });
      throw createError;
    }

      this.engine = await Promise.race([
        enginePromise,
        timeoutPromise,
        absolutePromise
      ]) as webllm.MLCEngine;

      if (!this.engine) {
        throw new Error("Engine initialization returned undefined");
      }

      this.onUpdate("✅ Model loaded and ready!");
      logger.info("llm", "LLM Engine initialized successfully", {
        modelId: this.modelId,
        durationMs: Date.now() - initStartTime
      });

    } catch (error: any) {
      const errorMessage = mapError(error, this.modelId);
      logger.error("llm", "Engine initialization failed", { error: errorMessage });
      this.onUpdate(`❌ Critical Error: ${errorMessage}`);
      throw new Error(errorMessage);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (absoluteTimeoutId) clearTimeout(absoluteTimeoutId);
    }
  }


  
  async generate(prompt: string, options: GenerateOptions = {}) {
    logger.info('llm', 'Local generation request started', { 
      modelId: this.modelId,
      promptLength: prompt.length,
      hasHistory: !!options.history,
      historyLength: options.history?.length || 0,
      hasSystemOverride: !!options.systemOverride,
      hasSignal: !!options.signal,
      hasOnToken: !!options.onToken
    });

    if (!this.engine) {
      logger.error("llm", "Local engine not initialized");
      throw new Error("Local engine not initialized");
    }

    if (this.isGenerating) {
      logger.warn("llm", "Generation already in progress");
      throw new Error("Generation already in progress");
    }

    // Ensure flag is always reset, even if errors occur
    const resetGeneratingFlag = () => {
      this.isGenerating = false;
      logger.debug('llm', 'Reset generating flag to false');
    };

    this.isGenerating = true;
    logger.debug('llm', 'Set generating flag to true');

    // Small delay to ensure WebLLM worker state is settled
    await new Promise(resolve => setTimeout(resolve, LLM_GENERATION_DELAY));

    const { onToken, history = [], systemOverride, signal } = options;
    const systemPrompt = systemOverride || DEFAULT_SYSTEM_PROMPT;

    if (signal?.aborted) {
      logger.info('llm', 'Generation aborted before start');
      resetGeneratingFlag();
      throw new Error("Generation aborted");
    }

    const messages: webllm.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: prompt },
    ];

    const config = CUSTOM_MODEL_LIST.find(m => m.model_id === this.modelId);
    
    logger.info("llm", "Starting local generation (SW)", { 
      messageCount: messages.length,
      systemPromptLength: systemPrompt.length,
      modelConfig: config?.recommended_config
    });
    const startTime = performance.now();

    try {
      const result = await this.engine.chat.completions.create({
        messages,
        stream: true,
        ...config?.recommended_config
      });

      // result is an AsyncIterable when stream is true
      const chunks = result as unknown as AsyncIterable<webllm.ChatCompletionChunk>;

      let fullText = "";
      for await (const chunk of chunks) {
        if (signal?.aborted) {
          logger.info("llm", "Local generation aborted by signal");
          throw new Error("Generation aborted");
        }
        const content = chunk.choices[0]?.delta?.content || "";
        fullText += content;
        if (onToken) {
          onToken(fixMessage(fullText));
        }
      }

      const endTime = performance.now();
      logger.info("llm", "Local generation complete", {
        durationMs: endTime - startTime,
        tokenCountEstimate: fullText.length / 4,
        fullText: fixMessage(fullText)
      });

      return fixMessage(fullText);
    } catch (err: unknown) {
      const errorMessage = mapError(err, this.modelId);
      logger.error("llm", `Local generation error: ${errorMessage}`, { error: err });
      throw new Error(errorMessage);
    } finally {
      resetGeneratingFlag();
    }
  }

  async getStats() {
    if (!this.engine) return null;
    return await this.engine.runtimeStatsText();
  }

  async unload() {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
    }
  }
}

export class OnlineLLMEngine implements ILLMEngine {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "gemini-1.5-flash") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async init() {
    // No initialization needed for online engine
    return;
  }

  async generate(prompt: string, options: GenerateOptions) {
    const { onToken, history = [], systemOverride, signal } = options;
    const systemPrompt = systemOverride || DEFAULT_SYSTEM_PROMPT;

    if (signal?.aborted) {
      throw new Error("Generation aborted");
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: prompt },
    ];

    logger.info("llm", "Starting online generation", { model: this.model });
    const startTime = performance.now();

    // Using Google's OpenAI-compatible endpoint
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=${this.apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Online engine error: ${errorData.error?.message || response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Failed to get reader from response body");

    const decoder = new TextDecoder("utf-8");
    let fullText = "";
    let leftover = "";

    try {
      while (true) {
        if (signal?.aborted) {
          logger.info("llm", "Online generation aborted by signal");
          reader.cancel();
          throw new Error("Generation aborted");
        }
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = (leftover + chunk).split("\n");
        leftover = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || "";
              fullText += content;
              if (onToken) {
                onToken(fullText);
              }
            } catch (e) {
              // Ignore parse errors for partial chunks
            }
          }
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error("llm", `Online generation error: ${errorMessage}`, { error: err });
      throw err;
    }

    const endTime = performance.now();
    logger.info("llm", "Online generation complete", {
      durationMs: endTime - startTime,
      fullText
    });

    return fullText;
  }

  async getStats() {
    return "Online Mode (Google Gemini)";
  }
}

export class HybridLLMEngine implements ILLMEngine {
  private localEngine: LocalLLMEngine;
  private onlineEngine: OnlineLLMEngine | null = null;
  private useOnline: boolean = false;

  constructor(localEngine: LocalLLMEngine) {
    this.localEngine = localEngine;
  }

  setOnlineConfig(apiKey: string | null, enabled: boolean) {
    if (apiKey) {
      this.onlineEngine = new OnlineLLMEngine(apiKey);
    } else {
      this.onlineEngine = null;
    }
    this.useOnline = enabled && !!this.onlineEngine;
  }

  async init() {
    await this.localEngine.init();
  }

  async generate(prompt: string, options: GenerateOptions) {
    if (this.useOnline && this.onlineEngine) {
      return await this.onlineEngine.generate(prompt, options);
    }
    return await this.localEngine.generate(prompt, options);
  }

  async getStats() {
    if (this.useOnline && this.onlineEngine) {
      return await this.onlineEngine.getStats();
    }
    return await this.localEngine.getStats();
  }

  async unload() {
    await this.localEngine.unload();
    this.onlineEngine = null;
  }
}

// For backward compatibility during refactor
export type LLMEngine = HybridLLMEngine;
