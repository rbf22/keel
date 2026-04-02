import { describe, it, expect, vi } from 'vitest';

// Mock web-llm before importing llm.ts
vi.mock("@mlc-ai/web-llm", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    modelLibURLPrefix: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/",
    modelVersion: "v0_2_80",
    prebuiltAppConfig: actual.prebuiltAppConfig || { model_list: [] },
  };
})

describe('Model configuration verification', () => {
  it('should include SmolLM2 in supported models', async () => {
    // Import the actual module
    const { SUPPORTED_MODELS } = await import('../llm/models');
    
    console.log('All supported models:', SUPPORTED_MODELS.map(m => m.modelId));
    
    const smolLM2Models = SUPPORTED_MODELS.filter(m => m.modelId.includes('SmolLM2-360M'));
    expect(smolLM2Models.length).toBeGreaterThan(0);
    
    const smolLM2 = smolLM2Models.find(m => m.modelId === 'SmolLM2-360M-Instruct-q4f16_1-MLC');
    expect(smolLM2).toBeDefined();
    expect(smolLM2?.vramRequiredMB).toBe(376.06); // From built-in config
  });
  
  it('should have correct app config structure', async () => {
    const { CUSTOM_APP_CONFIG } = await import('../llm/models');
    
    expect(CUSTOM_APP_CONFIG.model_list).toBeDefined();
    expect(CUSTOM_APP_CONFIG.model_list.length).toBeGreaterThan(0);
    
    const smolLM2 = CUSTOM_APP_CONFIG.model_list.find(m => m.model_id === 'SmolLM2-360M-Instruct-q4f16_1-MLC');
    expect(smolLM2).toBeDefined();
    expect(smolLM2?.model).toBe('https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC/resolve/main/');
    expect(smolLM2?.model_lib).toContain('SmolLM2-360M-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm');
  });
});
