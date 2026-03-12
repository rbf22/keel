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

export const SELECTED_MODEL = "SmolLM2-360M-Instruct-q4f16_1-MLC";

export class LLMEngine {
  private engine: webllm.MLCEngineInterface | null = null;
  private onUpdate: (message: string) => void;

  constructor(onUpdate: (message: string) => void) {
    this.onUpdate = onUpdate;
  }

  async init() {
    this.onUpdate("Checking WebGPU...");
    await checkWebGPU();

    this.onUpdate("Initializing Engine...");
    // Use the lowercase createMLCEngine as per latest web-llm docs/type exports
    this.engine = await webllm.CreateMLCEngine(SELECTED_MODEL, {
      initProgressCallback: (report: webllm.InitProgressReport) => {
        this.onUpdate(`Loading: ${report.text}`);
      },
    });
  }

  async generate(prompt: string, onToken: (text: string) => void) {
    if (!this.engine) throw new Error("Engine not initialized");

    const messages: webllm.ChatCompletionMessageParam[] = [
      { role: "system", content: "You are a helpful assistant running locally on an iPad." },
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
