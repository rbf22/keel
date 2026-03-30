import { LLMEngine } from "./llm";
import { PERSONAS } from "./personas";
import { storage, MemoryCategory } from "./storage";
import { logger } from "./logger";
import { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import { PythonRuntime } from "./python-runtime";
import { getSystemContext } from "./tools";
import { skillsEngine } from "./skills/engine";
import { SecureWebFetcher } from "./utils/secure-web-fetcher";

export interface AgentResponse {
  personaId: string;
  content: string;
  type?: 'text' | 'table' | 'chart' | 'error' | 'plan' | 'observation';
  data?: any;
}

export class AgentOrchestrator {
  private engine: LLMEngine;
  private python: PythonRuntime;
  private chatHistory: ChatCompletionMessageParam[] = [];
  private maxLoops = 15;
  private pendingToolCall: { name: string, args: any } | null = null;
  
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
  private hashState(agentId: string, instruction: string): string {
    // Get last 3 messages from history for context
    const recentContent = this.chatHistory.slice(-3).map(m => m.content).join('');
    const stateString = `${agentId}|${instruction}|${recentContent}`;
    
    // Simple hash function (could be improved with crypto.subtle if needed)
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
    if (this.agentSequence.length < 4) return false;
    
    // Get the last 4 agent IDs
    const recentSequence = this.agentSequence.slice(-4).join(',');
    
    // Check if this exact sequence appeared before (excluding the current occurrence)
    const previousIndex = this.agentSequence.lastIndexOf(
      recentSequence, 
      this.agentSequence.length - 5 // Look before the current sequence
    );
    
    return previousIndex > -1;
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

  async runTask(userRequest: string, onUpdate: (response: AgentResponse) => void, activePersonaIds: string[] = ["researcher", "coder", "reviewer", "slide_writer", "observer"]) {
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
      
      // Enhanced loop detection with state hashing and cycle detection
      const currentStateHash = this.hashState(nextAgentId, nextAgentInstruction);
      
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

      // Small delay between agent turns to ensure WebLLM state is settled
      await new Promise(resolve => setTimeout(resolve, 500));

      if (nextAgentId === "reviewer" && nextAgentInstruction.includes("Review the Python code")) {
        // Find the last Python code block in chat history to provide better context
        const lastCoderMessage = [...this.chatHistory].reverse().find(m => m.role === "assistant" && typeof m.content === 'string' && m.content.includes("```python"));
        if (lastCoderMessage && typeof lastCoderMessage.content === 'string') {
            nextAgentInstruction += `\n\nCode to review:\n${lastCoderMessage.content}`;
        }
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
          } catch (error: any) {
            toolResult += `Error executing skill ${skillCall.name}: ${error.message}\n`;
          }
        }
        this.chatHistory.push({ role: "assistant", content: `[System Observation] Skill execution result: ${toolResult}` });
      }
      
      if (toolCall) {
          if (toolCall.name === "delegate") {
              nextAgentId = toolCall.args.agent;
              nextAgentInstruction = toolCall.args.instruction;
              toolResult = `Delegated to ${nextAgentId} with instructions: ${nextAgentInstruction}`;
          } else if (toolCall.name === "execute_python" && nextAgentId !== "reviewer") {
              // Intercept execute_python if it's not from a reviewer (usually coder)
              // Force delegation to Reviewer first
              this.pendingToolCall = toolCall;
              nextAgentId = "reviewer";
              nextAgentInstruction = `Review the Python code below and the planned execution. If it looks correct and safe, say "APPROVED" to allow execution. If not, provide fixes.\n\nCode:\n${toolCall.args.code}`;
              toolResult = `Execution pending. Delegated to Reviewer for approval.`;
              this.chatHistory.push({ role: "assistant", content: `[System Observation] ${toolResult}` });
          } else {
              toolResult = await this.executeTool(toolCall.name, toolCall.args, onUpdate);
              this.chatHistory.push({ role: "assistant", content: `[System Observation] Tool ${toolCall?.name} result: ${toolResult}` });
          }
      }

      // Always run Observer after any agent action or tool call
      const observer = PERSONAS["observer"];
      const observerPrompt = await getSystemContext(observer);
      const observerTask = `Analyze the last action by ${persona.name} and the tool result: ${toolResult}.
Also consider any recent Python execution outputs: ${toolResult.includes("Table") || toolResult.includes("Chart") ? "Outputs contain rich data." : ""}
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
      if (persona.id === "reviewer") {
          if (agentContent.includes("APPROVED") && this.pendingToolCall) {
              // If Reviewer approves, execute the pending tool call
              try {
                  toolResult = await this.executeTool(this.pendingToolCall.name, this.pendingToolCall.args, onUpdate);
                  this.chatHistory.push({ role: "assistant", content: `[System Observation] Execution Result (Approved): ${toolResult}` });
                  this.pendingToolCall = null;
                  // After execution, return to manager
                  nextAgentId = "manager";
              } catch (e: any) {
                  logger.error("orchestrator", "Failed to execute pending tool call after approval", { error: e });
                  toolResult = `Error executing approved code: ${e.message}`;
                  this.chatHistory.push({ role: "assistant", content: `[System Observation] ${toolResult}` });
                  this.pendingToolCall = null;
              }
          } else {
              // Not approved, send back to coder
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

  private parseToolCall(text: string): { name: string, args: any } | null {
    const callMatch = text.match(/CALL:\s*(\w+)/);
    const argsMatch = text.match(/ARGUMENTS:\s*(\{[\s\S]*?\})/);

    if (callMatch && argsMatch) {
        try {
            return {
                name: callMatch[1],
                args: JSON.parse(argsMatch[1])
            };
        } catch (e) {
            logger.error("orchestrator", "Failed to parse tool arguments", { error: e, text: argsMatch[1] });
        }
    }
    return null;
  }

  private async executeTool(name: string, args: any, onUpdate: (response: AgentResponse) => void): Promise<string> {
      logger.info("orchestrator", `Executing tool: ${name}`, args);
      try {
          switch (name) {
              case "vfs_write":
                  await storage.writeFile(args.path, args.content, args.l0, args.l1);
                  return `Successfully wrote to ${args.path}`;
              case "vfs_read":
                  const content = await storage.readFile(args.path, args.level);
                  return content || "File not found.";
              case "vfs_ls":
                  const files = await storage.listFiles(args.prefix);
                  return files.join(", ") || "No files found.";
              case "memory_update":
                  await storage.addMemory(args.category as MemoryCategory, args.content, args.tags);
                  return "Memory updated.";
              case "web_fetch":
                  // Use secure web fetcher with security measures
                  onUpdate({ personaId: "system", content: `Fetching ${args.url}...` });
                  
                  try {
                      const content = await SecureWebFetcher.fetch(args.url, {
                          timeout: 10000,
                          maxSize: 5000,
                          sanitizeContent: true
                      });
                      
                      logger.info("orchestrator", `Successfully fetched via secure fetcher`, {
                          url: args.url,
                          contentLength: content.length
                      });
                      
                      return content;
                  } catch (error: any) {
                      logger.error("orchestrator", "Secure web fetch failed", {
                          url: args.url,
                          error: error.message
                      });
                      return `Failed to fetch content: ${error.message}`;
                  }
              case "execute_python":
                  let pyOutput = "";
                  
                  // Create a handler that captures output and sends updates
                  const outputHandler = (out: any) => {
                      if (out.type === 'log' || out.type === 'error') {
                          pyOutput += (out.message + "\n");
                          onUpdate({ personaId: "python", content: out.message || "", type: out.type === 'error' ? 'error' : 'text' });
                      } else if (out.type === 'table') {
                          const columns = out.data?.[0] ? Object.keys(out.data[0]).join(", ") : "none";
                          const tableSummary = `[Data Table Output: ${out.data?.length || 0} rows, Columns: ${columns}]`;
                          pyOutput += tableSummary + "\n";
                          onUpdate({ personaId: "python", content: tableSummary, type: "table", data: out.data });
                      } else if (out.type === 'chart') {
                          const chartSummary = `[Vega-Lite Chart Output: ${JSON.stringify(out.spec).substring(0, 200)}...]`;
                          pyOutput += chartSummary + "\n";
                          onUpdate({ personaId: "python", content: chartSummary, type: "chart", data: out.spec });
                      }
                  };
                  
                  // Push handler, execute, then restore
                  this.python.onOutput = outputHandler;
                  try {
                      await this.python.execute(args.code);
                  } finally {
                      this.python.restoreHandler();
                  }
                  return pyOutput || "Code executed successfully.";
              default:
                  return `Unknown tool: ${name}`;
          }
      } catch (err: any) {
          logger.error("orchestrator", `Tool execution failed: ${name}`, { error: err });
          return `Error: ${err.message}`;
      }
  }
}
