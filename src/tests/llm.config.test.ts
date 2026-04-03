import { describe, it, expect, vi } from 'vitest'

// Mock web-llm for the configuration test
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

import { getDynamicModelList, getDynamicAppConfig } from '../llm/models'

describe('LLM Dynamic Configuration', () => {
  it('should have dynamic model list defined', async () => {
    const models = await getDynamicModelList()
    expect(models).toBeDefined()
    expect(models.length).toBeGreaterThan(0)
  })

  it('should have correct property names in ModelRecord', async () => {
    const models = await getDynamicModelList()
    models.forEach(m => {
      expect(m).toHaveProperty('model_id')
      expect(m).toHaveProperty('model')
      expect(m).toHaveProperty('model_lib')
      // Ensure we are NOT using model_url or model_lib_url which are incorrect for this version
      expect(m).not.toHaveProperty('model_url')
      expect(m).not.toHaveProperty('model_lib_url')
    })
  })

  it('should have valid-looking Hugging Face URLs', async () => {
    const models = await getDynamicModelList()
    models.forEach(m => {
      expect(m.model).toContain('https://huggingface.co/')
      // Should contain /resolve/main/ for reliable direct access
      expect(m.model).toContain('/resolve/main/')
    })
  })

  it('should have valid-looking WASM URLs with correct version', async () => {
    const models = await getDynamicModelList()
    models.forEach(m => {
      expect(m.model_lib).toContain('https://raw.githubusercontent.com/')
      expect(m.model_lib).toContain('/v0_2_80/')
      expect(m.model_lib.endsWith('.wasm')).toBe(true)
    })
  })

  it('should create valid app config', async () => {
    const config = await getDynamicAppConfig()
    expect(config.model_list).toBeDefined()
    expect(config.model_list.length).toBeGreaterThan(0)
    expect(config.useIndexedDBCache).toBe(true)
  })

  it('should output the exact URLs for inspection', async () => {
    const models = await getDynamicModelList()
    console.log('--- Dynamic Model Configuration URLs ---')
    models.forEach(m => {
      console.log(`Model: ${m.model_id}`)
      console.log(`  Weights: ${m.model}`)
      console.log(`  WASM:    ${m.model_lib}`)
    })
    console.log('--------------------------------')
  })
})
