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

import { CUSTOM_MODEL_LIST, CUSTOM_APP_CONFIG, SUPPORTED_MODELS } from '../llm/models'

describe('LLM Configuration', () => {
  it('should have custom model list defined', () => {
    expect(CUSTOM_MODEL_LIST).toBeDefined()
    expect(CUSTOM_MODEL_LIST.length).toBeGreaterThan(0)
  })

  it('should have correct property names in ModelRecord', () => {
    CUSTOM_MODEL_LIST.forEach(m => {
      expect(m).toHaveProperty('model_id')
      expect(m).toHaveProperty('model')
      expect(m).toHaveProperty('model_lib')
      // Ensure we are NOT using model_url or model_lib_url which are incorrect for this version
      expect(m).not.toHaveProperty('model_url')
      expect(m).not.toHaveProperty('model_lib_url')
    })
  })

  it('should have valid-looking Hugging Face URLs', () => {
    CUSTOM_MODEL_LIST.forEach(m => {
      expect(m.model).toContain('https://huggingface.co/')
      // Should contain /resolve/main/ for reliable direct access
      expect(m.model).toContain('/resolve/main/')
    })
  })

  it('should have valid-looking WASM URLs with correct version', () => {
    CUSTOM_MODEL_LIST.forEach(m => {
      expect(m.model_lib).toContain('https://raw.githubusercontent.com/')
      expect(m.model_lib).toContain('/v0_2_80/')
      expect(m.model_lib.endsWith('.wasm')).toBe(true)
    })
  })

  it('should sync SUPPORTED_MODELS with CUSTOM_MODEL_LIST', () => {
    expect(SUPPORTED_MODELS.length).toBe(CUSTOM_MODEL_LIST.length)
    CUSTOM_MODEL_LIST.forEach((m, i) => {
      expect(SUPPORTED_MODELS[i].modelId).toBe(m.model_id)
    })
  })

  it('should output the exact URLs for inspection', () => {
    console.log('--- Model Configuration URLs ---')
    CUSTOM_MODEL_LIST.forEach(m => {
      console.log(`Model: ${m.model_id}`)
      console.log(`  Weights: ${m.model}`)
      console.log(`  WASM:    ${m.model_lib}`)
    })
    console.log('--------------------------------')
  })
})
