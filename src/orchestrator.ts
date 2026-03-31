import { LLMEngine } from "./llm";
import { PERSONAS } from "./personas";
import { storage } from "./storage";
import { logger } from "./logger";
import { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import { PythonRuntime } from "./python-runtime";
import { getSystemContext } from "./tools";
import { skillsEngine } from "./skills/engine";
import { SecureWebFetcher } from "./utils/secure-web-fetcher";
import { AgentResponse, ToolCall, PendingPythonExecution, MemoryCategory, PythonOutput } from "./types";

export class AgentOrchestrator {
  private engine: LLMEngine;
  private python: PythonRuntime;
  private chatHistory: ChatCompletionMessageParam[] = [];
  private maxLoops = 15;
  private pendingToolCall: PendingPythonExecution | null = null;
  private isExecutingPendingTool: boolean = false; // Track if we're currently executing a pending tool
  
  // Hashing and loop detection config
  private readonly stateHashContextLimit = 3; // Number of history messages to include in state hash
  
  // Enhanced loop detection state
  private agentSequence: string[] = [];
  private stateHashes: string[] = [];
  private readonly maxSequenceLength = 10;
  private readonly maxStateHashes = 20;

  constructor(engine: LLMEngine, python: PythonRuntime) {
    this.engine = engine;
    this.python = python;
  }
  
  /**
   * Generate a hash of current state to detect repeating patterns
   */
  private async hashState(agentId: string, instruction: string): Promise<string> {
    // Get last N messages from history for context
    const recentContent = this.chatHistory.slice(-this.stateHashContextLimit).map(m => m.content).join('');
    const stateString = `${agentId}|${instruction}|${recentContent}`;
    
    // Use Web Crypto API for stronger hashing if available
    if (crypto.subtle) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(stateString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
      } catch (error) {
        // Fallback to simple hash if crypto fails
        logger.warn('orchestrator', 'Crypto hash failed, using fallback', { error });
      }
    }
    
    // Fallback to simple hash function
    let hash = 0;
    for (let i = 0; i < stateString.length; i++) {
      const char = stateString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }
  
  /**
   * Detect if we're in a repeating agent cycle
   */
  private detectAgentCycle(): boolean {
    if (this.agentSequence.length < 6) return false; // Need at least some repetition
    
    // Try to find cycles of different lengths (2-4 agents)
    for (let cycleLength = 2; cycleLength <= 4; cycleLength++) {
      if (this.agentSequence.length < cycleLength * 2) continue;
      
      // Get the last cycleLength agents
      const recentIds = this.agentSequence.slice(-cycleLength);
      
      // Look for this sequence earlier in the array
      for (let i = 0; i <= this.agentSequence.length - (cycleLength * 2); i++) {
        const candidateSequence = this.agentSequence.slice(i, i + cycleLength);
        
        // Check if sequences match exactly
        if (candidateSequence.length === recentIds.length &&
            candidateSequence.every((id, index) => id === recentIds[index])) {
          // Found a matching sequence that's not overlapping
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Detect if we've seen this exact state before
   */
  private detectStateRepetition(currentHash: string): boolean {
    return this.stateHashes.includes(currentHash);
  }
  
  /**
   * Reset loop detection state (call when task completes or resets)
   */
  private resetLoopDetection(): void {
    this.agentSequence = [];
    this.stateHashes = [];
  }

  async runTask(userRequest: string, onUpdate: (response: AgentResponse) => void, activePersonaIds: string[] = ["researcher", "coder", "reviewer", "observer"]) {
    logger.info("orchestrator", "Starting complex task with tools", { userRequest, activePersonaIds });
    
    // Reset loop detection state for fresh task
    this.resetLoopDetection();
    this.chatHistory = [];

    let loopCount = 0;
    let taskComplete = false;
    let lastAgentId = "";
    let noProgressCount = 0;

    this.chatHistory.push({ role: "user", content: userRequest });

    let nextAgentId = "manager";
    let nextAgentInstruction = userRequest;

    while (!taskComplete && loopCount < this.maxLoops) {
      loopCount++;
      logger.info("orchestrator", `Loop ${loopCount} starting with agent: ${nextAgentId}`);
      
      // Handle reviewer code injection before state hashing
      if (nextAgentId === "reviewer" && nextAgentInstruction.includes("Review the Python code")) {
        // Find the last Python code block in chat history to provide better context
        const lastCoderMessage = [...this.chatHistory].reverse().find(m => m.role === "assistant" && typeof m.content === 'string' && m.content.includes("```python"));
        if (lastCoderMessage && typeof lastCoderMessage.content === 'string') {
            nextAgentInstruction += `\n\nCode to review:\n${lastCoderMessage.content}`;
        }
      }

      // Enhanced loop detection with state hashing and cycle detection
      const currentStateHash = await this.hashState(nextAgentId, nextAgentInstruction);
      
      // Check for exact state repetition
      if (this.detectStateRepetition(currentStateHash)) {
        logger.warn("orchestrator", "Detected exact state repetition, terminating task", {
          loopCount,
          agentId: nextAgentId,
          stateHash: currentStateHash
        });
        onUpdate({ 
          personaId: "system", 
          content: "Task appears to be repeating the same steps. Terminating to prevent infinite execution.", 
          type: "error" 
        });
        break;
      }
      
      // Track state hash (with limit to prevent memory growth)
      this.stateHashes.push(currentStateHash);
      if (this.stateHashes.length > this.maxStateHashes) {
        this.stateHashes.shift();
      }
      
      // Track agent sequence
      this.agentSequence.push(nextAgentId);
      if (this.agentSequence.length > this.maxSequenceLength) {
        this.agentSequence.shift();
      }
      
      // Check for repeating agent cycles
      if (this.detectAgentCycle()) {
        logger.warn("orchestrator", "Detected repeating agent cycle, terminating task", {
          loopCount,
          sequence: this.agentSequence.slice(-4).join(' -> ')
        });
        onUpdate({ 
          personaId: "system", 
          content: `Detected repeating agent pattern (${this.agentSequence.slice(-4).join(' -> ')}). Terminating to prevent infinite loop.`, 
          type: "error" 
        });
        break;
      }
      
      // Legacy simple loop detection (kept for compatibility)
      if (nextAgentId === lastAgentId) {
        noProgressCount++;
        if (noProgressCount > 3) {
          onUpdate({ 
            personaId: "system", 
            content: "Task appears to be stuck with the same agent. Terminating to prevent infinite execution.", 
            type: "error" 
          });
          break;
        }
      } else {
        noProgressCount = 0;
        lastAgentId = nextAgentId;
      }

      const persona = PERSONAS[nextAgentId];
      const personaPrompt = await getSystemContext(persona);
      const taskPrompt = nextAgentId === "manager"
        ? `Current User Request: "${userRequest}"
Decide the next step. Use 'delegate' to call an agent, or 'FINISH' if complete.`
        : `Your instruction: ${nextAgentInstruction}`;

      // Add skills context to system prompt
      const skillsContext = skillsEngine.getSkillsDescription();
      const enhancedPersonaPrompt = personaPrompt + `\n\nAvailable Skills:\n${skillsContext}\n\nWhen you need to use a skill, format it as: <skill name="skillName">{"param": "value"}</skill>`;
      
      let agentContent = "";
      await this.engine.generate(taskPrompt, {
        onToken: (text) => {
          agentContent = text;
          onUpdate({ personaId: nextAgentId, content: text });
        },
        history: this.chatHistory,
        systemOverride: enhancedPersonaPrompt
      });

      this.chatHistory.push({ role: "assistant", content: `[${persona.name}] ${agentContent}` });

      if (agentContent.includes("FINISH") && nextAgentId === "manager") {
        taskComplete = true;
        break;
      }

      // 3. Automated Observation & Tool Handling
      const toolCall = this.parseToolCall(agentContent);
      const skillCalls = skillsEngine.parseSkillCalls(agentContent);
      let toolResult = "";
      
      // Handle skill calls
      if (skillCalls.length > 0) {
        for (const skillCall of skillCalls) {
          try {
            const result = await skillsEngine.executeSkill(
              skillCall.name, 
              skillCall.params, 
              { pythonRuntime: this.python }
            );
            
            if (result.success) {
              toolResult += `Skill ${skillCall.name} executed successfully.\n`;
              if (result.output) {
                toolResult += `Output: ${result.output}\n`;
              }
            } else {
              toolResult += `Skill ${skillCall.name} failed: ${result.error}\n`;
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            toolResult += `Error executing skill ${skillCall.name}: ${errorMessage}\n`;
          }
        }
        this.chatHistory.push({ role: "assistant", content: `[System Observation] Skill execution result: ${toolResult}` });
      }
      
      if (toolCall) {
          if (toolCall.name === "delegate") {
              nextAgentId = toolCall.args.agent as string;
              nextAgentInstruction = toolCall.args.instruction as string;
              toolResult = `Delegated to ${nextAgentId} with instructions: ${nextAgentInstruction}`;
          } else if (toolCall.name === "execute_python" && nextAgentId !== "reviewer") {
              // Intercept execute_python if it's not from a reviewer (usually coder)
              // Force delegation to Reviewer first
              // Validate that this is a proper Python execution call
              if (toolCall.name === "execute_python" && typeof toolCall.args?.code === "string") {
                  // Check if we're already executing a pending tool to prevent reentrancy
                  if (this.isExecutingPendingTool) {
                      toolResult = "Cannot execute Python code while another execution is in progress.";
                      this.chatHistory.push({ role: "assistant", content: `[System Observation] ${toolResult}` });
                  } else {
                      this.pendingToolCall = toolCall as PendingPythonExecution;
                      nextAgentId = "reviewer";
                      nextAgentInstruction = `Review the Python code below and the planned execution. If it looks correct and safe, say "APPROVED" to allow execution. If not, provide fixes.\n\nCode:\n${toolCall.args.code}`;
                      toolResult = `Execution pending. Delegated to Reviewer for approval.`;
                      this.chatHistory.push({ role: "assistant", content: `[System Observation] ${toolResult}` });
                  }
              } else {
                  toolResult = await this.executeTool(toolCall.name, toolCall.args, onUpdate);
                  this.chatHistory.push({ role: "assistant", content: `[System Observation] Tool ${toolCall?.name} result: ${toolResult}` });
              }
          } else {
              toolResult = await this.executeTool(toolCall.name, toolCall.args, onUpdate);
              this.chatHistory.push({ role: "assistant", content: `[System Observation] Tool ${toolCall?.name} result: ${toolResult}` });
          }
      }

      // Always run Observer after any agent action or tool call
      const observer = PERSONAS["observer"];
      const observerPrompt = await getSystemContext(observer);
      const observerTask = `Analyze the last action by ${persona.name} and the tool result: ${toolResult}.
Provide a concise observation for the Manager.`;

      let observation = "";
      await this.engine.generate(observerTask, {
        onToken: (text) => {
          observation = text;
          onUpdate({ personaId: "observer", content: text, type: "observation" });
        },
        history: this.chatHistory,
        systemOverride: observerPrompt
      });
      this.chatHistory.push({ role: "assistant", content: `[Observer] ${observation}` });

      // Post-agent logic (Reviewer automation, etc.)
      // Always clear pending tool call when reviewer responds
      if (persona.id === "reviewer") {
          if (agentContent.includes("APPROVED") && this.pendingToolCall && !this.isExecutingPendingTool) {
              // If Reviewer approves, execute the pending tool call
              const currentPendingCall = this.pendingToolCall; // Capture before clearing
              this.pendingToolCall = null; // Clear immediately to prevent re-execution
              this.isExecutingPendingTool = true; // Set execution flag
              
              try {
                  toolResult = await this.executeTool(currentPendingCall.name, currentPendingCall.args, onUpdate);
                  this.chatHistory.push({ role: "assistant", content: `[System Observation] Execution Result (Approved): ${toolResult}` });
                  // After execution, return to manager
                  nextAgentId = "manager";
              } catch (e: unknown) {
                  const errorMessage = e instanceof Error ? e.message : 'Unknown error';
                  logger.error('orchestrator', 'Failed to execute pending tool call after approval', { error: errorMessage });
                  toolResult = `Error executing approved code: ${errorMessage}`;
                  this.chatHistory.push({ role: "assistant", content: `[System Observation] ${toolResult}` });
              } finally {
                  this.isExecutingPendingTool = false; // Clear execution flag
              }
          } else {
              // Not approved, send back to coder
              this.pendingToolCall = null; // Clear pending call
              this.isExecutingPendingTool = false; // Clear execution flag if set
              nextAgentId = "coder";
              nextAgentInstruction = `The Reviewer found issues with your code. Please fix them:\n\n${agentContent}`;
          }
      } else if (nextAgentId === "coder" && !toolCall?.name?.includes("delegate") && !toolCall?.name?.includes("execute_python")) {
          // If coder just finished and didn't delegate yet, we might want to force Reviewer
          nextAgentId = "reviewer";
          nextAgentInstruction = "Review the work written by the Coder.";
      } else if (nextAgentId !== "manager" && !toolCall?.name) {
          // If an agent finished without tool call, return to manager
          nextAgentId = "manager";
      } else if (toolCall?.name === "delegate" || (toolCall?.name === "execute_python" && persona.id === "coder")) {
          // nextAgentId is already set above for delegation or intercepted execution
      } else {
          // Default back to manager to decide next step
          nextAgentId = "manager";
      }
    }

    return this.chatHistory;
  }

  private parseToolCall(text: string): ToolCall | null {
    const callMatch = text.match(/CALL:\s*(\w+)/);
    const argsMatch = text.match(/ARGUMENTS:\s*(\{[\s\S]*?\})/);

    if (callMatch && argsMatch) {
        try {
            const toolCall: ToolCall = {
                name: callMatch[1],
                args: JSON.parse(argsMatch[1]) as Record<string, unknown>
            };
            return toolCall;
        } catch (e) {
            logger.error("orchestrator", "Failed to parse tool arguments", { error: e, text: argsMatch[1] });
        }
    }
    return null;
  }

  private async executeTool(name: string, args: Record<string, unknown>, onUpdate: (response: AgentResponse) => void): Promise<string> {
      logger.info("orchestrator", `Executing tool: ${name}`, args);
      try {
          switch (name) {
              case "vfs_write":
                  await storage.writeFile(args.path as string, args.content as string, args.l0 as string, args.l1 as string);
                  return `Successfully wrote to ${args.path as string}`;
              case "vfs_read":
                  const content = await storage.readFile(args.path as string, args.level as "L0" | "L1" | "L2" | undefined);
                  return content || "File not found.";
              case "vfs_ls":
                  const files = await storage.listFiles(args.prefix as string | undefined);
                  return files.join(", ") || "No files found.";
              case "memory_update":
                  await storage.addMemory(args.category as MemoryCategory, args.content as string, args.tags as string[]);
                  return "Memory updated.";
              case "web_fetch":
                  // Use secure web fetcher with security measures
                  onUpdate({ personaId: "system", content: `Fetching ${args.url as string}...` });
                  
                  try {
                      const content = await SecureWebFetcher.fetch(args.url as string, {
                          timeout: 10000,
                          maxSize: 5000,
                          sanitizeContent: true
                      });
                      
                      logger.info("orchestrator", `Successfully fetched via secure fetcher`, {
                          url: args.url,
                          contentLength: content.length
                      });
                      
                      return content;
                  } catch (error: unknown) {
                      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                      logger.error('orchestrator', 'Secure web fetch failed', { error: errorMessage });
                      return `Failed to fetch content: ${errorMessage}`;
                  }
              case "execute_python":
                  let pyOutput = "";
                  
                  // Create a handler that captures output and sends updates
                  const outputHandler = (out: PythonOutput) => {
                      if (out.type === 'log' || out.type === 'error') {
                          pyOutput += (out.message + "\n");
                          onUpdate({ personaId: "python", content: out.message || "", type: out.type === 'error' ? 'error' : 'text' });
                      }
                  };
                  
                  // Push handler, execute, then restore
                  this.python.onOutput = outputHandler;
                  try {
                      await this.python.execute(args.code as string);
                  } finally {
                      this.python.restoreHandler();
                  }
                  return pyOutput || "Code executed successfully.";
              default:
                  return `Unknown tool: ${name}`;
          }
      } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          logger.error('orchestrator', 'Tool execution failed', { error: errorMessage });
          return `Error: ${errorMessage}`;
      }
  }
}
