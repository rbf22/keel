import * as webllm from "@mlc-ai/web-llm";
import { logger } from "./logger"
import { MODEL_VRAM_THRESHOLDS, LLM_GENERATION_DELAY } from "./constants"

export async function checkWebGPU() {
  logger.debug('llm', 'Checking WebGPU support');
  if (!(navigator as unknown as { gpu?: GPU }).gpu) {
    logger.error('llm', 'WebGPU not supported on this browser');
    throw new Error("WebGPU is not supported on this browser.");
  }
  const adapter = await (navigator as unknown as { gpu: GPU }).gpu.requestAdapter();
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
    const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory; // in GB
    const gpu = (navigator as unknown as { gpu?: GPU }).gpu;
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
      if (model.required_features?.includes("shader-f16") && !hasShaderF16) {
        logger.debug('llm', 'Skipping model due to missing shader-f16 feature', { 
          modelId: model.model_id 
        });
        continue;
      }

      // Check VRAM requirements
      // We use a safety margin: required VRAM should be less than ~80% of what max buffer size suggests
      // OR if we have deviceMemory info, use that as a proxy for total system capacity.
      const vramLimit = model.vram_required_MB || 0;
      
      logger.debug('llm', 'Evaluating model', { 
        modelId: model.model_id,
        vramRequiredMB: vramLimit,
        maxBufferMB
      });
      
      // Heuristic: If we have 8GB+ system RAM, we can likely handle Llama 3B (2.2GB VRAM)
      // if the GPU adapter limits allow large enough buffers.
      if (memory && memory >= MODEL_VRAM_THRESHOLDS.HIGH_MEMORY_THRESHOLD && vramLimit > MODEL_VRAM_THRESHOLDS.MEDIUM_MODEL) {
        if (maxBufferMB >= MODEL_VRAM_THRESHOLDS.HIGH_BUFFER_SIZE) {
          logger.info('llm', 'Selected high-memory model', { 
            modelId: model.model_id,
            systemMemoryGB: memory,
            vramRequiredMB: vramLimit
          });
          return model.model_id;
        }
      }
      
      if (memory && memory >= MODEL_VRAM_THRESHOLDS.MEDIUM_MEMORY_THRESHOLD && vramLimit > MODEL_VRAM_THRESHOLDS.SMALL_MODEL) {
        if (maxBufferMB >= MODEL_VRAM_THRESHOLDS.MEDIUM_BUFFER_SIZE) {
          logger.info('llm', 'Selected medium-memory model', { 
            modelId: model.model_id,
            systemMemoryGB: memory,
            vramRequiredMB: vramLimit
          });
          return model.model_id;
        }
      }

      // If it's a very small model (like SmolLM 360M), just check shader support
      if (vramLimit < MODEL_VRAM_THRESHOLDS.SMALL_MODEL) {
        logger.info('llm', 'Selected small model', { 
          modelId: model.model_id,
          vramRequiredMB: vramLimit
        });
        return model.model_id;
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
  };
}

// Custom model configuration to handle potential fetch failures from default CDNs
export const CUSTOM_MODEL_LIST: (webllm.ModelRecord & { recommended_config?: ModelInfo['recommendedConfig'] })[] = [
  {
    model_id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    model: "https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC/resolve/main/",
    model_lib: "https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC/resolve/main/SmolLM2-360M-Instruct-q4f16_1-MLC.wasm",
    vram_required_MB: 0,
    required_features: ["shader-f16"],
    recommended_config: {
      temperature: 0.7,
      top_p: 0.9,
    }
  },
  {
    model_id: "TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC", 
    model: "https://huggingface.co/mlc-ai/TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC/resolve/main/",
    model_lib: "https://huggingface.co/mlc-ai/TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC/resolve/main/TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC.wasm",
    vram_required_MB: 0,
    required_features: [],
    recommended_config: {
      temperature: 0.7,
      top_p: 0.9,
    }
  },
  {
    model_id: "SmolLM2-360M-Instruct-q4f32_1-MLC",
    model: "https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f32_1-MLC/resolve/main/",
    model_lib: webllm.modelLibURLPrefix + webllm.modelVersion + "/SmolLM2-360M-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
    vram_required_MB: 750.00,
    low_resource_required: true,
    overrides: {
      context_window_size: 4096,
    },
    recommended_config: {
      temperature: 0.7,
      top_p: 0.95,
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
  useIndexedDBCache: true,  // Re-enabled - bug fixed with patch
};

// Map web-llm prebuilt models to our ModelInfo format
export const SUPPORTED_MODELS: ModelInfo[] = CUSTOM_MODEL_LIST.map(m => ({
  modelId: m.model_id,
  displayName: m.model_id.split('-MLC')[0].replace(/-/g, ' '),
  vramRequiredMB: m.vram_required_MB,
  requiredFeatures: m.required_features,
  recommendedConfig: m.recommended_config,
}));

export const DEFAULT_MODEL_ID = "TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC";

// Cache sorted model list for performance
let sortedModelList: typeof CUSTOM_MODEL_LIST | null = null;

function getSortedModelList(): typeof CUSTOM_MODEL_LIST {
  if (!sortedModelList) {
    sortedModelList = [...CUSTOM_MODEL_LIST].sort((a, b) => 
      (b.vram_required_MB || 0) - (a.vram_required_MB || 0)
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
  private engine: webllm.ServiceWorkerMLCEngine | webllm.MLCEngine | null = null;
  private onUpdate: (message: string) => void;
  private modelId: string;
  private isGenerating = false;

  constructor(modelId: string, onUpdate: (message: string) => void) {
    this.modelId = modelId;
    this.onUpdate = onUpdate;
    logger.info("llm", `LocalLLMEngine initialized with Service Worker`);
  }

  // Check if model is cached
  async isModelCached(): Promise<boolean> {
    try {
      // Use WebLLM's built-in cache checking
      const cacheKey = `web-llm-${this.modelId}`;
      const cache = await caches.open(cacheKey);
      const modelResponse = await cache.match(this.getModelUrl());
      return modelResponse !== undefined;
    } catch (error) {
      logger.warn("llm", "Failed to check model cache", { error, modelId: this.modelId });
      return false;
    }
  }

  // Get cached model size
  async getCachedModelSize(): Promise<number> {
    try {
      const cacheKey = `web-llm-${this.modelId}`;
      const cache = await caches.open(cacheKey);
      const keys = await cache.keys();
      let totalSize = 0;
      
      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
      
      return totalSize;
    } catch (error) {
      logger.warn("llm", "Failed to get cached model size", { error, modelId: this.modelId });
      return 0;
    }
  }

  // Clear cached model
  async clearCachedModel(): Promise<void> {
    try {
      const cacheKey = `web-llm-${this.modelId}`;
      await caches.delete(cacheKey);
      logger.info("llm", `Cleared cached model: ${this.modelId}`);
    } catch (error) {
      logger.error("llm", "Failed to clear cached model", { error, modelId: this.modelId });
      throw error;
    }
  }

  // Clear all cached models
  static async clearAllCachedModels(): Promise<void> {
    try {
      const cacheNames = await caches.keys();
      const webLLmCacheNames = cacheNames.filter(name => name.startsWith('web-llm-'));
      
      for (const cacheName of webLLmCacheNames) {
        await caches.delete(cacheName);
      }
      
      logger.info("llm", `Cleared ${webLLmCacheNames.length} cached model(s)`);
    } catch (error) {
      logger.error("llm", "Failed to clear all cached models", { error });
      throw error;
    }
  }

  // Get all cached models info
  static async getAllCachedModels(): Promise<Array<{modelId: string, size: number}>> {
    try {
      const cacheNames = await caches.keys();
      const webLLmCacheNames = cacheNames.filter(name => name.startsWith('web-llm-'));
      const models = [];
      
      for (const cacheName of webLLmCacheNames) {
        const modelId = cacheName.replace('web-llm-', '');
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        let totalSize = 0;
        
        for (const request of keys) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }
        
        models.push({ modelId, size: totalSize });
      }
      
      return models;
    } catch (error) {
      logger.error("llm", "Failed to get all cached models", { error });
      return [];
    }
  }

  private getModelUrl(): string {
    const model = CUSTOM_MODEL_LIST.find(m => m.model_id === this.modelId);
    return model?.model_lib || '';
  }

  async init() {
    this.onUpdate("Checking WebGPU...");
    await checkWebGPU();

    // Check if model is already cached
    const isCached = await this.isModelCached();
    if (isCached) {
      const cachedSize = await this.getCachedModelSize();
      const sizeMB = (cachedSize / 1024 / 1024).toFixed(1);
      this.onUpdate(`Loading ${this.modelId} from cache (${sizeMB}MB)...`);
      logger.info("llm", `Model found in cache`, { 
        modelId: this.modelId, 
        cachedSizeMB: sizeMB 
      });
    } else {
      this.onUpdate(`Downloading ${this.modelId} (first time - may take several minutes)...`);
      logger.info("llm", `Model not cached, will download`, { 
        modelId: this.modelId 
      });
    }

    const engineConfig: webllm.MLCEngineConfig = {
      appConfig: CUSTOM_APP_CONFIG,
      initProgressCallback: (report: webllm.InitProgressReport) => {
        this.onUpdate(`Loading: ${report.text}`);
        logger.info("llm", `Init progress: ${report.text}`, { progress: report.progress });
      },
    };

    // Initialize ServiceWorker engine only
    await this.initServiceWorkerEngine(engineConfig);
  }

  private async initServiceWorkerEngine(engineConfig: webllm.MLCEngineConfig) {
    this.onUpdate("Initializing Service Worker Engine...");
    
    // Add timeout wrapper that resets on progress updates
    const ENGINE_INIT_TIMEOUT = 600000; // 10 minutes - resets on progress
    
    logger.info("llm", `Creating ServiceWorkerMLCEngine with ${ENGINE_INIT_TIMEOUT}ms timeout (resets on progress)`, { 
      modelId: this.modelId 
    });
    
    // Create timeout with reset capability
    let timeoutId: number | undefined;
    let lastProgressTime = Date.now();
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      const resetTimeout = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        lastProgressTime = Date.now();
        
        timeoutId = setTimeout(() => {
          const timeSinceLastProgress = Date.now() - lastProgressTime;
          logger.error("llm", "ServiceWorkerMLCEngine initialization timed out", { 
            timeout: ENGINE_INIT_TIMEOUT,
            timeSinceLastProgress,
            modelId: this.modelId 
          });
          reject(new Error(`ServiceWorkerMLCEngine initialization timed out after ${ENGINE_INIT_TIMEOUT}ms with no progress for ${timeSinceLastProgress}ms. This may indicate:\n1. Download stalled or network issues\n2. Browser resource limits or extensions blocking downloads\n3. CDN connectivity issues\n\nTry:\n- Check your internet connection speed\n- Disable browser extensions that might block large downloads\n- Refresh the page and try again\n- Consider using a smaller model if available`));
        }, ENGINE_INIT_TIMEOUT);
      };
      
      // Update progress callback to reset timeout
      const originalProgressCallback = engineConfig.initProgressCallback;
      engineConfig.initProgressCallback = (report: webllm.InitProgressReport) => {
        // Reset timeout on each progress update
        resetTimeout();
        
        // Call original callback
        if (originalProgressCallback) {
          originalProgressCallback(report);
        }
      };
      
      // Start initial timeout
      resetTimeout();
    });
    
    // Create the engine using CreateServiceWorkerMLCEngine with timeout
    try {
      this.onUpdate("Creating MLCEngine (first-time download may take 5-10 minutes for 360MB model)...");
      this.engine = await Promise.race([
        webllm.CreateServiceWorkerMLCEngine(
          this.modelId,
          engineConfig
        ),
        timeoutPromise
      ]);
      
      logger.info("llm", "ServiceWorkerMLCEngine initialized successfully", { 
        modelId: this.modelId 
      });
      this.onUpdate("Engine ready!");
    } finally {
      // Always clear the timeout to prevent memory leaks
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
    
    logger.info("llm", `ServiceWorkerMLCEngine initialized successfully: ${this.modelId}`);
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
      const chunks = await this.engine.chat.completions.create({
        messages,
        stream: true,
        ...config?.recommended_config
      });

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
