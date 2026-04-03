import { describe, it, expect, vi } from 'vitest'
import * as webllm from "@mlc-ai/web-llm"

// Mock web-llm to get prebuiltAppConfig
vi.mock("@mlc-ai/web-llm", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
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

import { getDynamicModelList, getDynamicAppConfig, getSupportedModels } from '../llm/models'

describe('LLM Dynamic Configuration', () => {
  it('should discover models from GitHub API', async () => {
    const models = await getDynamicModelList()
    expect(models.length).toBeGreaterThan(0)
    
    models.forEach(m => {
      expect(m.model_id).toBeDefined()
      expect(m.model).toContain('https://huggingface.co/mlc-ai/')
      expect(m.model_lib).toContain('raw.githubusercontent.com')
      expect(m.model_lib).toContain('.wasm')
    })
  })

  it('should create dynamic app config', async () => {
    const config = await getDynamicAppConfig()
    expect(config.model_list).toBeDefined()
    expect(config.useIndexedDBCache).toBe(true)
    
    // Should include WebLLM defaults plus discovered models
    expect(config.model_list.length).toBeGreaterThan(0)
  })

  it('should provide supported models for UI', async () => {
    const models = await getSupportedModels()
    expect(models.length).toBeGreaterThan(0)
    
    models.forEach(m => {
      expect(m.modelId).toBeDefined()
      expect(m.displayName).toBeDefined()
      expect(m.vramRequiredMB).toBeGreaterThan(0)
      expect(m.recommendedConfig).toBeDefined()
    })
  })

  it('should list discovered URLs for inspection', async () => {
    const models = await getDynamicModelList()
    console.log('\n--- DIAGNOSTIC: DISCOVERED MODEL URLs ---')
    models.forEach(m => {
      console.log(`Model ID: ${m.model_id}`)
      console.log(`Weights:  ${m.model}`)
      console.log(`WASM:     ${m.model_lib}`)
    })
    console.log('--------------------------------------\n')
  })
})
