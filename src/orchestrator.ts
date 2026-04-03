import { LLMEngine } from "./llm";
import { logger } from "./logger";
import { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import { PythonRuntime } from "./python-runtime";
import { AgentResponse } from "./types";
import { storage } from "./storage";
import { PlanExecutor } from "./plan-executor";
import { 
  CodeArtifact, 
  ReviewResult, 
  SharedContext 
} from "./orchestrator/types";
import { SkillManager } from "./orchestrator/skill-manager";
import { ArtifactHandler } from "./orchestrator/artifact-handler";
import { LoopDetector } from "./orchestrator/loop-detector";
import { VFSHandler } from "./orchestrator/vfs-handler";

export class AgentOrchestrator {
  private chatHistory: ChatCompletionMessageParam[] = [];
  private maxLoops = 15;
  private readonly maxChatHistoryLength = 50;
  
  private skillManager: SkillManager;
  private artifactHandler: ArtifactHandler;
  private loopDetector: LoopDetector;
  private vfsHandler: VFSHandler;
  private planExecutor: PlanExecutor;

  private currentArtifact: CodeArtifact | null = null;
  private sharedContext: SharedContext | null = null;

  constructor(_engine: LLMEngine, python: PythonRuntime) {
    this.skillManager = new SkillManager(python);
    this.artifactHandler = new ArtifactHandler(python, this.skillManager);
    this.loopDetector = new LoopDetector();
    this.vfsHandler = new VFSHandler();
    this.planExecutor = new PlanExecutor(python);
  }

  getCurrentSharedContext(): SharedContext | null {
    return this.sharedContext;
  }

  async runTask(userRequest: string, onUpdate: (response: AgentResponse) => void, signal?: AbortSignal): Promise<ChatCompletionMessageParam[]> {
    this.skillManager.validateInputs(userRequest, onUpdate);
    
    // 1. Handle VFS/Artifact commands first
    const vfsResult = await this.vfsHandler.handleVFSCommand(userRequest);
    if (vfsResult) return this.finalizeDirectTask(userRequest, vfsResult);

    const artifactResult = await this.artifactHandler.handleArtifactCommand(userRequest, this.sharedContext?.artifacts, this.chatHistory);
    if (artifactResult) return this.finalizeDirectTask(userRequest, artifactResult);
    
    // 2. Start full task execution
    logger.info("orchestrator", "Starting task execution", { userRequest });
    this.loopDetector.reset();
    this.chatHistory = [{ role: "user", content: userRequest }];
    
    return await this.runPlanBasedTask(userRequest, onUpdate, signal);
  }

  private finalizeDirectTask(request: string, result: string): ChatCompletionMessageParam[] {
    this.chatHistory = [
      { role: "user", content: request },
      { role: "assistant", content: result }
    ];
    return this.chatHistory;
  }

  private async runPlanBasedTask(userRequest: string, onUpdate: (response: AgentResponse) => void, signal?: AbortSignal): Promise<ChatCompletionMessageParam[]> {
    onUpdate({ personaId: "system", content: "Creating execution plan..." });

    const planningResult = await this.skillManager.executeSkill('task-planning', { task: userRequest }, this.chatHistory);
    this.chatHistory.push({ role: "assistant", content: planningResult.output });
    onUpdate({ personaId: "task-planning", content: planningResult.output });

    const plan = this.planExecutor.parsePlan(planningResult.output, userRequest);
    if (!plan) {
      logger.error("orchestrator", "Failed to parse plan, falling back to legacy");
      return await this.runLegacyTask(userRequest, onUpdate, signal);
    }

    const context = this.planExecutor.createSharedContext(plan);
    this.sharedContext = context;
    onUpdate({ personaId: "system", content: `Plan created with ${plan.subtasks.length} steps. Beginning execution.` });

    // The rest of the orchestration remains, but now skills are activated/executed spec-compliantly
    return await this.runLegacyTask(userRequest, onUpdate, signal);
  }

  // Fallback for non-plan execution
  private async runLegacyTask(userRequest: string, onUpdate: (response: AgentResponse) => void, signal?: AbortSignal): Promise<ChatCompletionMessageParam[]> {
    let loopCount = 0;
    let taskComplete = false;
    let currentSkill = await this.skillManager.selectSkill(userRequest);
    let taskInstruction = userRequest;

    while (!taskComplete && loopCount < this.maxLoops) {
      if (signal?.aborted) throw new Error("Task aborted");
      loopCount++;
      
      onUpdate({ personaId: "system", content: `Executing skill: ${currentSkill}` });

      const { output: result, needsDeepAnalysis } = await this.skillManager.executeSkill(currentSkill, { task: taskInstruction }, this.chatHistory);
      this.chatHistory.push({ role: "assistant", content: result });
      this.truncateChatHistory();
      
      onUpdate({ personaId: currentSkill, content: result });
      onUpdate({ personaId: "observer", content: await this.skillManager.analyzeExecutionResult(currentSkill, result) });
      
      if (needsDeepAnalysis) {
        const analysis = await this.skillManager.executeSkill('execution-analyzer', { 
          task: userRequest, skill_used: currentSkill, result 
        }, this.chatHistory);
        onUpdate({ personaId: "execution-analyzer", content: analysis.output });
      }

      if (result.toLowerCase().includes("task complete")) {
        taskComplete = true;
        break;
      }
      
      // Skill transition logic
      if (currentSkill === 'python-coding') {
        try {
          const artifact: CodeArtifact = JSON.parse(result);
          this.currentArtifact = artifact;
          currentSkill = 'quality-review';
          taskInstruction = `Review this code artifact: ${JSON.stringify(artifact, null, 2)}`;
        } catch (e) {
          taskComplete = true;
        }
      } else if (currentSkill === 'quality-review') {
        try {
          const review: ReviewResult = JSON.parse(result);
          if (review.approved && this.currentArtifact) {
            const res = await this.artifactHandler.executeArtifact(this.currentArtifact, userRequest, this.chatHistory);
            onUpdate({ personaId: "system", content: `Result: ${res}` });
            taskComplete = true;
          } else {
            currentSkill = 'python-coding';
            taskInstruction = `Fix based on review: ${result}`;
          }
        } catch (e) {
          taskComplete = true;
        }
      } else if (currentSkill === 'research') {
        // Research skill provides direct answers, no artifact needed
        onUpdate({ personaId: "system", content: `Research completed: ${result}` });
        taskComplete = true;
      } else if (currentSkill === 'data-analysis') {
        // Data analysis can provide direct results
        onUpdate({ personaId: "system", content: `Analysis completed: ${result}` });
        taskComplete = true;
      } else if (currentSkill === 'knowledge-manager') {
        // Knowledge manager provides direct guidance and processes information
        onUpdate({ personaId: "system", content: `Knowledge management: ${result}` });
        taskComplete = true;
      } else {
        // For other skills, try to determine next skill
        try {
          const nextSkill = await this.skillManager.selectSkill(result, this.chatHistory);
          if (nextSkill !== currentSkill) {
            currentSkill = nextSkill;
            taskInstruction = result;
          } else {
            taskComplete = true;
          }
        } catch (e) {
          taskComplete = true;
        }
      }

      this.loopDetector.addSkillToHistory(currentSkill);
      if (this.loopDetector.detectSkillCycle()) break;
    }

    if (taskComplete) {
      onUpdate({ personaId: "system", content: "Task completed successfully. FINISH" });
    }

    return this.chatHistory;
  }

  private truncateChatHistory(): void {
    if (this.chatHistory.length > this.maxChatHistoryLength) {
      const keepCount = Math.floor(this.maxChatHistoryLength / 2);
      this.chatHistory = [this.chatHistory[0], ...this.chatHistory.slice(-keepCount)];
    }
  }

  /**
   * For backward compatibility with tests
   */
  async executeTool(toolName: string, args: Record<string, unknown>, _onUpdate: (response: AgentResponse) => void): Promise<string> {
    const { path, content, prefix } = args as { path?: string; content?: string; prefix?: string };

    if (toolName === 'vfs_write') {
      if (!path || !content) return 'Error: vfs_write requires path and content parameters';
      try {
        await storage.writeFile(path, content);
        return `Successfully wrote to ${path}`;
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    if (toolName === 'vfs_read') {
      if (!path) return 'Error: vfs_read requires path parameter';
      try {
        const res = await storage.readFile(path);
        return res === null ? `File not found: ${path}` : res;
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    if (toolName === 'vfs_ls') {
      try {
        const files = await storage.listFiles(prefix || 'keel://');
        return files.join('\n');
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    if (toolName === 'activate_skill') {
      const { name } = args as { name?: string };
      if (!name) return 'Error: activate_skill requires a "name" parameter';
      _onUpdate({ personaId: "system", content: `Activating skill: ${name}...` });
      const { output } = await this.skillManager.executeSkill(name, { task: 'disclosure' }, this.chatHistory);
      return output;
    }

    const skillMapping: Record<string, string> = {
      'web_fetch': 'research',
      'execute_python': 'python-coding',
      'memory_update': 'execution-analyzer'
    };
    
    const skillName = skillMapping[toolName] || 'python-coding';
    const { output } = await this.skillManager.executeSkill(skillName, { task: JSON.stringify(args) }, this.chatHistory);
    return output;
  }
}
