import * as webllm from "@mlc-ai/web-llm";
import { ModelInfo } from './types';

// Default model ID - using SmolLM2 as it's the smallest and most compatible
export const DEFAULT_MODEL_ID = "SmolLM2-360M-Instruct-q4f16_1-MLC";

// Custom model configuration to handle potential fetch failures from default CDNs
export const CUSTOM_MODEL_LIST: (webllm.ModelRecord & { recommended_config?: ModelInfo['recommendedConfig'] })[] = [
  {
    model_id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    model: "https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC/resolve/main/",
    model_lib: "https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC/resolve/main/SmolLM2-360M-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
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
    model_lib: "https://huggingface.co/mlc-ai/TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC/resolve/main/TinyLlama-1.1B-Chat-v0.4-q4f16_1-ctx4k_cs1k-webgpu.wasm",
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
    model_lib: "https://huggingface.co/mlc-ai/SmolLM2-135M-Instruct-q0f16-MLC/resolve/main/SmolLM2-135M-Instruct-q0f16-ctx4k_cs1k-webgpu.wasm",
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
    model_lib: "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/Llama-3.2-1B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
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
    model_lib: "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f32_1-MLC/resolve/main/Llama-3.2-1B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
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
    model_lib: "https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC/resolve/main/Llama-3.2-3B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
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

export function getSortedModelList(): typeof SUPPORTED_MODELS {
  if (!sortedModelList) {
    sortedModelList = [...SUPPORTED_MODELS].sort((a, b) => 
      (b.vramRequiredMB || 0) - (a.vramRequiredMB || 0)
    );
  }
  return sortedModelList;
}

export const DEFAULT_SYSTEM_PROMPT = `You are Keel, a local-first AI agent with access to Python execution and skills.

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
