import { LLMEngine } from "./llm";
import { PERSONAS, Persona, SKILLS } from "./personas";
import { storage } from "./storage";
import { logger } from "./logger";
import { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import { PythonRuntime } from "./python-runtime";

export interface AgentResponse {
  personaId: string;
  content: string;
  type?: 'text' | 'table' | 'chart' | 'error';
  data?: any;
}

export class AgentOrchestrator {
  private engine: LLMEngine;
  private python: PythonRuntime;
  private chatHistory: ChatCompletionMessageParam[] = [];
  private maxLoops = 10;

  constructor(engine: LLMEngine, python: PythonRuntime) {
    this.engine = engine;
    this.python = python;
  }

  private async getPersonaPrompt(persona: Persona): Promise<string> {
    const skillsInstructions = persona.skills
      .map(s => SKILLS[s])
      .filter(Boolean)
      .map(s => `- ${s.name}: ${s.instructions}`)
      .join("\n");

    const memories = await storage.getMemories(persona.id);
    const recentMemories = memories.slice(-5).map(m => `- ${m.content}`).join("\n");

    return `
${persona.basePrompt}

Your Role: ${persona.role}
Your Description: ${persona.description}

Available Skills:
${skillsInstructions}

Recent Memories:
${recentMemories}

Stay in character. Focus on your specific task.
`;
  }

  async runTask(userRequest: string, onUpdate: (response: AgentResponse) => void, activePersonaIds: string[] = ["researcher", "coder", "reviewer", "slide_writer"]) {
    logger.info("orchestrator", "Starting complex task", { userRequest, activePersonaIds });
    this.chatHistory = []; // Reset history for new task

    let loopCount = 0;
    let taskComplete = false;
    let lastOutput = "";
    let lastPythonCode = "";
    let pythonApproved = false;

    // Initial user request in history
    this.chatHistory.push({ role: "user", content: userRequest });

    while (!taskComplete && loopCount < this.maxLoops) {
      loopCount++;
      logger.info("orchestrator", `Loop ${loopCount} starting`);

      // 1. Manager decides next step
      const manager = PERSONAS["manager"];
      const managerPrompt = await this.getPersonaPrompt(manager);
      const managerActionPrompt = `Next action for user request: "${userRequest}".
Current state: ${lastOutput ? "Working on it." : "Just started."}
Decide which agent to call: ${activePersonaIds.join(", ")} or say "FINISH" to summarize.
If code was just written, you MUST call the "reviewer".
If code was APPROVED, you MUST call "manager" again to trigger execution (use command: EXECUTE_PYTHON).`;

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
        break;
      }

      // Check for manual execution command from distilled manager logic
      if (managerDecision.includes("EXECUTE_PYTHON") && pythonApproved && lastPythonCode) {
          onUpdate({ personaId: "system", content: "Executing Python code..." });
          try {
            // Need to capture python logs
            let pyOutput = "";
            const originalOnOutput = this.python.onOutput;
            this.python.onOutput = (out) => {
              if (out.type === 'log' || out.type === 'error') {
                pyOutput += (out.message + "\n");
                onUpdate({
                  personaId: "python",
                  content: out.message || "",
                  type: out.type === 'error' ? 'error' : 'text'
                });
              } else if (out.type === 'table' || out.type === 'chart') {
                onUpdate({
                  personaId: "python",
                  content: `[Displaying ${out.type}]`,
                  type: out.type,
                  data: out.type === 'table' ? out.data : out.spec
                });
              }
            };

            await this.python.execute(lastPythonCode);
            this.python.onOutput = originalOnOutput;

            lastOutput = `Python Output:\n${pyOutput}`;
            this.chatHistory.push({ role: "assistant", content: `[System] ${lastOutput}` });
            pythonApproved = false; // Reset for next block
            lastPythonCode = "";
            continue;
          } catch (err: any) {
            lastOutput = `Python Error: ${err.message}`;
            this.chatHistory.push({ role: "assistant", content: `[System] ${lastOutput}` });
            pythonApproved = false;
            lastPythonCode = "";
            continue;
          }
      }

      // 2. Delegate to an agent based on Manager's decision
      // We look for agent names in the manager's text
      let delegatedPersonaId = "";
      for (const id of activePersonaIds) {
        if (managerDecision.toLowerCase().includes(id)) {
          delegatedPersonaId = id;
          break;
        }
      }

      if (!delegatedPersonaId) {
        // Default to a fallback or retry
        logger.warn("orchestrator", "Manager didn't pick a clear agent, falling back to sequential hint");
        delegatedPersonaId = activePersonaIds[0];
      }

      const persona = PERSONAS[delegatedPersonaId];
      const systemPrompt = await this.getPersonaPrompt(persona);
      const taskPrompt = `Perform your role for the current task. If you are the Reviewer, check the previous output. If you are the Coder, write the code.`;

      let agentContent = "";
      await this.engine.generate(taskPrompt, {
        onToken: (text) => {
          agentContent = text;
          onUpdate({ personaId: delegatedPersonaId, content: text });
        },
        history: this.chatHistory,
        systemOverride: systemPrompt
      });

      this.chatHistory.push({ role: "assistant", content: `[${persona.name}] ${agentContent}` });
      lastOutput = agentContent;

      const codeMatch = agentContent.match(/```python\n([\s\S]*?)```/);
      if (codeMatch) {
        lastPythonCode = codeMatch[1];
      }

      if (delegatedPersonaId === "reviewer" && agentContent.includes("APPROVED")) {
        pythonApproved = true;
      } else if (delegatedPersonaId === "reviewer") {
        pythonApproved = false;
      }

      await storage.addMemory(delegatedPersonaId, `I worked on: ${userRequest}. My output: ${agentContent.substring(0, 50)}...`);
    }

    return this.chatHistory;
  }
}
