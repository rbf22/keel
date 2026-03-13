import * as webllm from "@mlc-ai/web-llm";

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

export class LLMEngine {
  private engine: webllm.MLCEngineInterface | null = null;
  private onUpdate: (message: string) => void;
  private modelId: string;

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

  async generate(prompt: string, onToken: (text: string) => void, history: webllm.ChatCompletionMessageParam[] = []) {
    if (!this.engine) throw new Error("Engine not initialized");

    const systemPrompt = `You are Keel, a local-first AI agent for iPad.
You have access to a Python execution environment for data analysis and visualization.
When you need to perform calculations, process data, or create charts, write a Python script in a triple-backtick block starting with \`\`\`python.

The environment has 'pandas' and 'numpy' pre-installed.
You MUST use the following helper functions for output:
- display_table(df): To show a pandas DataFrame as a table.
- display_chart(spec): To show a Vega-Lite chart. The spec should be a dictionary.
- download_file(filename, content): To provide a downloadable file.
- log(message): To print text to the output panel.

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

    const messages: webllm.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: prompt },
    ];

    const chunks = await this.engine.chat.completions.create({
      messages,
      stream: true,
    });

    let fullText = "";
    for await (const chunk of chunks) {
      const content = chunk.choices[0]?.delta?.content || "";
      fullText += content;
      onToken(fullText);
    }

    return fullText;
  }

  async getStats() {
    if (!this.engine) return null;
    return await this.engine.runtimeStatsText();
  }
}
