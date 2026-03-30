import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JS_to_Python_Converter } from './parser'
import { LLMConverter } from './llm-converter'

describe('JS_to_Python_Converter with LLM fallback', () => {
  let mockLLMConverter: any

  beforeEach(() => {
    mockLLMConverter = {
      convertWithLLM: vi.fn(),
      isAvailable: vi.fn()
    }
    JS_to_Python_Converter.setLLMConverter(mockLLMConverter)
  })

  it('should use LLM when available', async () => {
    mockLLMConverter.isAvailable.mockReturnValue(true)
    mockLLMConverter.convertWithLLM.mockResolvedValue('print("LLM result")')
    
    const result = await JS_to_Python_Converter.convertWithFallback('console.log("test")')
    
    expect(result).toBe('print("LLM result")')
    expect(mockLLMConverter.convertWithLLM).toHaveBeenCalledWith('console.log("test")')
  })

  it('should fallback to simple converter when LLM fails', async () => {
    mockLLMConverter.isAvailable.mockReturnValue(true)
    mockLLMConverter.convertWithLLM.mockRejectedValue(new Error('LLM error'))
    
    const result = await JS_to_Python_Converter.convertWithFallback('console.log("test")')
    
    expect(result).toBe('print("test")')
    expect(mockLLMConverter.convertWithLLM).toHaveBeenCalledWith('console.log("test")')
  })

  it('should use simple converter when LLM not available', async () => {
    mockLLMConverter.isAvailable.mockReturnValue(false)
    
    const result = await JS_to_Python_Converter.convertWithFallback('console.log("test")')
    
    expect(result).toBe('print("test")')
    expect(mockLLMConverter.convertWithLLM).not.toHaveBeenCalled()
  })

  it('should handle complex JavaScript with LLM', async () => {
    const jsCode = `
      const data = [1, 2, 3].map(x => x * 2);
      console.log(data);
    `
    
    mockLLMConverter.isAvailable.mockReturnValue(true)
    mockLLMConverter.convertWithLLM.mockResolvedValue(`
data = [x * 2 for x in [1, 2, 3]]
print(data)
    `.trim())
    
    const result = await JS_to_Python_Converter.convertWithFallback(jsCode)
    
    expect(result).toContain('[x * 2 for x in [1, 2, 3]]')
    expect(result).toContain('print(data)')
  })

  it('should maintain backward compatibility with simple convert', () => {
    const result = JS_to_Python_Converter.convert('console.log("test")')
    
    expect(result).toBe('print("test")')
  })

  afterEach(() => {
    JS_to_Python_Converter.setLLMConverter(null)
  })
})
