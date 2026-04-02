import * as webllm from "@mlc-ai/web-llm";
import { logger } from "../logger";
import { MODEL_VRAM_THRESHOLDS } from "../constants";

// Default model ID - using SmolLM2 as it's the smallest and most compatible
export const DEFAULT_MODEL_ID = "SmolLM2-360M-Instruct-q4f16_1-MLC";

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

export function getSortedModelList(): typeof SUPPORTED_MODELS {
  if (!sortedModelList) {
    sortedModelList = [...SUPPORTED_MODELS].sort((a, b) => 
      (b.vramRequiredMB || 0) - (a.vramRequiredMB || 0)
    );
  }
  return sortedModelList;
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
      const vramLimit = model.vramRequiredMB || 0;
      
      logger.debug('llm', 'Evaluating model', { 
        modelId: model.modelId,
        vramRequiredMB: vramLimit,
        maxBufferMB
      });
      
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
    logger.warn("llm", "Error detect best model, falling back to default", { error: e });
    return DEFAULT_MODEL_ID;
  }
}
