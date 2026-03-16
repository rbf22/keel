import { LLMEngine } from "./llm";
import { PERSONAS, Persona, SKILLS } from "./personas";
import { storage } from "./storage";
import { logger } from "./logger";
import { ChatCompletionMessageParam } from "@mlc-ai/web-llm";

export interface AgentResponse {
  personaId: string;
  content: string;
}

export class AgentOrchestrator {
  private engine: LLMEngine;
  private chatHistory: ChatCompletionMessageParam[] = [];

  constructor(engine: LLMEngine) {
    this.engine = engine;
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

  async runTask(userRequest: string, onUpdate: (response: AgentResponse) => void, activePersonaIds: string[] = ["researcher", "slide_writer", "reviewer"]) {
    logger.info("orchestrator", "Starting task", { userRequest, activePersonaIds });

    // 1. Manager planning
    const manager = PERSONAS["manager"];
    const managerPrompt = await this.getPersonaPrompt(manager);
    const planPrompt = `Analyze this user request and decide which specialized agents (${activePersonaIds.join(", ")}) should be involved and in what order.
Request: "${userRequest}"

Output the plan clearly.`;

    let planContent = "";
    await this.engine.generate(planPrompt, {
      onToken: (text) => {
        planContent = text;
        onUpdate({ personaId: "manager", content: text });
      },
      history: this.chatHistory,
      systemOverride: managerPrompt
    });

    this.chatHistory.push({ role: "user", content: userRequest });
    this.chatHistory.push({ role: "assistant", content: `[Plan] ${planContent}` });

    // 2. Simple Sequential Execution based on active personas
    // In a more complex system, the Manager would parse the plan and loop.

    for (const personaId of activePersonaIds) {
      const persona = PERSONAS[personaId];
      if (!persona) continue;

      logger.info("orchestrator", `Activating persona: ${personaId}`);
      const systemPrompt = await this.getPersonaPrompt(persona);

      let personaContent = "";
      const taskPrompt = personaId === "reviewer"
        ? "Review the work done so far. Is it accurate and complete?"
        : `Continue with the plan. Your task is: ${personaId}.`;

      // Future: Configure model per agent here (e.g., online for researcher, local for reviewer)
      await this.engine.generate(taskPrompt, {
        onToken: (text) => {
          personaContent = text;
          onUpdate({ personaId, content: text });
        },
        history: this.chatHistory,
        systemOverride: systemPrompt
      });

      this.chatHistory.push({ role: "assistant", content: `[${persona.name}] ${personaContent}` });

      // Store memory of the work done
      await storage.addMemory(personaId, `I completed a task: ${personaContent.substring(0, 100)}...`);
    }

    return this.chatHistory;
  }
}
