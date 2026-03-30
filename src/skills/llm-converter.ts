import { LLMEngine } from '../llm'
import { logger } from '../logger'

export class LLMConverter {
  private engine: LLMEngine | null = null
  private readonly MAX_RETRIES = 2

  constructor(engine?: LLMEngine) {
    this.engine = engine || null
  }

  setEngine(engine: LLMEngine | null) {
    this.engine = engine
  }

  async convertWithLLM(jsCode: string): Promise<string> {
    if (!this.engine) {
      throw new Error('LLM engine not available')
    }

    const prompt = this.buildConversionPrompt(jsCode)
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        logger.info('llm', 'Attempting conversion (attempt {attempt})', {
          codeLength: jsCode.length
        })

        const pythonCode = await this.engine.generate(prompt, {
          onToken: () => {}, // No need for streaming
          history: [],
          systemOverride: 'You are a JavaScript to Python converter. Convert the given JavaScript code to idiomatic Python code. Return only the Python code without explanations.'
        })

        // Extract just the code block in case the LLM adds explanations
        const cleanCode = this.extractCodeFromResponse(pythonCode)
        
        if (!cleanCode) {
          throw new Error('No valid Python code in LLM response')
        }

        logger.info('llm', 'Conversion successful', {
          attempt,
          outputLength: cleanCode.length
        })

        return cleanCode
      } catch (error: any) {
        logger.error('llm', `Conversion failed (attempt ${attempt})`, {
          error: error.message,
          attempt
        })

        if (attempt === this.MAX_RETRIES) {
          throw error
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }

    throw new Error('All conversion attempts failed')
  }

  private buildConversionPrompt(jsCode: string): string {
    return `Convert this JavaScript code to Python. Preserve functionality while making it Pythonic.

Requirements:
- Use Python standard library equivalents
- Convert async/await to Python asyncio
- Convert arrow functions to regular functions or lambdas
- Replace JavaScript array methods with Python equivalents
- Add necessary imports at the top
- Maintain the same input/output behavior
- Preserve comments when possible
- Do not add explanations, return only code

JavaScript code:
\`\`\`javascript
${jsCode}
\`\`\`

Python code:`
  }

  private extractCodeFromResponse(response: string): string {
    // Look for code blocks
    const codeBlockMatch = response.match(/```(?:python)?\n([\s\S]*?)\n```/)
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim()
    }

    // If no code blocks, try to extract the whole response
    const cleaned = response
      .replace(/^(Here is|Here's) the (converted )?Python code:?\n*/i, '')
      .replace(/^The Python (equivalent|conversion) is:?\n*/i, '')
      .replace(/^Python code:?\n*/i, '')
      .trim()

    return cleaned
  }

  isAvailable(): boolean {
    return this.engine !== null
  }
}
