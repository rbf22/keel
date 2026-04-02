import * as webllm from "@mlc-ai/web-llm";
import { logger } from "./logger";
import { 
  LLM_GENERATION_DELAY,
  LLM_ENGINE_INIT_TIMEOUT,
  LLM_ABSOLUTE_TIMEOUT
} from "./constants";
import { 
  CUSTOM_APP_CONFIG, 
  CUSTOM_MODEL_LIST
} from "./llm/models";
import { 
  getCachedModelSizeFromWebLLM, 
  setCachedModelSizeFromWebLLM, 
  getIndexedDBSizeStatic,
  getAllCachedModels as getAllCachedModelsStatic,
  clearAllCachedModels as clearAllCachedModelsStatic,
  registerDownload,
  updateDownloadProgress,
  unregisterDownload
} from "./llm/cache";
import { skillsEngine } from "./skills/engine";

export { SUPPORTED_MODELS, detectBestModel } from "./llm/models";

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
{{SKILLS_CATALOG}}

To use a skill, you MUST first activate it to see its full instructions and bundled resources.
Use: CALL: activate_skill ARGUMENTS: {"name": "skill-name"}

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
  return message;
}

function injectSkillsCatalog(systemPrompt: string): string {
  if (systemPrompt.includes('{{SKILLS_CATALOG}}')) {
    const catalog = skillsEngine.getSkillCatalog();
    return systemPrompt.replace('{{SKILLS_CATALOG}}', catalog);
  }
  return systemPrompt;
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
    logger.info("llm", "[CACHE] Starting reliable cache check", { modelId: this.modelId });
    
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB.databases) {
          // Fallback to old method if databases() is not available
          const dbName = `webllm:${this.modelId}`;
          return new Promise((resolve) => {
            const request = indexedDB.open(dbName);
            request.onsuccess = () => {
              const db = request.result;
              const hasStores = db.objectStoreNames.length > 0;
              db.close();
              resolve(hasStores);
            };
            request.onerror = () => resolve(false);
            request.onupgradeneeded = (event) => {
              const db = (event.target as IDBOpenDBRequest).result;
              db.close();
              resolve(false);
            };
            setTimeout(() => resolve(false), 2000);
          });
      }

      const databases = await indexedDB.databases();
      const exists = databases.some(db => db.name === `webllm:${this.modelId}`);
      logger.debug("llm", "[CACHE] Database check result", { modelId: this.modelId, exists });
      return exists;
    } catch (error) {
      logger.error("llm", "[CACHE] Cache check failed", { error });
      return false;
    }
  }

  // Get cached model size from IndexedDB or WebLLM tracked size
  async getCachedModelSize(): Promise<number> {
    const webllmSize = getCachedModelSizeFromWebLLM(this.modelId);
    if (webllmSize > 0) return webllmSize;
    
    try {
      const dbName = `webllm:${this.modelId}`;
      return await getIndexedDBSizeStatic(dbName);
    } catch (error) {
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
  }

  // Clear all cached models from IndexedDB
  static async clearAllCachedModels(): Promise<void> {
    return clearAllCachedModelsStatic();
  }

  // Get all cached models info from IndexedDB
  static async getAllCachedModels(): Promise<Array<{modelId: string, size: number, isCorrupted?: boolean, isEmpty?: boolean}>> {
    return getAllCachedModelsStatic();
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
      if (cachedSize > 0 && cachedSize < 1024 * 1024) { // Less than 1MB is likely corrupted
        this.onUpdate("Detected corrupted cache, clearing...");
        await this.clearCorruptedModelAndRetry();
      } else {
        const sizeMB = (cachedSize / 1024 / 1024).toFixed(1);
        this.onUpdate(`Loading ${this.modelId} from IndexedDB cache (${sizeMB}MB)...`);
      }
    } else {
      this.onUpdate(`Downloading ${this.modelId} (first time may take minutes)...`);
      registerDownload(this.modelId, "Starting download...");
    }

    const engineConfig: webllm.MLCEngineConfig = {
      appConfig: CUSTOM_APP_CONFIG,
      initProgressCallback: (report: webllm.InitProgressReport) => {
        logger.info("llm", "Init progress", { text: report.text, progress: report.progress });
        this.onUpdate(`Loading: ${report.text}`);
        updateDownloadProgress(this.modelId, report.text);
        
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
      unregisterDownload(this.modelId);

    } catch (error: any) {
      const errorMessage = mapError(error, this.modelId);
      logger.error("llm", "Engine initialization failed", { error: errorMessage });
      this.onUpdate(`❌ Critical Error: ${errorMessage}`);
      unregisterDownload(this.modelId);
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
    const systemPrompt = injectSkillsCatalog(systemOverride || DEFAULT_SYSTEM_PROMPT);

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

// For backward compatibility during refactor
export type LLMEngine = LocalLLMEngine;
