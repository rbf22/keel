import * as webllm from "@mlc-ai/web-llm";
import { logger } from "../logger";
import { keelModelConfig } from "./keel-model-config";

// Default model ID - will be set dynamically
export const DEFAULT_MODEL_ID = "";

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

// Dynamic model discovery from MLC repository
export interface MLCModel {
  modelId: string;
  modelLib: string;
  modelUrl: string;
  size: number;
  version: string;
  available: boolean;
  lastChecked?: Date;
}

// Cache for discovered models
let discoveredModels: MLCModel[] | null = null;
let modelsCacheExpiry = 0;
const MODELS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Fetch available models from MLC repository
export async function discoverMLCModels(): Promise<MLCModel[]> {
  const now = Date.now();
  
  // Return cached models if still valid
  if (discoveredModels && now < modelsCacheExpiry) {
    logger.info('llm', 'Using cached model list');
    return discoveredModels;
  }
  
  logger.info('llm', 'Discovering models from MLC repository');
  
  try {
    // Get latest version
    const versionsResponse = await fetch('https://api.github.com/repos/mlc-ai/binary-mlc-llm-libs/contents/web-llm-models');
    if (!versionsResponse.ok) {
      throw new Error(`Failed to fetch versions: ${versionsResponse.status}`);
    }
    
    const versions = await versionsResponse.json();
    const versionDirs = versions
      .filter((item: any) => item.type === 'dir' && item.name.match(/^v\d_\d_\d+$/))
      .sort((a: any, b: any) => b.name.localeCompare(a.name));
    
    if (versionDirs.length === 0) {
      throw new Error('No valid versions found');
    }
    
    const latestVersion = versionDirs[0].name;
    logger.info('llm', `Using latest version: ${latestVersion}`);
    
    // Get WASM files in latest version
    const wasmResponse = await fetch(`https://api.github.com/repos/mlc-ai/binary-mlc-llm-libs/contents/web-llm-models/${latestVersion}`);
    if (!wasmResponse.ok) {
      throw new Error(`Failed to fetch WASM files: ${wasmResponse.status}`);
    }
    
    const wasmFiles = await wasmResponse.json();
    const models: MLCModel[] = [];
    
    // Process each WASM file
    for (const file of wasmFiles) {
      if (file.type === 'file' && file.name.endsWith('.wasm')) {
        const modelId = file.name.replace('.wasm', '');
        const modelLib = `https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/${latestVersion}/${file.name}`;
        const modelUrl = `https://huggingface.co/mlc-ai/${modelId}/resolve/main/`;
        
        // Test if WASM is accessible
        let available = false;
        try {
          const wasmTestResponse = await fetch(modelLib, { method: 'HEAD' });
          available = wasmTestResponse.ok;
        } catch (error) {
          logger.warn('llm', `WASM not accessible for ${modelId}`, { error: error instanceof Error ? error.message : String(error) });
        }
        
        models.push({
          modelId,
          modelLib,
          modelUrl,
          size: file.size,
          version: latestVersion,
          available,
          lastChecked: new Date()
        });
      }
    }
    
    // Cache the results
    discoveredModels = models;
    modelsCacheExpiry = now + MODELS_CACHE_TTL;
    
    logger.info('llm', `Discovered ${models.length} models, ${models.filter(m => m.available).length} available`);
    return models;
    
  } catch (error) {
    logger.error('llm', 'Failed to discover models', { error: error instanceof Error ? error.message : String(error) });
    
    // Return fallback models if discovery fails
    return getFallbackModels();
  }
}

// Fallback models if dynamic discovery fails
function getFallbackModels(): MLCModel[] {
  return [
    // Generic fallback - will be replaced by actual discovered models
  ];
}

// Convert MLC models to WebLLM format
export function mlcToWebLLMModels(mlcModels: MLCModel[]): webllm.ModelRecord[] {
  return mlcModels
    .filter(model => model.available)
    .map(model => ({
      model_id: model.modelId,
      model: model.modelUrl,
      model_lib: model.modelLib,
      vram_required_MB: Math.round(model.size / 1024 / 1024 * 2), // Estimate VRAM as 2x WASM size
      required_features: [],
      overrides: {
        context_window_size: 4096
      }
    }));
}

// Get dynamic model list for WebLLM
export async function getDynamicModelList(): Promise<webllm.ModelRecord[]> {
  const mlcModels = await discoverMLCModels();
  return mlcToWebLLMModels(mlcModels);
}

// Get hardcoded model configuration for Keel
export async function getDynamicAppConfig(): Promise<webllm.AppConfig> {
  try {
    // Use our hardcoded configuration instead of dynamic discovery
    return {
      ...keelModelConfig,
      useIndexedDBCache: true,
    };
  } catch (error) {
    logger.error('llm', 'Failed to get keel model config', { error: error instanceof Error ? error.message : String(error) });
    
    // Fallback to basic config
    const webllm = await import("@mlc-ai/web-llm");
    return {
      ...webllm.prebuiltAppConfig,
      useIndexedDBCache: true,
    };
  }
}

// Convert hardcoded models to UI format
export async function getSupportedModels(): Promise<ModelInfo[]> {
  try {
    // Use our hardcoded configuration instead of dynamic discovery
    return keelModelConfig.model_list
      .map(model => ({
        modelId: model.model_id,
        displayName: model.model_id.split('-ctx')[0].replace(/-/g, ' '),
        vramRequiredMB: model.vram_required_MB,
        requiredFeatures: model.required_features || [],
        recommendedConfig: {
          temperature: 0.7,
          top_p: 0.9,
          repetition_penalty: 1.0,
          presence_penalty: 0.0,
          frequency_penalty: 0.0
        }
      }));
  } catch (error) {
    logger.error('llm', 'Failed to get supported models', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

// Get sorted list of dynamic models
export async function getSortedModelList(): Promise<ModelInfo[]> {
  const models = await getSupportedModels();
  return models.sort((a, b) => (b.vramRequiredMB || 0) - (a.vramRequiredMB || 0));
}

// Detect best model from hardcoded models
export async function detectBestModel(): Promise<string> {
  logger.info('llm', 'Starting best model detection');
  try {
    // Use our hardcoded configuration instead of dynamic discovery
    const models = keelModelConfig.model_list
      .filter(model => model.low_resource_required)
      .sort((a, b) => (a.vram_required_MB || 0) - (b.vram_required_MB || 0));
    
    if (models.length === 0) {
      logger.warn('llm', 'No models available, using fallback');
      return 'SmolLM2-360M-Instruct-q4f16_1-MLC'; // Known good fallback
    }
    
    const memory = (navigator as any).deviceMemory; // in GB
    const gpu = (navigator as any).gpu;
    if (!gpu) {
      logger.warn('llm', 'No GPU available, using smallest model');
      return models[0].model_id; // Smallest model
    }
    
    // Choose model based on available memory
    let bestModel = models[0].model_id; // Default to smallest
    
    if (memory && memory >= 8) {
      // 8GB+ RAM, can handle larger models
      const largeModels = models.filter(m => (m.vram_required_MB || 0) <= 2000);
      if (largeModels.length > 0) {
        bestModel = largeModels[largeModels.length - 1].model_id; // Largest that fits
      }
    } else if (memory && memory >= 4) {
      // 4-8GB RAM, medium models
      const mediumModels = models.filter(m => (m.vram_required_MB || 0) <= 1000);
      if (mediumModels.length > 0) {
        bestModel = mediumModels[mediumModels.length - 1].model_id;
      }
    }
    
    logger.info('llm', `Selected best model: ${bestModel}`);
    return bestModel;
    
  } catch (error) {
    logger.error('llm', 'Best model detection failed', { error: error instanceof Error ? error.message : String(error) });
    return 'SmolLM2-360M-Instruct-q4f16_1-MLC'; // Known good fallback
  }
}
