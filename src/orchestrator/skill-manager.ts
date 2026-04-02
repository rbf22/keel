import { logger } from "../logger";
import { skillsEngine } from "../skills/engine";
import { AgentResponse } from "../types";
import { PythonRuntime } from "../python-runtime";
import { ChatCompletionMessageParam } from "@mlc-ai/web-llm";

export class SkillManager {
  private python: PythonRuntime;

  constructor(python: PythonRuntime) {
    this.python = python;
  }

  /**
   * Select appropriate skill for the task
   */
  selectSkill(task: string): string {
    const taskLower = task.toLowerCase();
    
    // Priority-based skill selection
    if (taskLower.includes('research') || taskLower.includes('find') || taskLower.includes('investigate')) {
      return 'research';
    }
    if (taskLower.includes('data') || taskLower.includes('analyze') || taskLower.includes('statistics')) {
      return 'data-analysis';
    }
    if (taskLower.includes('code') || taskLower.includes('program') || taskLower.includes('script')) {
      return 'python-coding';
    }
    if (taskLower.includes('plan') || taskLower.includes('complex') || taskLower.includes('break down')) {
      return 'task-planning';
    }
    
    return 'python-coding';
  }

  /**
   * Validate input parameters
   */
  validateInputs(userRequest: string, onUpdate: (response: AgentResponse) => void): void {
    if (!userRequest || typeof userRequest !== 'string' || userRequest.trim().length === 0) {
      throw new Error('User request must be a non-empty string');
    }
    if (typeof onUpdate !== 'function') {
      throw new Error('onUpdate must be a function');
    }
  }

  /**
   * Execute a skill with the given parameters
   */
  async executeSkill(
    skillName: string, 
    params: Record<string, unknown>, 
    chatHistory: ChatCompletionMessageParam[]
  ): Promise<{ output: string; needsDeepAnalysis: boolean }> {
    if (!skillName || typeof skillName !== 'string') {
      throw new Error('Skill name must be a non-empty string');
    }
    if (!params || typeof params !== 'object' || !params.task) {
      throw new Error('Params must be a valid object with a task property');
    }
    
    logger.info('orchestrator', 'Executing skill', { skillName, paramCount: Object.keys(params).length });
    
    try {
      const context = {
        pythonRuntime: this.python,
        userMessage: params.task as string,
        conversationHistory: chatHistory.map(msg => ({ 
          role: msg.role, 
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) 
        })),
        timeout: 30000
      };
      
      if (skillsEngine.hasSkill && !skillsEngine.hasSkill(skillName)) {
        throw new Error(`Skill '${skillName}' not found`);
      }
      
      const result = await skillsEngine.executeSkill(skillName, params, context);
      
      if (!result || typeof result !== 'object') {
        throw new Error('Skill execution returned invalid result');
      }
      
      const needsDeepAnalysis = !(result?.success === true) || 
                               !!(result?.output && result.output.length > 1000) ||
                               !!(result?.error && result.error.length > 100);
      
      if (result?.success) {
        logger.info('orchestrator', 'Skill execution successful', { skillName, outputLength: result.output?.length || 0 });
        return { output: result.output || '', needsDeepAnalysis };
      } else {
        logger.error('orchestrator', 'Skill execution failed', { skillName, error: result?.error });
        return { output: `Error: ${result?.error || 'Unknown error'}`, needsDeepAnalysis };
      }
    } catch (error) {
      logger.error('orchestrator', 'Skill execution threw exception', { skillName, error });
      return { 
        output: `Skill execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        needsDeepAnalysis: true 
      };
    }
  }

  /**
   * Perform built-in analysis of execution results
   */
  async analyzeExecutionResult(skillName: string, result: string): Promise<string> {
    logger.debug('orchestrator', 'Analyzing execution result', { skillName, resultLength: result.length });
    
    const analysis = [];
    
    if (result.toLowerCase().includes('error:') || result.toLowerCase().includes('error')) {
      analysis.push('Execution failed with errors');
    } else if (result.length < 10) {
      analysis.push('Execution produced minimal output');
    } else {
      analysis.push('Execution completed successfully');
    }
    
    if (result.length > 2000) {
      analysis.push('Generated comprehensive output');
    } else if (result.length > 500) {
      analysis.push('Generated moderate output');
    } else {
      analysis.push('Generated concise output');
    }
    
    if (skillName === 'research' && !result.toLowerCase().includes('no information found')) {
      analysis.push('Research successful - consider data analysis if needed');
    } else if (skillName === 'data-analysis') {
      analysis.push('Data analysis complete - review results or proceed with next step');
    } else if (skillName === 'python-coding') {
      analysis.push('Code executed - review output or run quality check');
    }
    
    return analysis.join('. ');
  }
}
