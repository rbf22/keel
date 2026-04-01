import { LLMEngine } from "./llm";
import { logger } from "./logger";
import { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import { PythonRuntime } from "./python-runtime";
import { skillsEngine } from "./skills/engine";
import { AgentResponse } from "./types";

export class AgentOrchestrator {
  // private engine: LLMEngine; // Currently unused in skill-based architecture
  private python: PythonRuntime;
  private chatHistory: ChatCompletionMessageParam[] = [];
  private maxLoops = 15;
  private readonly maxChatHistoryLength = 50; // Prevent memory issues
  
  // Skill execution state
  // private currentSkill: string | null = null; // Currently unused in skill-based architecture
  private skillExecutionHistory: string[] = [];
  private readonly maxSkillHistoryLength = 10;
  
  // Observer pattern state
  // private lastExecutionResult: string = ""; // Currently unused in skill-based architecture
  private needsDeepAnalysis: boolean = false;

  constructor(_engine: LLMEngine, python: PythonRuntime) {
    // this.engine = engine; // Currently unused in skill-based architecture
    this.python = python;
  }
  
  /**
   * Select appropriate skill for the task
   */
  private selectSkill(task: string): string {
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
    
    // Default to python-coding for general tasks
    return 'python-coding';
  }
  
  /**
   * Validate input parameters
   */
  private validateInputs(userRequest: string, onUpdate: (response: AgentResponse) => void): void {
    if (!userRequest || typeof userRequest !== 'string' || userRequest.trim().length === 0) {
      throw new Error('User request must be a non-empty string');
    }
    if (typeof onUpdate !== 'function') {
      throw new Error('onUpdate must be a function');
    }
  }

  /**
   * Truncate chat history to prevent memory issues
   */
  private truncateChatHistory(): void {
    if (this.chatHistory.length > this.maxChatHistoryLength) {
      const keepCount = Math.floor(this.maxChatHistoryLength / 2);
      // Keep first message (user request) and recent messages
      const firstMessage = this.chatHistory[0];
      const recentMessages = this.chatHistory.slice(-keepCount);
      this.chatHistory = [firstMessage, ...recentMessages];
      logger.debug('orchestrator', 'Truncated chat history', { 
        originalLength: this.chatHistory.length, 
        truncatedLength: this.chatHistory.length 
      });
    }
  }

  /**
   * Execute a skill with the given parameters
   */
  private async executeSkillMethod(skillName: string, params: Record<string, unknown>): Promise<string> {
    // Validate inputs
    if (!skillName || typeof skillName !== 'string') {
      throw new Error('Skill name must be a non-empty string');
    }
    if (!params || typeof params !== 'object') {
      throw new Error('Params must be a valid object');
    }
    if (!params.task || typeof params.task !== 'string') {
      throw new Error('Task parameter must be a non-empty string');
    }
    
    logger.info('orchestrator', 'Executing skill', { skillName, paramCount: Object.keys(params).length });
    
    try {
      const context = {
        pythonRuntime: this.python,
        userMessage: params.task as string,
        conversationHistory: this.chatHistory.map(msg => ({ role: msg.role, content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) })),
        timeout: 30000
      };
      
      // Validate skill exists (if hasSkill method is available)
      if (skillsEngine.hasSkill && !skillsEngine.hasSkill(skillName)) {
        throw new Error(`Skill '${skillName}' not found`);
      }
      
      const result = await skillsEngine.executeSkill(skillName, params, context);
      
      // Validate result
      if (!result || typeof result !== 'object') {
        throw new Error('Skill execution returned invalid result');
      }
      
      // Store execution result for observer analysis
      // this.lastExecutionResult = result?.output || ''; // Currently unused
      
      // Determine if deep analysis is needed
      this.needsDeepAnalysis = !(result?.success === true) || 
                             !!(result?.output && result.output.length > 1000) ||
                             !!(result?.error && result.error.length > 100);
      
      if (result?.success) {
        logger.info('orchestrator', 'Skill execution successful', { skillName, outputLength: result.output?.length || 0 });
        return result.output || '';
      } else {
        logger.error('orchestrator', 'Skill execution failed', { skillName, error: result?.error });
        return `Error: ${result?.error || 'Unknown error'}`;
      }
    } catch (error) {
      logger.error('orchestrator', 'Skill execution threw exception', { skillName, error });
      // Return user-friendly error instead of throwing
      return `Skill execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
  
  /**
   * Perform built-in analysis of execution results
   */
  private async analyzeExecutionResult(skillName: string, result: string): Promise<string> {
    logger.debug('orchestrator', 'Analyzing execution result', { skillName, resultLength: result.length });
    
    // Built-in lightweight analysis
    const analysis = [];
    
    // Success assessment
    if (result.toLowerCase().includes('error:') || result.toLowerCase().includes('error')) {
      analysis.push('Execution failed with errors');
    } else if (result.length < 10) {
      analysis.push('Execution produced minimal output');
    } else {
      analysis.push('Execution completed successfully');
    }
    
    // Quality assessment
    if (result.length > 2000) {
      analysis.push('Generated comprehensive output');
    } else if (result.length > 500) {
      analysis.push('Generated moderate output');
    } else {
      analysis.push('Generated concise output');
    }
    
    // Next step recommendation
    if (skillName === 'research' && !result.toLowerCase().includes('no information found')) {
      analysis.push('Research successful - consider data analysis if needed');
    } else if (skillName === 'data-analysis') {
      analysis.push('Data analysis complete - review results or proceed with next step');
    } else if (skillName === 'python-coding') {
      analysis.push('Code executed - review output or run quality check');
    }
    
    return analysis.join('. ');
  }
  
  /**
   * Perform deep analysis when needed
   */
  private async performDeepAnalysis(task: string, skillName: string, result: string): Promise<string> {
    logger.info('orchestrator', 'Performing deep analysis', { skillName });
    
    const analysisParams = {
      task,
      skill_used: skillName,
      result,
      execution_data: {
        duration: 0, // Could track this if needed
        memory_usage: 0
      }
    };
    
    return await this.executeSkillMethod('execution-analyzer', analysisParams);
  }
  
  /**
   * Detect if we're in a repeating skill cycle
   * Enhanced with context awareness to avoid false positives for legitimate workflows
   */
  private detectSkillCycle(): boolean {
    if (this.skillExecutionHistory.length < 8) return false; // Need more history for better detection
    
    // Define legitimate workflow patterns that should not be considered cycles
    const legitimatePatterns = [
      ['research', 'data-analysis', 'python-coding', 'quality-review'],
      ['task-planning', 'research', 'data-analysis', 'python-coding'],
      ['python-coding', 'quality-review', 'python-coding'], // Code review iteration
      ['research', 'python-coding', 'quality-review'] // Simplified workflow
    ];
    
    // Try to find cycles of different lengths (2-4 skills)
    for (let cycleLength = 2; cycleLength <= 4; cycleLength++) {
      if (this.skillExecutionHistory.length < cycleLength * 3) continue; // Need at least 3 repetitions
      
      const recentSkills = this.skillExecutionHistory.slice(-cycleLength);
      
      // Check if this matches any legitimate pattern
      const isLegitimatePattern = legitimatePatterns.some(pattern => 
        pattern.length === cycleLength && 
        pattern.every((skill, index) => skill === recentSkills[index])
      );
      
      if (isLegitimatePattern) {
        // This is a legitimate workflow, not a cycle
        continue;
      }
      
      // Look for this sequence repeating at least 3 times (indicating a true cycle)
      let repetitionCount = 0;
      for (let i = 0; i <= this.skillExecutionHistory.length - cycleLength; i += cycleLength) {
        const candidateSequence = this.skillExecutionHistory.slice(i, i + cycleLength);
        
        if (candidateSequence.length === recentSkills.length &&
            candidateSequence.every((skill, index) => skill === recentSkills[index])) {
          repetitionCount++;
        } else {
          break; // Pattern broken, reset count
        }
      }
      
      // If we found 3+ repetitions of the same pattern, it's likely a cycle
      if (repetitionCount >= 3) {
        logger.warn('orchestrator', 'Detected legitimate skill cycle', {
          cycleLength,
          pattern: recentSkills.join(' -> '),
          repetitions: repetitionCount
        });
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Reset loop detection state (call when task completes or resets)
   */
  private resetLoopDetection(): void {
    this.skillExecutionHistory = [];
  }

  async runTask(userRequest: string, onUpdate: (response: AgentResponse) => void, signal?: AbortSignal): Promise<ChatCompletionMessageParam[]> {
    // Validate inputs
    this.validateInputs(userRequest, onUpdate);
    
    logger.info("orchestrator", "Starting skill-based task execution", { 
      userRequest, 
      requestLength: userRequest.length 
    });
    
    // Reset state for fresh task
    this.resetLoopDetection();
    this.chatHistory = [];

    let loopCount = 0;
    let taskComplete = false;
    let lastSkill = "";
    let noProgressCount = 0;

    logger.debug("orchestrator", "Adding user request to chat history", { userRequest });
    this.chatHistory.push({ role: "user", content: userRequest });

    // Select initial skill
    let currentSkill = this.selectSkill(userRequest);
    let taskInstruction = userRequest;

    while (!taskComplete && loopCount < this.maxLoops) {
      if (signal?.aborted) {
        logger.info("orchestrator", "Task aborted by signal");
        throw new Error("Task aborted");
      }
      
      loopCount++;
      // this.currentSkill = currentSkill; // Currently unused
      
      logger.info("orchestrator", `Loop ${loopCount} executing skill: ${currentSkill}`, {
        loopCount,
        skillName: currentSkill,
        instructionLength: taskInstruction.length,
        maxLoops: this.maxLoops
      });

      // Execute the current skill
      onUpdate({ 
        personaId: "system", 
        content: `Executing skill: ${currentSkill}`,
        type: undefined
      });

      const skillParams = { task: taskInstruction };
      const result = await this.executeSkillMethod(currentSkill, skillParams);
      
      // Add result to chat history
      this.chatHistory.push({ role: "assistant", content: result });
      
      // Truncate chat history to prevent memory issues
      this.truncateChatHistory();
      
      // Perform built-in analysis
      const analysis = await this.analyzeExecutionResult(currentSkill, result);
      
      // Perform deep analysis if needed
      let deepAnalysis = "";
      if (this.needsDeepAnalysis) {
        deepAnalysis = await this.performDeepAnalysis(userRequest, currentSkill, result);
      }
      
      // Update user with results
      onUpdate({ 
        personaId: currentSkill, 
        content: result,
        type: undefined
      });
      
      onUpdate({ 
        personaId: "observer", 
        content: analysis,
        type: undefined
      });
      
      if (deepAnalysis) {
        onUpdate({ 
          personaId: "execution-analyzer", 
          content: deepAnalysis,
          type: undefined
        });
      }

      // Determine next step
      if (result.toLowerCase().includes("finish") || result.toLowerCase().includes("task complete")) {
        taskComplete = true;
        logger.info("orchestrator", "Task completed successfully");
        onUpdate({ 
          personaId: "system", 
          content: "Task completed successfully.",
          type: undefined
        });
        break;
      }
      
      // Simple progression logic - can be enhanced with LLM
      if (currentSkill === 'research' && !result.toLowerCase().includes('no information found')) {
        currentSkill = 'data-analysis';
        taskInstruction = `Analyze the research results: ${result}`;
      } else if (currentSkill === 'data-analysis') {
        currentSkill = 'python-coding';
        taskInstruction = `Create code based on the analysis: ${result}`;
      } else if (currentSkill === 'python-coding') {
        currentSkill = 'quality-review';
        taskInstruction = `Review the code execution: ${result}`;
      } else if (currentSkill === 'quality-review') {
        if (result.toLowerCase().includes('approved')) {
          taskComplete = true;
        } else {
          currentSkill = 'python-coding';
          taskInstruction = `Fix the code based on review: ${result}`;
        }
      } else if (currentSkill === 'task-planning') {
        // After planning, proceed with research or coding based on plan
        if (result.toLowerCase().includes('research') || result.toLowerCase().includes('investigate')) {
          currentSkill = 'research';
          taskInstruction = `Execute research phase of plan: ${result}`;
        } else {
          currentSkill = 'python-coding';
          taskInstruction = `Execute coding phase of plan: ${result}`;
        }
      } else if (currentSkill === 'execution-analyzer') {
        // After analysis, determine next step based on recommendations
        if (result.toLowerCase().includes('continue') || result.toLowerCase().includes('proceed')) {
          currentSkill = 'python-coding';
          taskInstruction = `Continue with next step based on analysis: ${result}`;
        } else if (result.toLowerCase().includes('research') || result.toLowerCase().includes('investigate')) {
          currentSkill = 'research';
          taskInstruction = `Research based on analysis recommendations: ${result}`;
        } else {
          // Analysis suggests completion or no clear next step
          taskComplete = true;
        }
      } else {
        // Default: try research again or finish
        if (loopCount > 3) {
          taskComplete = true;
        } else {
          currentSkill = 'research';
          taskInstruction = `Continue research based on: ${result}`;
        }
      }
      
      // Track skill sequence
      this.skillExecutionHistory.push(currentSkill);
      if (this.skillExecutionHistory.length > this.maxSkillHistoryLength) {
        this.skillExecutionHistory.shift();
      }
      
      // Check for repeating skill cycles
      if (this.detectSkillCycle()) {
        logger.warn("orchestrator", "Detected repeating skill cycle, terminating task", {
          loopCount,
          sequence: this.skillExecutionHistory.slice(-4).join(' -> ')
        });
        onUpdate({ 
          personaId: "system", 
          content: `Detected repeating skill pattern (${this.skillExecutionHistory.slice(-4).join(' -> ')}). Terminating to prevent infinite loop.`, 
          type: undefined
        });
        break;
      }
      
      // Legacy simple loop detection
      if (currentSkill === lastSkill) {
        noProgressCount++;
        if (noProgressCount > 3) {
          onUpdate({ 
            personaId: "system", 
            content: "Task appears to be stuck with the same skill. Terminating to prevent infinite execution.", 
            type: undefined
          });
          break;
        }
      } else {
        noProgressCount = 0;
        lastSkill = currentSkill;
      }
    }

    if (loopCount >= this.maxLoops) {
      logger.warn("orchestrator", "Task terminated due to maximum loops");
      onUpdate({ 
        personaId: "system", 
        content: "Task terminated due to maximum loop limit.", 
        type: undefined
      });
    }

    logger.info("orchestrator", "Task execution completed", { 
      loopCount, 
      taskComplete,
      skillsUsed: [...new Set(this.skillExecutionHistory)]
    });
    
    return this.chatHistory;
  }

  // Legacy methods for compatibility
  async executeTool(toolName: string, args: Record<string, unknown>, _onUpdate: (response: AgentResponse) => void): Promise<string> {
    // Map tool names to skills
    const skillMapping: Record<string, string> = {
      'web_fetch': 'research',
      'execute_python': 'python-coding',
      'vfs_write': 'python-coding',
      'vfs_read': 'research',
      'memory_update': 'execution-analyzer'
    };
    
    const skillName = skillMapping[toolName] || 'python-coding';
    
    // Convert legacy tool parameters to skill task parameter
    let task = '';
    if (toolName === 'web_fetch' && args.url) {
      task = `Fetch content from: ${args.url}`;
    } else if (toolName === 'execute_python' && args.code) {
      task = `Execute Python code: ${args.code}`;
    } else if (toolName === 'vfs_write' && args.path && args.content) {
      task = `Write to file ${args.path}: ${args.content}`;
    } else if (toolName === 'vfs_read' && args.path) {
      task = `Read file: ${args.path}`;
    } else if (toolName === 'memory_update' && args.category && args.content) {
      task = `Update memory ${args.category}: ${args.content}`;
    } else {
      task = `Execute ${toolName} with parameters: ${JSON.stringify(args)}`;
    }
    
    return await this.executeSkillMethod(skillName, { task });
  }
}
