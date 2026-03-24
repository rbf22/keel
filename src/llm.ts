import * as webllm from "@mlc-ai/web-llm";
import { logger } from "./logger";

export async function checkWebGPU() {
  if (!(navigator as any).gpu) {
    throw new Error("WebGPU is not supported on this browser.");
  }
  const adapter = await (navigator as any).gpu.requestAdapter();
  if (!adapter) {
    throw new Error("WebGPU adapter not found.");
  }
  return true;
}

export async function detectBestModel(): Promise<string> {
  try {
    const memory = (navigator as any).deviceMemory; // in GB
    const gpu = (navigator as any).gpu;
    if (!gpu) return DEFAULT_MODEL_ID;

    const adapter = await gpu.requestAdapter();
    if (!adapter) return DEFAULT_MODEL_ID;

    const limits = adapter.limits;
    // Llama 3.2 3B typically requires larger buffer bindings.
    // We can check maxStorageBufferBindingSize.
    // 1GB = 1024 * 1024 * 1024 bytes.
    const hasEnoughGpuMemory = limits.maxStorageBufferBindingSize >= 1 * 1024 * 1024 * 1024;

    // Check for Llama 3.2 3B requirement (~2.3 GB VRAM)
    // We heuristic: if system memory is >= 8GB and adapter has reasonable limits
    if (memory && memory >= 8 && hasEnoughGpuMemory) {
      return "Llama-3.2-3B-Instruct-q4f16_1-MLC";
    }

    // Fallback to Llama 3.2 1B if we have at least some memory info or just as a better-than-smol default
    if (memory && memory >= 4) {
      return "Llama-3.2-1B-Instruct-q4f16_1-MLC";
    }

    return DEFAULT_MODEL_ID;
  } catch (e) {
    return DEFAULT_MODEL_ID;
  }
}

export interface ModelInfo {
  modelId: string;
  displayName: string;
  vramRequiredMB?: number;
}

export const SUPPORTED_MODELS: ModelInfo[] = [
  {
    modelId: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    displayName: "Llama 3.2 3B",
    vramRequiredMB: 2300,
  },
  {
    modelId: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    displayName: "Llama 3.2 1B",
    vramRequiredMB: 900,
  },
  {
    modelId: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    displayName: "SmolLM2 360M",
    vramRequiredMB: 400,
  },
];

export const DEFAULT_MODEL_ID = "SmolLM2-360M-Instruct-q4f16_1-MLC";

export interface GenerateOptions {
  onToken: (text: string) => void;
  history?: webllm.ChatCompletionMessageParam[];
  systemOverride?: string;
}

export interface ILLMEngine {
  init(): Promise<void>;
  generate(prompt: string, options: GenerateOptions): Promise<string>;
  getStats(): Promise<string | null>;
}

const DEFAULT_SYSTEM_PROMPT = `You are Keel, a local-first AI agent for iPad.
You have access to a Python execution environment for data analysis and visualization.
When you need to perform calculations, process data, or create charts, write a Python script in a triple-backtick block starting with \`\`\`python.

The environment has 'pandas' and 'numpy' pre-installed.
You MUST use the following helper functions for output:
- display_table(df): To show a pandas DataFrame as a table. It accepts EXACTLY ONE argument.
- display_chart(spec): To show a Vega-Lite chart. The spec should be a dictionary.
- download_file(filename, content): To provide a downloadable file.
- log(message): To print text to the output panel.

If the user provides an error message from a previous execution, analyze it carefully and provide a corrected version of the code that addresses the root cause.

Example for a chart:
\`\`\`python
import pandas as pd
df = pd.DataFrame({'x': [1, 2, 3], 'y': [4, 5, 6]})
display_chart({
    "mark": "line",
    "encoding": {
        "x": {"field": "x", "type": "quantitative"},
        "y": {"field": "y", "type": "quantitative"}
    },
    "data": {"values": df.to_dict(orient='records')}
})
\`\`\`

All Python code you write will be executed automatically. Use it whenever it helps answer the user's request.`;

export class LocalLLMEngine implements ILLMEngine {
  private engine: webllm.MLCEngineInterface | null = null;
  private onUpdate: (message: string) => void;
  private modelId: string;
  private isGenerating = false;

  constructor(modelId: string, onUpdate: (message: string) => void) {
    this.modelId = modelId;
    this.onUpdate = onUpdate;
  }

  async init() {
    this.onUpdate("Checking WebGPU...");
    await checkWebGPU();

    this.onUpdate("Initializing Engine...");
    this.engine = await webllm.CreateMLCEngine(this.modelId, {
      initProgressCallback: (report: webllm.InitProgressReport) => {
        this.onUpdate(`Loading: ${report.text}`);
      },
    });
  }

  async generate(prompt: string, options: GenerateOptions) {
    if (!this.engine) {
      logger.error("llm", "Local engine not initialized");
      throw new Error("Local engine not initialized");
    }

    if (this.isGenerating) {
      logger.warn("llm", "Generation already in progress, waiting...");
      // Simple busy wait or throw error? Better to prevent UI from sending.
      throw new Error("Generation already in progress");
    }

    this.isGenerating = true;

    // Small delay to ensure WebLLM worker/tokenizer state is settled
    await new Promise(resolve => setTimeout(resolve, 250));

    const { onToken, history = [], systemOverride } = options;
    const systemPrompt = systemOverride || DEFAULT_SYSTEM_PROMPT;

    const messages: webllm.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: prompt },
    ];

    logger.info("llm", "Starting local generation", { messages });
    const startTime = performance.now();

    const chunks = await this.engine.chat.completions.create({
      messages,
      stream: true,
    });

    let fullText = "";
    try {
      for await (const chunk of chunks) {
        const content = chunk.choices[0]?.delta?.content || "";
        fullText += content;
        onToken(fullText);
      }
    } catch (err: any) {
      logger.error("llm", `Local generation error: ${err.message}`, { error: err });
      throw err;
    } finally {
      this.isGenerating = false;
    }

    const endTime = performance.now();
    logger.info("llm", "Local generation complete", {
      durationMs: endTime - startTime,
      tokenCountEstimate: fullText.length / 4,
      fullText
    });

    return fullText;
  }

  async getStats() {
    if (!this.engine) return null;
    return await this.engine.runtimeStatsText();
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
    const { onToken, history = [], systemOverride } = options;
    const systemPrompt = systemOverride || DEFAULT_SYSTEM_PROMPT;

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
    } catch (err: any) {
      logger.error("llm", `Online generation error: ${err.message}`, { error: err });
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
      } catch (err: any) {
        logger.warn("llm", `Online engine failed, falling back to local: ${err.message}`);
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
}

// For backward compatibility during refactor
export type LLMEngine = HybridLLMEngine;
