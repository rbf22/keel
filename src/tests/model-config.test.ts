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

// Mock fetch for GitHub API
vi.mock('global.fetch', () => {
  return vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve([
      { name: 'v0_2_80', type: 'dir' },
      { name: 'SmolLM2-360M-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm', type: 'file', size: 5900000 },
      { name: 'Llama-3.2-1B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm', type: 'file', size: 5500000 }
    ])
  }))
})

describe('Model configuration verification', () => {
  it('should discover models dynamically', async () => {
    // Import the actual module
    const { getSupportedModels } = await import('../llm/models');
    
    const supportedModels = await getSupportedModels();
    console.log('All supported models:', supportedModels.map(m => m.modelId));
    
    expect(supportedModels.length).toBeGreaterThan(0);
    
    // Should include SmolLM2 from our mock data
    const smolLM2Models = supportedModels.filter(m => m.modelId.includes('SmolLM2-360M'));
    expect(smolLM2Models.length).toBeGreaterThan(0);
    
    const smolLM2 = smolLM2Models.find(m => m.modelId.includes('SmolLM2-360M'));
    expect(smolLM2).toBeDefined();
    expect(smolLM2?.vramRequiredMB).toBeGreaterThan(0);
  });
  
  it('should create dynamic app config', async () => {
    const { getDynamicAppConfig } = await import('../llm/models');
    
    const config = await getDynamicAppConfig();
    expect(config.model_list).toBeDefined();
    expect(config.model_list.length).toBeGreaterThan(0);
    expect(config.useIndexedDBCache).toBe(true);
    
    // Should include discovered models
    const smolLM2 = config.model_list.find(m => m.model_id && m.model_id.includes('SmolLM2'));
    expect(smolLM2).toBeDefined();
    expect(smolLM2?.model).toContain('huggingface.co');
    expect(smolLM2?.model_lib).toContain('raw.githubusercontent.com');
  });
});
