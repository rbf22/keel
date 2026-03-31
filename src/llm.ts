import * as webllm from "@mlc-ai/web-llm"
import { logger } from "./logger"

export async function checkWebGPU() {
  if (!(navigator as unknown as { gpu?: GPU }).gpu) {
    throw new Error("WebGPU is not supported on this browser.");
  }
  const adapter = await (navigator as unknown as { gpu: GPU }).gpu.requestAdapter();
  if (!adapter) {
    throw new Error("WebGPU adapter not found.");
  }
  return true;
}

export async function detectBestModel(): Promise<string> {
  try {
    const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory; // in GB
    const gpu = (navigator as unknown as { gpu?: GPU }).gpu;
    if (!gpu) return DEFAULT_MODEL_ID;

    const adapter = await gpu.requestAdapter();
    if (!adapter) return DEFAULT_MODEL_ID;

    const hasShaderF16 = adapter.features.has("shader-f16");
    const limits = adapter.limits;
    
    // Heuristic for available VRAM: often maxStorageBufferBindingSize is a good indicator
    // but not always the whole picture. 
    const maxBufferMB = limits.maxStorageBufferBindingSize / (1024 * 1024);

    // Sort models by VRAM requirement (descending) to find the best fit
    const candidates = [...CUSTOM_MODEL_LIST].sort((a, b) => 
      (b.vram_required_MB || 0) - (a.vram_required_MB || 0)
    );

    for (const model of candidates) {
      // Check feature requirements
      if (model.required_features?.includes("shader-f16") && !hasShaderF16) {
        continue;
      }

      // Check VRAM requirements
      // We use a safety margin: required VRAM should be less than ~80% of what max buffer size suggests
      // OR if we have deviceMemory info, use that as a proxy for total system capacity.
      const vramLimit = model.vram_required_MB || 0;
      
      // Heuristic: If we have 8GB+ system RAM, we can likely handle Llama 3B (2.2GB VRAM)
      // if the GPU adapter limits allow large enough buffers.
      if (memory && memory >= 8 && vramLimit > 2000) {
        if (maxBufferMB >= 1024) return model.model_id;
      }
      
      if (memory && memory >= 4 && vramLimit > 800) {
        if (maxBufferMB >= 512) return model.model_id;
      }

      // If it's a very small model (like SmolLM 360M), just check shader support
      if (vramLimit < 800) {
        return model.model_id;
      }
    }

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
    model_lib: webllm.modelLibURLPrefix + webllm.modelVersion + "/SmolLM2-360M-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
    vram_required_MB: 376.06,
    low_resource_required: true,
    required_features: ["shader-f16"],
    overrides: {
      context_window_size: 4096,
    },
    recommended_config: {
      temperature: 0.7,
      top_p: 0.95,
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
  useIndexedDBCache: true,
};

// Map web-llm prebuilt models to our ModelInfo format
export const SUPPORTED_MODELS: ModelInfo[] = CUSTOM_MODEL_LIST.map(m => ({
  modelId: m.model_id,
  displayName: m.model_id.split('-MLC')[0].replace(/-/g, ' '),
  vramRequiredMB: m.vram_required_MB,
  requiredFeatures: m.required_features,
  recommendedConfig: m.recommended_config,
}));

export const DEFAULT_MODEL_ID = "SmolLM2-360M-Instruct-q4f16_1-MLC";

export interface GenerateOptions {
  onToken: (text: string) => void;
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

const KEEP_ALIVE_INTERVAL = 5000;

export class LocalLLMEngine implements ILLMEngine {
  private engine: webllm.ServiceWorkerMLCEngine | null = null;
  private onUpdate: (message: string) => void;
  private modelId: string;
  private isGenerating = false;

  constructor(modelId: string, onUpdate: (message: string) => void) {
    this.modelId = modelId;
    this.onUpdate = onUpdate;
  }

  async init() {
    try {
      this.onUpdate("Checking WebGPU...");
      await checkWebGPU();

      this.onUpdate("Initializing Service Worker Engine...");
      
      const config = CUSTOM_MODEL_LIST.find(m => m.model_id === this.modelId);
      
      // Use ServiceWorkerMLCEngine for better background persistence
      const engine = new webllm.ServiceWorkerMLCEngine({
        appConfig: CUSTOM_APP_CONFIG,
        initProgressCallback: (report: webllm.InitProgressReport) => {
          this.onUpdate(`Loading: ${report.text}`);
          logger.info("llm", `Init progress: ${report.text}`, { progress: report.progress });
        },
      }, KEEP_ALIVE_INTERVAL);

      this.onUpdate(`Reloading model: ${this.modelId}...`);
      
      // Pass the recommended config if available
      const reloadOptions = config?.recommended_config ? {
        ...config.recommended_config
      } : {};

      await engine.reload(this.modelId, reloadOptions);
      this.engine = engine;
      
      logger.info("llm", `Local engine (Service Worker) initialized successfully: ${this.modelId}`);
    } catch (err: unknown) {
      const errorMessage = mapError(err, this.modelId);
      const config = CUSTOM_MODEL_LIST.find(m => m.model_id === this.modelId);
      
      let diagnosticInfo = `Failed to initialize local engine (${this.modelId}): ${errorMessage}`;
      if (config) {
        diagnosticInfo += `\nAttempted Weights: ${config.model}\nAttempted WASM: ${config.model_lib}`;
      }
      
      logger.error("llm", diagnosticInfo, { error: err });
      throw new Error(errorMessage);
    }
  }

  async generate(prompt: string, options: GenerateOptions) {
    if (!this.engine) {
      logger.error("llm", "Local engine not initialized");
      throw new Error("Local engine not initialized");
    }

    if (this.isGenerating) {
      logger.warn("llm", "Generation already in progress");
      throw new Error("Generation already in progress");
    }

    this.isGenerating = true;

    // Small delay to ensure WebLLM worker state is settled
    await new Promise(resolve => setTimeout(resolve, 250));

    const { onToken, history = [], systemOverride, signal } = options;
    const systemPrompt = systemOverride || DEFAULT_SYSTEM_PROMPT;

    if (signal?.aborted) {
      this.isGenerating = false;
      throw new Error("Generation aborted");
    }

    const messages: webllm.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: prompt },
    ];

    const config = CUSTOM_MODEL_LIST.find(m => m.model_id === this.modelId);
    
    logger.info("llm", "Starting local generation (SW)", { messages });
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
        onToken(fixMessage(fullText));
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
      this.isGenerating = false;
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
              onToken(fullText);
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
  private onFallback: () => void;

  constructor(localEngine: LocalLLMEngine, onFallback: () => void) {
    this.localEngine = localEngine;
    this.onFallback = onFallback;
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
      try {
        return await this.onlineEngine.generate(prompt, options);
      } catch (err: unknown) {
        if (options.signal?.aborted) throw err;
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.warn("llm", `Online engine failed, falling back to local: ${errorMessage}`);
        this.useOnline = false;
        this.onFallback();
        return await this.localEngine.generate(prompt, options);
      }
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
