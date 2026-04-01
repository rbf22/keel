import { describe, it, expect } from 'vitest';

describe('Model URL verification', () => {
  it('should have correct URL structure for SmolLM2', async () => {
    const modelLibURLPrefix = 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/';
    const modelVersion = 'v0_2_80';
    
    const model = {
      model_id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
      model: "https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC/resolve/main/",
      model_lib: modelLibURLPrefix + modelVersion + "/SmolLM2-360M-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm"
    };
    
    console.log('Model URL:', model.model);
    console.log('Model Lib URL:', model.model_lib);
    
    // Verify URL structure
    expect(model.model).toBe('https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC/resolve/main/');
    expect(model.model_lib).toBe('https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_80/SmolLM2-360M-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm');
    
    // Test WASM file accessibility
    const wasmResponse = await fetch(model.model_lib, { method: 'HEAD' });
    console.log('WASM file status:', wasmResponse.status);
    expect(wasmResponse.status).toBe(200);
    
    // Test config file accessibility
    const configUrl = model.model + 'mlc-chat-config.json';
    console.log('Config URL:', configUrl);
    const configResponse = await fetch(configUrl, { method: 'HEAD' });
    console.log('Config file status:', configResponse.status);
    expect(configResponse.status).toBe(200);
  });
});
