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

import { CUSTOM_MODEL_LIST, CUSTOM_APP_CONFIG, SUPPORTED_MODELS } from '../llm/models'

describe('LLM Diagnostic Configuration', () => {
  it('should have valid-looking Hugging Face URLs', () => {
    CUSTOM_MODEL_LIST.forEach(m => {
      expect(m.model).toContain('https://huggingface.co/mlc-ai/')
      expect(m.model).toContain('/resolve/main/')
    })
  })

  it('should have custom model list with valid dynamic URLs', () => {
    expect(CUSTOM_MODEL_LIST.length).toBe(6)
    
    CUSTOM_MODEL_LIST.forEach(m => {
      // Verify WASM URL construction
      expect(m.model_lib).toContain(webllm.modelLibURLPrefix)
      expect(m.model_lib).toContain(webllm.modelVersion)
      expect(m.model_lib).toContain('-ctx4k_cs1k-webgpu.wasm')
    })
  })

  it('should merge CUSTOM_MODEL_LIST into CUSTOM_APP_CONFIG', () => {
    expect(CUSTOM_APP_CONFIG.model_list).toBeDefined()
    
    // Check that our specific models are in the final app config
    CUSTOM_MODEL_LIST.forEach(customModel => {
      const found = CUSTOM_APP_CONFIG.model_list.find(m => m.model_id === customModel.model_id)
      expect(found).toBeDefined()
      expect(found?.model).toBe(customModel.model)
      expect(found?.model_lib).toBe(customModel.model_lib)
    })
  })

  it('should enable IndexedDB cache for reliability', () => {
    expect(CUSTOM_APP_CONFIG.useIndexedDBCache).toBe(true)
  })

  it('should list exact URLs for user inspection in logs', () => {
    console.log('\n--- DIAGNOSTIC: CURRENT MODEL URLs ---')
    CUSTOM_MODEL_LIST.forEach(m => {
      console.log(`Model ID: ${m.model_id}`)
      console.log(`Weights:  ${m.model}`)
      console.log(`WASM:     ${m.model_lib}`)
    })
    console.log('--------------------------------------\n')
  })
})
