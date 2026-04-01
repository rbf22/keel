import { LLMEngine } from "./llm";
import { logger } from "./logger";
import { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import { PythonRuntime } from "./python-runtime";
import { skillsEngine } from "./skills/engine";
import { AgentResponse } from "./types";
import { storage } from "./storage";

// Code artifact interface for context sharing between skills
interface CodeArtifact {
  id: string;
  name: string;
  description: string;
  function: string;
  usage: string;
  dependencies: string[];
  test_cases?: Array<{
    input?: any;
    operation?: string;
    expected?: any;
  }>;
  created_by: string;
  reviewed_by?: string;
  status: 'pending' | 'approved' | 'needs_fixes' | 'rejected';
}

// Review result interface
interface ReviewResult {
  artifact_id: string;
  artifact_name: string;
  approved: boolean;
  issues: string[];
  suggestions: string[];
  security_concerns: string[];
  test_results?: {
    pass: boolean;
    coverage: string;
  };
  feedback: string;
  recommendation: 'approved' | 'needs_fixes' | 'rejected';
}

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
  
  // Code artifact context sharing
  private currentArtifact: CodeArtifact | null = null;

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
    if (this.skillExecutionHistory.length < 6) return false; // Need more history for better detection
    
    // Define legitimate workflow patterns that should not be considered cycles
    const legitimatePatterns = [
      ['research', 'data-analysis', 'python-coding', 'quality-review'],
      ['task-planning', 'research', 'data-analysis', 'python-coding'],
      ['python-coding', 'quality-review', 'python-coding'], // Code review iteration
      ['research', 'python-coding', 'quality-review'], // Simplified workflow
      ['python-coding', 'quality-review'] // Simple code-review cycle
    ];
    
    // Try to find cycles of different lengths (2-4 skills)
    for (let cycleLength = 2; cycleLength <= 4; cycleLength++) {
      if (this.skillExecutionHistory.length < cycleLength * 2) continue; // Need at least 2 repetitions
      
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
      
      // Look for this sequence repeating at least 3 times consecutively (indicating a true cycle)
      let consecutiveRepetitions = 0;
      let maxConsecutiveRepetitions = 0;
      
      for (let i = this.skillExecutionHistory.length - cycleLength; i >= cycleLength - 1; i -= cycleLength) {
        const candidateSequence = this.skillExecutionHistory.slice(i - cycleLength + 1, i + 1);
        
        if (candidateSequence.length === recentSkills.length &&
            candidateSequence.every((skill, index) => skill === recentSkills[index])) {
          consecutiveRepetitions++;
          maxConsecutiveRepetitions = Math.max(maxConsecutiveRepetitions, consecutiveRepetitions);
        } else {
          consecutiveRepetitions = 0; // Reset count when pattern breaks
        }
      }
      
      // If we found 4+ consecutive repetitions of the same pattern, it's likely a cycle
      // (This means the pattern repeated at least 4 times in a row)
      if (maxConsecutiveRepetitions >= 4) {
        logger.warn('orchestrator', 'Detected repeating skill cycle', {
          cycleLength,
          pattern: recentSkills.join(' -> '),
          repetitions: maxConsecutiveRepetitions
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
    
    // Check for artifact commands first
    logger.info('orchestrator', 'Checking for artifact command', { userRequest });
    const artifactResult = await this.handleArtifactCommand(userRequest);
    if (artifactResult !== null) {
      logger.info('orchestrator', 'Artifact command detected, returning result', { artifactResult });
      // Return the artifact command result
      this.chatHistory.push({ role: "user", content: userRequest });
      this.chatHistory.push({ role: "assistant", content: artifactResult });
      return this.chatHistory;
    }
    
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
        // Try to parse result as a code artifact
        try {
          const artifact: CodeArtifact = JSON.parse(result);
          this.currentArtifact = artifact;
          logger.info("orchestrator", `Code artifact created: ${artifact.id} - ${artifact.name}`);
          
          // Move to quality review with the artifact
          currentSkill = 'quality-review';
          taskInstruction = `Review this code artifact: ${JSON.stringify(artifact, null, 2)}`;
        } catch (e) {
          // If not JSON, treat as direct result and complete task
          if (result.length > 10 && 
              (result.toLowerCase().includes('sum') || result.toLowerCase().includes('result') || 
               result.toLowerCase().includes('calculated') || result.toLowerCase().includes('answer') ||
               result.toLowerCase().includes('the ') || result.includes('is'))) {
            taskComplete = true;
            logger.info("orchestrator", "Task completed by python-coding skill");
            onUpdate({ 
              personaId: "system", 
              content: "Task completed successfully.",
              type: undefined
            });
          } else {
            // Move to quality review for further validation
            currentSkill = 'quality-review';
            taskInstruction = `Review the code execution: ${result}`;
          }
        }
      } else if (currentSkill === 'quality-review') {
        // Try to parse result as a review
        try {
          const review: ReviewResult = JSON.parse(result);
          logger.info("orchestrator", `Review completed: ${review.recommendation} for artifact ${review.artifact_id}`);
          
          if (review.approved && this.currentArtifact) {
            // Execute the approved artifact
            const executionResult = await this.executeArtifact(this.currentArtifact, userRequest);
            taskComplete = true;
            onUpdate({ 
              personaId: "system", 
              content: `Task completed. Result: ${executionResult}`,
              type: undefined
            });
          } else if (review.recommendation === 'needs_fixes') {
            // Send back to python-coding with feedback
            currentSkill = 'python-coding';
            taskInstruction = `Fix the code artifact based on this review: ${JSON.stringify(review, null, 2)}`;
          } else if (review.recommendation === 'rejected') {
            // Start over with a different approach
            currentSkill = 'python-coding';
            taskInstruction = `Create a new code artifact for: ${userRequest}`;
          } else {
            // Default to completion
            taskComplete = true;
          }
        } catch (e) {
          // If not JSON, use legacy logic
          if (result.toLowerCase().includes('approved')) {
            taskComplete = true;
          } else if (result.toLowerCase().includes('rejected') && result.toLowerCase().includes('no output')) {
            currentSkill = 'python-coding';
            taskInstruction = `Try a different approach for: ${userRequest}`;
          } else if (result.toLowerCase().includes('rejected')) {
            currentSkill = 'python-coding';
            taskInstruction = `Fix the code based on review: ${result}`;
          } else {
            taskComplete = true;
          }
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

  /**
   * Execute an approved code artifact with user inputs
   */
  private async executeArtifact(artifact: CodeArtifact, userRequest: string): Promise<string> {
    logger.info("orchestrator", `Executing artifact ${artifact.id} for user request`);
    
    try {
      // Extract inputs from user request based on artifact type
      const executionInputs = this.extractInputsFromRequest(userRequest, artifact);
      
      // Create execution code with the function and inputs
      const fullCode = `
# Artifact function
${artifact.function}

# Execution with extracted inputs
${this.generateExecutionCode(artifact, executionInputs)}
`;
      
      // Execute the code using the temporary output handler
      let outputResult = '';
      await this.python.executeWithTemporaryOutput((output) => {
        // Capture output
        if (output.message) {
          outputResult += output.message + '\n';
        }
      }, async () => {
        await this.python.execute(fullCode);
      });
      
      return outputResult || "Execution completed but no output captured";
      
    } catch (error) {
      logger.error("orchestrator", `Failed to execute artifact ${artifact.id}`, { error });
      return `Error executing artifact: ${error}`;
    }
  }

  /**
   * Extract inputs from user request based on artifact type
   */
  private extractInputsFromRequest(request: string, artifact: CodeArtifact): Record<string, any> {
    const inputs: Record<string, any> = {};
    
    if (artifact.name.includes('sum') || artifact.name.includes('calculator')) {
      // Extract numbers for math operations
      const numbers = request.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        inputs['numbers'] = numbers.map(n => parseInt(n));
      }
    } else if (artifact.name.includes('data')) {
      // For data artifacts, we might need sample data
      inputs['data'] = this.generateSampleData(request);
    }
    
    return inputs;
  }

  /**
   * Generate execution code for the artifact
   */
  private generateExecutionCode(artifact: CodeArtifact, inputs: Record<string, any>): string {
    if (artifact.name.includes('sum')) {
      return `result = calculate_sum(${JSON.stringify(inputs.numbers || [])})
print(f"The sum is: {result}")`;
    } else if (artifact.name.includes('product')) {
      return `result = calculate_product(${JSON.stringify(inputs.numbers || [])})
print(f"The product is: {result}")`;
    } else if (artifact.name.includes('math_calculator')) {
      return `result = calculate('sum', ${JSON.stringify(inputs.numbers || [])})
print(f"Result: {result}")`;
    } else {
      // Default execution using the usage example
      return artifact.usage;
    }
  }

  /**
   * Generate sample data for data artifacts
   */
  private generateSampleData(_request: string): any[] {
    // Simple sample data generation - could be enhanced
    return [
      { col1: 1, col2: 2 },
      { col1: 3, col2: 4 },
      { col1: 5, col2: 6 }
    ];
  }

  /**
   * Handle natural language artifact commands
   */
  async handleArtifactCommand(request: string): Promise<string | null> {
    const lowerRequest = request.toLowerCase();
    logger.debug('orchestrator', 'Checking for artifact command', { request: lowerRequest });
    
    // Save commands - simpler parsing approach
    if (lowerRequest.includes('save') && lowerRequest.includes('keel://')) {
      logger.debug('orchestrator', 'Detected save command with keel:// path');
      // Find keel:// path in the request
      const pathMatch = request.match(/(keel:\/\/\S+)/);
      if (pathMatch) {
        const path = pathMatch[1];
        logger.debug('orchestrator', 'Found path', { path });
        // Extract content after the path (after colon)
        const pathIndex = request.indexOf(path);
        const pathEnd = pathIndex + path.length;
        const colonIndex = request.indexOf(':', pathEnd);
        let content = '';
        
        if (colonIndex > -1) {
          content = request.substring(colonIndex + 1).trim();
          logger.debug('orchestrator', 'Extracted content from after colon', { content });
        } else {
          // Alternative: extract content between "as" and the path
          const asIndex = lowerRequest.lastIndexOf(' as ');
          if (asIndex > -1 && asIndex < pathIndex) {
            content = request.substring(asIndex + 4, pathIndex).trim();
            logger.debug('orchestrator', 'Extracted content from before path', { content });
          }
        }
        
        if (content) {
          try {
            await storage.writeFile(path, content);
            logger.info('orchestrator', 'Saved content via natural language', { path });
            return `Successfully saved to ${path}`;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('orchestrator', 'Failed to save via natural language', { path, error: errorMessage });
            return `Error saving to ${path}: ${errorMessage}`;
          }
        }
      }
    }
    
    // Write commands
    if (lowerRequest.includes('write') && lowerRequest.includes('keel://')) {
      const pathMatch = request.match(/(keel:\/\/\S+)/);
      if (pathMatch) {
        const path = pathMatch[1];
        // Extract content before the path
        const pathIndex = request.indexOf(path);
        const writeIndex = lowerRequest.indexOf('write');
        let content = request.substring(writeIndex + 5, pathIndex).trim();
        
        // Remove "this to" or "to" if present
        content = content.replace(/^this\s+to\s+/i, '').replace(/^to\s+/i, '');
        
        if (content) {
          try {
            await storage.writeFile(path, content);
            logger.info('orchestrator', 'Wrote content via natural language', { path });
            return `Successfully wrote to ${path}`;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('orchestrator', 'Failed to write via natural language', { path, error: errorMessage });
            return `Error writing to ${path}: ${errorMessage}`;
          }
        }
      }
    }
    
    // Delete commands
    const deleteMatch = request.match(/delete(?:\s+the)?\s+(?:file\s+)?(keel:\/\/\S+)/i);
    if (deleteMatch) {
      const path = deleteMatch[1];
      try {
        const deleted = await storage.deleteFile(path);
        if (deleted) {
          logger.info('orchestrator', 'Deleted file via natural language', { path });
          return `Successfully deleted ${path}`;
        } else {
          return `File not found: ${path}`;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('orchestrator', 'Failed to delete via natural language', { path, error: errorMessage });
        return `Error deleting ${path}: ${errorMessage}`;
      }
    }
    
    // Read commands
    const readMatch = request.match(/read(?:\s+the)?\s+(?:file\s+)?(keel:\/\/\S+)/i);
    if (readMatch) {
      const path = readMatch[1];
      try {
        const content = await storage.readFile(path);
        if (content === null) {
          return `File not found: ${path}`;
        }
        logger.info('orchestrator', 'Read file via natural language', { path });
        return content;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('orchestrator', 'Failed to read via natural language', { path, error: errorMessage });
        return `Error reading ${path}: ${errorMessage}`;
      }
    }
    
    // List commands
    if (lowerRequest.includes('list') && lowerRequest.includes('keel://')) {
      const pathMatch = request.match(/keel:\/\/(\S*?)(?:\s|$)/i);
      const prefix = pathMatch ? `keel://${pathMatch[1]}` : 'keel://';
      try {
        const files = await storage.listFiles(prefix);
        logger.info('orchestrator', 'Listed files via natural language', { prefix });
        return files.length > 0 ? files.join('\n') : `No files found in ${prefix}`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('orchestrator', 'Failed to list via natural language', { prefix, error: errorMessage });
        return `Error listing files in ${prefix}: ${errorMessage}`;
      }
    }
    
    logger.debug('orchestrator', 'No artifact command detected', { request: lowerRequest });
    return null;
  }

  // Legacy methods for compatibility
  async executeTool(toolName: string, args: Record<string, unknown>, _onUpdate: (response: AgentResponse) => void): Promise<string> {
    logger.info('orchestrator', 'Executing tool', { toolName, args });
    
    // Handle VFS operations directly
    if (toolName === 'vfs_write') {
      const { path, content, l0, l1 } = args as { path?: string; content?: string; l0?: string; l1?: string };
      if (!path || !content) {
        return 'Error: vfs_write requires path and content parameters';
      }
      try {
        await storage.writeFile(path, content, l0, l1);
        logger.info('orchestrator', 'File written to VFS', { path });
        return `Successfully wrote to ${path}`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('orchestrator', 'Failed to write file', { path, error: errorMessage });
        return `Error writing file: ${errorMessage}`;
      }
    }
    
    if (toolName === 'vfs_read') {
      const { path, level = 'L2' } = args as { path?: string; level?: 'L0' | 'L1' | 'L2' };
      if (!path) {
        return 'Error: vfs_read requires path parameter';
      }
      try {
        const content = await storage.readFile(path, level);
        if (content === null) {
          return `File not found: ${path}`;
        }
        logger.info('orchestrator', 'File read from VFS', { path, level });
        return content;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('orchestrator', 'Failed to read file', { path, error: errorMessage });
        return `Error reading file: ${errorMessage}`;
      }
    }
    
    if (toolName === 'vfs_ls') {
      const { prefix = 'keel://' } = args as { prefix?: string };
      try {
        const files = await storage.listFiles(prefix);
        logger.info('orchestrator', 'Listed VFS files', { prefix, count: files.length });
        return files.length > 0 ? files.join('\n') : `No files found with prefix: ${prefix}`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('orchestrator', 'Failed to list files', { prefix, error: errorMessage });
        return `Error listing files: ${errorMessage}`;
      }
    }
    
    // Map other tool names to skills
    const skillMapping: Record<string, string> = {
      'web_fetch': 'research',
      'execute_python': 'python-coding',
      'memory_update': 'execution-analyzer'
    };
    
    const skillName = skillMapping[toolName] || 'python-coding';
    
    // Convert legacy tool parameters to skill task parameter
    let task = '';
    if (toolName === 'web_fetch' && args.url) {
      task = `Fetch content from: ${args.url}`;
    } else if (toolName === 'execute_python' && args.code) {
      task = `Execute Python code: ${args.code}`;
    } else if (toolName === 'memory_update' && args.category && args.content) {
      task = `Update memory ${args.category}: ${args.content}`;
    } else {
      task = `Execute ${toolName} with parameters: ${JSON.stringify(args)}`;
    }
    
    return await this.executeSkillMethod(skillName, { task });
  }
}
