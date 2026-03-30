import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LLMConverter } from './llm-converter'

// Mock the logger
vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

describe('LLMConverter', () => {
  let converter: LLMConverter
  let mockEngine: any

  beforeEach(() => {
    mockEngine = {
      generate: vi.fn()
    }
    converter = new LLMConverter(mockEngine)
  })

  it('should convert simple JavaScript to Python', async () => {
    mockEngine.generate.mockResolvedValue('print("Hello World")')
    
    const result = await converter.convertWithLLM('console.log("Hello World")')
    
    expect(result).toBe('print("Hello World")')
    expect(mockEngine.generate).toHaveBeenCalledWith(
      expect.stringContaining('console.log("Hello World")'),
      expect.any(Object)
    )
  })

  it('should extract code from markdown blocks', async () => {
    mockEngine.generate.mockResolvedValue('```python\nprint("Hello")\n```')
    
    const result = await converter.convertWithLLM('console.log("Hello")')
    
    expect(result).toBe('print("Hello")')
  })

  it('should handle conversion failures with retry', async () => {
    mockEngine.generate
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce('print("Success")')
    
    const result = await converter.convertWithLLM('console.log("test")')
    
    expect(result).toBe('print("Success")')
    expect(mockEngine.generate).toHaveBeenCalledTimes(2)
  })

  it('should throw error after max retries', async () => {
    mockEngine.generate.mockRejectedValue(new Error('Persistent error'))
    
    await expect(converter.convertWithLLM('console.log("test")')).rejects.toThrow('Persistent error')
    expect(mockEngine.generate).toHaveBeenCalledTimes(2) // Initial attempt + 1 retry (MAX_RETRIES=2)
  })

  it('should return availability status', () => {
    expect(converter.isAvailable()).toBe(true)
    
    converter.setEngine(null)
    expect(converter.isAvailable()).toBe(false)
  })

  it('should handle complex JavaScript patterns', async () => {
    const jsCode = `
      const data = [1, 2, 3];
      data.forEach(x => console.log(x * 2));
    `
    
    mockEngine.generate.mockResolvedValue(`
data = [1, 2, 3]
for x in data:
    print(x * 2)
    `)
    
    const result = await converter.convertWithLLM(jsCode)
    
    expect(result).toContain('data = [1, 2, 3]')
    expect(result).toContain('for x in data:')
  })
})
