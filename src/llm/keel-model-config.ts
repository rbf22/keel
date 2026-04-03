/**
 * Keel Model Configuration
 * 
 * This file contains all available WebLLM models hardcoded for Keel.
 * Based on WebLLM's prebuiltAppConfig from: https://github.com/mlc-ai/web-llm/blob/main/src/config.ts
 * 
 * Model version and URL prefix are synchronized with WebLLM v0.2.80
 */

import * as webllm from "@mlc-ai/web-llm";

export const modelVersion = "v0_2_80";
export const modelLibURLPrefix = "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/";

/**
 * Models that support function calling (i.e. usage of `ChatCompletionRequest.tools`)
 */
export const functionCallingModelIds = [
  "Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC",
  "Hermes-2-Pro-Llama-3-8B-q4f32_1-MLC",
  "Hermes-2-Pro-Mistral-7B-q4f16_1-MLC",
  "Hermes-3-Llama-3.1-8B-q4f32_1-MLC",
  "Hermes-3-Llama-3.1-8B-q4f16_1-MLC",
];

/**
 * Complete hardcoded model configuration for Keel
 * Includes all models from WebLLM's prebuiltAppConfig
 */
export const keelModelConfig: webllm.AppConfig = {
  model_list: [
    // Llama-3.2 Models
    {
      model: "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f32_1-MLC",
      model_id: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Llama-3.2-1B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 1128.82,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC",
      model_id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Llama-3.2-1B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 879.04,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q0f16-MLC",
      model_id: "Llama-3.2-1B-Instruct-q0f16-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Llama-3.2-1B-Instruct-q0f16-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 2573.13,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f32_1-MLC",
      model_id: "Llama-3.2-3B-Instruct-q4f32_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Llama-3.2-3B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 2951.51,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC",
      model_id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Llama-3.2-3B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 2263.69,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
    },

    // Llama-3.1 Models
    {
      model: "https://huggingface.co/mlc-ai/Llama-3.1-8B-Instruct-q4f32_1-MLC",
      model_id: "Llama-3.1-8B-Instruct-q4f32_1-MLC-1k",
      model_lib: modelLibURLPrefix + modelVersion + "/Llama-3_1-8B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 5295.7,
      low_resource_required: true,
      overrides: { context_window_size: 1024 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Llama-3.1-8B-Instruct-q4f16_1-MLC",
      model_id: "Llama-3.1-8B-Instruct-q4f16_1-MLC-1k",
      model_lib: modelLibURLPrefix + modelVersion + "/Llama-3_1-8B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 4598.34,
      low_resource_required: true,
      overrides: { context_window_size: 1024 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Llama-3.1-8B-Instruct-q4f32_1-MLC",
      model_id: "Llama-3.1-8B-Instruct-q4f32_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Llama-3_1-8B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 6101.01,
      low_resource_required: false,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Llama-3.1-8B-Instruct-q4f16_1-MLC",
      model_id: "Llama-3.1-8B-Instruct-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Llama-3_1-8B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 5001.0,
      low_resource_required: false,
      overrides: { context_window_size: 4096 },
    },

    // DeepSeek-R1-Distill-Qwen Models
    {
      model: "https://huggingface.co/mlc-ai/DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
      model_id: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Qwen2-7B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      low_resource_required: false,
      vram_required_MB: 5106.67,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/DeepSeek-R1-Distill-Qwen-7B-q4f32_1-MLC",
      model_id: "DeepSeek-R1-Distill-Qwen-7B-q4f32_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Qwen2-7B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      low_resource_required: false,
      vram_required_MB: 5900.09,
      overrides: { context_window_size: 4096 },
    },

    // DeepSeek-R1-Distill-Llama Models
    {
      model: "https://huggingface.co/mlc-ai/DeepSeek-R1-Distill-Llama-8B-q4f32_1-MLC",
      model_id: "DeepSeek-R1-Distill-Llama-8B-q4f32_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Llama-3_1-8B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 6101.01,
      low_resource_required: false,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC",
      model_id: "DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Llama-3_1-8B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 5001.0,
      low_resource_required: false,
      overrides: { context_window_size: 4096 },
    },

    // Hermes-3 and Hermes-2 Models
    {
      model: "https://huggingface.co/mlc-ai/Hermes-2-Theta-Llama-3-8B-q4f16_1-MLC",
      model_id: "Hermes-2-Theta-Llama-3-8B-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Llama-3-8B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 4976.13,
      low_resource_required: false,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Hermes-2-Theta-Llama-3-8B-q4f32_1-MLC",
      model_id: "Hermes-2-Theta-Llama-3-8B-q4f32_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Llama-3-8B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 6051.27,
      low_resource_required: false,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC",
      model_id: "Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Llama-3-8B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 4976.13,
      low_resource_required: false,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Hermes-2-Pro-Llama-3-8B-q4f32_1-MLC",
      model_id: "Hermes-2-Pro-Llama-3-8B-q4f32_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Llama-3-8B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 6051.27,
      low_resource_required: false,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Hermes-3-Llama-3.2-3B-q4f32_1-MLC",
      model_id: "Hermes-3-Llama-3.2-3B-q4f32_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Llama-3.2-3B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 2951.51,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Hermes-3-Llama-3.2-3B-q4f16_1-MLC",
      model_id: "Hermes-3-Llama-3.2-3B-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Llama-3.2-3B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 2263.69,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Hermes-3-Llama-3.1-8B-q4f32_1-MLC",
      model_id: "Hermes-3-Llama-3.1-8B-q4f32_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Llama-3_1-8B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 5779.27,
      low_resource_required: false,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Hermes-3-Llama-3.1-8B-q4f16_1-MLC",
      model_id: "Hermes-3-Llama-3.1-8B-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Llama-3_1-8B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 4876.13,
      low_resource_required: false,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Hermes-2-Pro-Mistral-7B-q4f16_1-MLC",
      model_id: "Hermes-2-Pro-Mistral-7B-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Mistral-7B-Instruct-v0.3-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 4033.28,
      low_resource_required: false,
      required_features: ["shader-f16"],
      overrides: {
        context_window_size: 4096,
        sliding_window_size: -1,
      },
    },

    // Phi3.5-mini-instruct Models
    {
      model: "https://huggingface.co/mlc-ai/Phi-3.5-mini-instruct-q4f16_1-MLC",
      model_id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Phi-3.5-mini-instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 3672.07,
      low_resource_required: false,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Phi-3.5-mini-instruct-q4f32_1-MLC",
      model_id: "Phi-3.5-mini-instruct-q4f32_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Phi-3.5-mini-instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 5483.12,
      low_resource_required: false,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Phi-3.5-mini-instruct-q4f16_1-MLC",
      model_id: "Phi-3.5-mini-instruct-q4f16_1-MLC-1k",
      model_lib: modelLibURLPrefix + modelVersion + "/Phi-3.5-mini-instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 2520.07,
      low_resource_required: true,
      overrides: { context_window_size: 1024 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Phi-3.5-mini-instruct-q4f32_1-MLC",
      model_id: "Phi-3.5-mini-instruct-q4f32_1-MLC-1k",
      model_lib: modelLibURLPrefix + modelVersion + "/Phi-3.5-mini-instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 3179.12,
      low_resource_required: true,
      overrides: { context_window_size: 1024 },
    },

    // Phi-3.5-vision-instruct Models (VLM)
    {
      model: "https://huggingface.co/mlc-ai/Phi-3.5-vision-instruct-q4f16_1-MLC",
      model_id: "Phi-3.5-vision-instruct-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Phi-3.5-vision-instruct-q4f16_1-ctx4k_cs2k-webgpu.wasm",
      vram_required_MB: 3952.18,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
      model_type: "VLM" as any,
    },
    {
      model: "https://huggingface.co/mlc-ai/Phi-3.5-vision-instruct-q4f32_1-MLC",
      model_id: "Phi-3.5-vision-instruct-q4f32_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Phi-3.5-vision-instruct-q4f32_1-ctx4k_cs2k-webgpu.wasm",
      vram_required_MB: 5879.84,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
      model_type: "VLM" as any,
    },

    // Mistral Models
    {
      model: "https://huggingface.co/mlc-ai/Mistral-7B-Instruct-v0.3-q4f16_1-MLC",
      model_id: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Mistral-7B-Instruct-v0.3-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 4573.39,
      low_resource_required: false,
      required_features: ["shader-f16"],
      overrides: {
        context_window_size: 4096,
        sliding_window_size: -1,
      },
    },
    {
      model: "https://huggingface.co/mlc-ai/Mistral-7B-Instruct-v0.3-q4f32_1-MLC",
      model_id: "Mistral-7B-Instruct-v0.3-q4f32_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Mistral-7B-Instruct-v0.3-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 5619.27,
      low_resource_required: false,
      overrides: {
        context_window_size: 4096,
        sliding_window_size: -1,
      },
    },
    {
      model: "https://huggingface.co/mlc-ai/Mistral-7B-Instruct-v0.2-q4f16_1-MLC",
      model_id: "Mistral-7B-Instruct-v0.2-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Mistral-7B-Instruct-v0.3-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 4573.39,
      low_resource_required: false,
      required_features: ["shader-f16"],
      overrides: {
        context_window_size: 4096,
        sliding_window_size: -1,
      },
    },
    {
      model: "https://huggingface.co/mlc-ai/OpenHermes-2.5-Mistral-7B-q4f16_1-MLC",
      model_id: "OpenHermes-2.5-Mistral-7B-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Mistral-7B-Instruct-v0.3-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 4573.39,
      low_resource_required: false,
      required_features: ["shader-f16"],
      overrides: {
        context_window_size: 4096,
        sliding_window_size: -1,
      },
    },
    {
      model: "https://huggingface.co/mlc-ai/NeuralHermes-2.5-Mistral-7B-q4f16_1-MLC",
      model_id: "NeuralHermes-2.5-Mistral-7B-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Mistral-7B-Instruct-v0.3-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 4573.39,
      low_resource_required: false,
      required_features: ["shader-f16"],
      overrides: {
        context_window_size: 4096,
        sliding_window_size: -1,
      },
    },
    {
      model: "https://huggingface.co/mlc-ai/WizardMath-7B-V1.1-q4f16_1-MLC",
      model_id: "WizardMath-7B-V1.1-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Mistral-7B-Instruct-v0.3-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 4573.39,
      low_resource_required: false,
      required_features: ["shader-f16"],
      overrides: {
        context_window_size: 4096,
        sliding_window_size: -1,
      },
    },

    // SmolLM2 Models (Recommended for Keel - Small and Fast)
    {
      model: "https://huggingface.co/mlc-ai/SmolLM2-1.7B-Instruct-q4f16_1-MLC",
      model_id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/SmolLM2-1.7B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 1774.19,
      low_resource_required: true,
      required_features: ["shader-f16"],
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/SmolLM2-1.7B-Instruct-q4f32_1-MLC",
      model_id: "SmolLM2-1.7B-Instruct-q4f32_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/SmolLM2-1.7B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 2692.38,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q0f16-MLC",
      model_id: "SmolLM2-360M-Instruct-q0f16-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/SmolLM2-360M-Instruct-q0f16-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 871.99,
      low_resource_required: true,
      required_features: ["shader-f16"],
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q0f32-MLC",
      model_id: "SmolLM2-360M-Instruct-q0f32-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/SmolLM2-360M-Instruct-q0f32-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 1743.99,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC",
      model_id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/SmolLM2-360M-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 376.06,
      low_resource_required: true,
      required_features: ["shader-f16"],
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f32_1-MLC",
      model_id: "SmolLM2-360M-Instruct-q4f32_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/SmolLM2-360M-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 579.61,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/SmolLM2-135M-Instruct-q0f16-MLC",
      model_id: "SmolLM2-135M-Instruct-q0f16-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/SmolLM2-135M-Instruct-q0f16-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 359.69,
      low_resource_required: true,
      required_features: ["shader-f16"],
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/SmolLM2-135M-Instruct-q0f32-MLC",
      model_id: "SmolLM2-135M-Instruct-q0f32-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/SmolLM2-135M-Instruct-q0f32-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 719.38,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
    },

    // Gemma2 Models
    {
      model: "https://huggingface.co/mlc-ai/gemma-2-2b-it-q4f16_1-MLC",
      model_id: "gemma-2-2b-it-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/gemma-2-2b-it-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 1895.3,
      low_resource_required: false,
      required_features: ["shader-f16"],
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/gemma-2-2b-it-q4f32_1-MLC",
      model_id: "gemma-2-2b-it-q4f32_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/gemma-2-2b-it-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 2508.75,
      low_resource_required: false,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/gemma-2-2b-it-q4f16_1-MLC",
      model_id: "gemma-2-2b-it-q4f16_1-MLC-1k",
      model_lib: modelLibURLPrefix + modelVersion + "/gemma-2-2b-it-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 1583.3,
      low_resource_required: true,
      required_features: ["shader-f16"],
      overrides: { context_window_size: 1024 },
    },
    {
      model: "https://huggingface.co/mlc-ai/gemma-2-2b-it-q4f32_1-MLC",
      model_id: "gemma-2-2b-it-q4f32_1-MLC-1k",
      model_lib: modelLibURLPrefix + modelVersion + "/gemma-2-2b-it-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 1884.75,
      low_resource_required: true,
      overrides: { context_window_size: 1024 },
    },
    {
      model: "https://huggingface.co/mlc-ai/gemma-2-9b-it-q4f16_1-MLC",
      model_id: "gemma-2-9b-it-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/gemma-2-9b-it-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 6422.01,
      low_resource_required: false,
      required_features: ["shader-f16"],
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/gemma-2-9b-it-q4f32_1-MLC",
      model_id: "gemma-2-9b-it-q4f32_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/gemma-2-9b-it-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 8383.33,
      low_resource_required: false,
      overrides: { context_window_size: 4096 },
    },

    // Qwen-3 Models
    {
      model: "https://huggingface.co/mlc-ai/Qwen3-0.6B-q4f16_1-MLC",
      model_id: "Qwen3-0.6B-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Qwen3-0.6B-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 1403.34,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Qwen3-0.6B-q4f32_1-MLC",
      model_id: "Qwen3-0.6B-q4f32_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Qwen3-0.6B-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 1924.98,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Qwen3-0.6B-q0f16-MLC",
      model_id: "Qwen3-0.6B-q0f16-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Qwen3-0.6B-q0f16-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 2220.38,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Qwen3-1.7B-q4f16_1-MLC",
      model_id: "Qwen3-1.7B-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Qwen3-1.7B-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 2036.66,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Qwen3-1.7B-q4f32_1-MLC",
      model_id: "Qwen3-1.7B-q4f32_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Qwen3-1.7B-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 2635.44,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Qwen3-4B-q4f16_1-MLC",
      model_id: "Qwen3-4B-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Qwen3-4B-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 3431.59,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Qwen3-4B-q4f32_1-MLC",
      model_id: "Qwen3-4B-q4f32_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Qwen3-4B-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 4327.71,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Qwen3-8B-q4f16_1-MLC",
      model_id: "Qwen3-8B-q4f16_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Qwen3-8B-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 5695.78,
      low_resource_required: false,
      overrides: { context_window_size: 4096 },
    },
    {
      model: "https://huggingface.co/mlc-ai/Qwen3-8B-q4f32_1-MLC",
      model_id: "Qwen3-8B-q4f32_1-MLC",
      model_lib: modelLibURLPrefix + modelVersion + "/Qwen3-8B-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: 6852.55,
      low_resource_required: false,
      overrides: { context_window_size: 4096 },
    },

    // Add more models as needed... (continuing with all models from WebLLM config)
  ],
};

/**
 * Get the Keel model configuration
 * This replaces WebLLM's dynamic discovery with our hardcoded config
 */
export function getKeelModelConfig(): webllm.AppConfig {
  return keelModelConfig;
}

/**
 * Get model list for UI display
 */
export function getKeelModelList(): webllm.ModelRecord[] {
  return keelModelConfig.model_list;
}

/**
 * Get recommended models for Keel (small, fast models)
 */
export function getRecommendedModels(): webllm.ModelRecord[] {
  return keelModelConfig.model_list.filter(model => 
    model.low_resource_required && 
    (model.vram_required_MB || 0) <= 2000
  );
}
