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
          } else {
              toolResult = await this.executeTool(toolCall.name, toolCall.args, onUpdate);
          }
          this.chatHistory.push({ role: "assistant", content: `[System Observation] Tool ${toolCall?.name} result: ${toolResult}` });
      }

      // Always run Observer after any agent action or tool call
      const observer = PERSONAS["observer"];
      const observerPrompt = await getSystemContext(observer);
      const observerTask = `Analyze the last action by ${persona.name} and the tool result: ${toolResult}. Provide a concise observation for the Manager.`;

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
      if (nextAgentId === "coder" && !toolCall?.name?.includes("delegate")) {
          // If coder just finished and didn't delegate yet, we might want to force Reviewer
          // But our new design prefers Manager control.
          // However, the prompt says "Reviewer should always run after coder".
          nextAgentId = "reviewer";
          nextAgentInstruction = "Review the code written by the Coder.";
      } else if (nextAgentId !== "manager" && !toolCall?.name) {
          // If an agent finished without tool call, return to manager
          nextAgentId = "manager";
      } else if (toolCall?.name === "delegate") {
          // nextAgentId is already set above
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
                      } else if (out.type === 'table' || out.type === 'chart') {
                          onUpdate({ personaId: "python", content: `[Displaying ${out.type}]`, type: out.type, data: out.type === 'table' ? out.data : out.spec });
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
