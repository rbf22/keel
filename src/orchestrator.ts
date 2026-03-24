import { LLMEngine } from "./llm";
import { PERSONAS } from "./personas";
import { storage, MemoryCategory } from "./storage";
import { logger } from "./logger";
import { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import { PythonRuntime } from "./python-runtime";
import { getSystemContext } from "./tools";

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

  constructor(engine: LLMEngine, python: PythonRuntime) {
    this.engine = engine;
    this.python = python;
  }

  async runTask(userRequest: string, onUpdate: (response: AgentResponse) => void, activePersonaIds: string[] = ["researcher", "coder", "reviewer", "slide_writer", "observer"]) {
    logger.info("orchestrator", "Starting complex task with tools", { userRequest, activePersonaIds });
    this.chatHistory = [];

    let loopCount = 0;
    let taskComplete = false;

    this.chatHistory.push({ role: "user", content: userRequest });

    let nextAgentId = "manager";
    let nextAgentInstruction = userRequest;

    while (!taskComplete && loopCount < this.maxLoops) {
      loopCount++;
      logger.info("orchestrator", `Loop ${loopCount} starting with agent: ${nextAgentId}`);

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

      let agentContent = "";
      await this.engine.generate(taskPrompt, {
        onToken: (text) => {
          agentContent = text;
          onUpdate({ personaId: nextAgentId, content: text });
        },
        history: this.chatHistory,
        systemOverride: personaPrompt
      });

      this.chatHistory.push({ role: "assistant", content: `[${persona.name}] ${agentContent}` });

      if (agentContent.includes("FINISH") && nextAgentId === "manager") {
        taskComplete = true;
        break;
      }

      // 3. Automated Observation & Tool Handling
      const toolCall = this.parseToolCall(agentContent);
      let toolResult = "";
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
                  // Real web fetch might be blocked by CORS in browser, using a proxy or placeholder
                  onUpdate({ personaId: "system", content: `Fetching ${args.url}...` });
                  const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(args.url)}`);
                  const data = await response.json();
                  return data.contents.substring(0, 5000); // Truncate for context
              case "execute_python":
                  let pyOutput = "";
                  const originalOnOutput = this.python.onOutput;
                  this.python.onOutput = (out) => {
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
                  await this.python.execute(args.code);
                  this.python.onOutput = originalOnOutput;
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
