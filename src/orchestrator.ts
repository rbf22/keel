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
    let currentPlan = "";

    this.chatHistory.push({ role: "user", content: userRequest });

    while (!taskComplete && loopCount < this.maxLoops) {
      loopCount++;
      logger.info("orchestrator", `Loop ${loopCount} starting`);

      // 1. Manager - Plan and Delegate
      const manager = PERSONAS["manager"];
      const managerPrompt = await getSystemContext(manager);
      const managerActionPrompt = `Current User Request: "${userRequest}"
Current Plan: ${currentPlan || "None yet. Create one."}

Decide the next step.
- If no plan exists, write a plan first.
- Call an agent: ${activePersonaIds.join(", ")}
- Or use a tool directly.
- Or FINISH if task is complete.`;

      let managerDecision = "";
      await this.engine.generate(managerActionPrompt, {
        onToken: (text) => {
          managerDecision = text;
          onUpdate({ personaId: "manager", content: text });
        },
        history: this.chatHistory,
        systemOverride: managerPrompt
      });

      this.chatHistory.push({ role: "assistant", content: `[Manager] ${managerDecision}` });

      if (managerDecision.includes("FINISH")) {
        taskComplete = true;
        // Final memory extraction could happen here
        break;
      }

      // Check for Tool Calls from Manager
      const toolCall = this.parseToolCall(managerDecision);
      if (toolCall) {
          const result = await this.executeTool(toolCall.name, toolCall.args, onUpdate);
          this.chatHistory.push({ role: "assistant", content: `[System Observation] Tool ${toolCall.name} returned: ${result}` });
          onUpdate({ personaId: "observer", content: `Observed ${toolCall.name} result: ${result}`, type: "observation" });
          continue;
      }

      // 2. Delegate to Agent
      let delegatedPersonaId = "";
      for (const id of activePersonaIds) {
        if (managerDecision.toLowerCase().includes(id)) {
          delegatedPersonaId = id;
          break;
        }
      }

      if (!delegatedPersonaId) {
        logger.warn("orchestrator", "Manager didn't pick a clear agent, continuing loop");
        continue;
      }

      const persona = PERSONAS[delegatedPersonaId];
      const personaPrompt = await getSystemContext(persona);
      const taskPrompt = `Current Task: ${userRequest}
Your instruction from Manager: ${managerDecision}

Perform your task and call tools if necessary.`;

      let agentContent = "";
      await this.engine.generate(taskPrompt, {
        onToken: (text) => {
          agentContent = text;
          onUpdate({ personaId: delegatedPersonaId, content: text });
        },
        history: this.chatHistory,
        systemOverride: personaPrompt
      });

      this.chatHistory.push({ role: "assistant", content: `[${persona.name}] ${agentContent}` });

      // Handle Agent Tool Calls
      const agentToolCall = this.parseToolCall(agentContent);
      if (agentToolCall) {
          const result = await this.executeTool(agentToolCall.name, agentToolCall.args, onUpdate);
          this.chatHistory.push({ role: "assistant", content: `[Observation for ${persona.name}] Tool ${agentToolCall.name} result: ${result}` });
          onUpdate({ personaId: "observer", content: `Observed ${persona.name}'s use of ${agentToolCall.name}: ${result}`, type: "observation" });
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
