import { logger } from "./logger";
import { skillsEngine } from "./skills/engine";
import { PythonRuntime } from "./python-runtime";

// Import interfaces from orchestrator
import { ExecutionPlan, Subtask, SharedContext, CodeArtifact } from "./orchestrator/types";

/**
 * PlanExecutor - Manages structured task execution with shared context
 * 
 * This class handles:
 * - Parsing and validating execution plans
 * - Assigning subtasks to skills with weighted selection
 * - Managing shared context between skills
 * - Aggregating results and synthesizing final answers
 */
export class PlanExecutor {
  private python: PythonRuntime;
  private explorationFactor = 0.2; // 20% chance to explore alternative skills
  
  constructor(python: PythonRuntime) {
    this.python = python;
  }

  /**
   * Parse a plan from the task-planning skill output
   */
  parsePlan(planOutput: string, userRequest: string): ExecutionPlan | null {
    try {
      // Extract JSON from the output (it might be mixed with log messages)
      let jsonStr = planOutput;
      
      // Try to find JSON object in the output
      const jsonStart = planOutput.indexOf('{');
      const jsonEnd = planOutput.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        jsonStr = planOutput.substring(jsonStart, jsonEnd + 1);
      }
      
      // Try to parse as JSON
      const planData = JSON.parse(jsonStr);
      
      if (!planData.subtasks || !Array.isArray(planData.subtasks)) {
        logger.error('plan-executor', 'Invalid plan format - missing subtasks array');
        return null;
      }

      const plan: ExecutionPlan = {
        id: this.generateId(),
        userRequest,
        subtasks: planData.subtasks.map((st: any) => ({
          id: st.id || this.generateId(),
          description: st.description || st.task || 'Unknown task',
          requirements: st.requirements || [],
          assignedSkill: st.assignedSkill || st.skill,
          status: 'pending' as const,
          dependencies: st.dependencies || [],
          successCriteria: st.successCriteria || 'Task completed successfully'
        })),
        status: 'executing',
        createdAt: new Date()
      };

      logger.info('plan-executor', 'Parsed execution plan', {
        planId: plan.id,
        subtaskCount: plan.subtasks.length
      });

      return plan;
    } catch (error) {
      logger.error('plan-executor', 'Failed to parse plan', { error, planOutput });
      return null;
    }
  }

  /**
   * Create initial shared context from a plan
   */
  createSharedContext(plan: ExecutionPlan): SharedContext {
    return {
      plan,
      artifacts: [],
      results: new Map(),
      skillHistory: []
    };
  }

  /**
   * Select next subtask to execute based on dependencies and priorities
   */
  selectNextSubtask(context: SharedContext): Subtask | null {
    const { plan, results } = context;
    
    // Find subtasks that are ready (dependencies satisfied)
    const readySubtasks = plan.subtasks.filter((subtask: Subtask) => {
      if (subtask.status !== 'pending') return false;
      
      // Check if all dependencies are complete
      return subtask.dependencies.every((depId: string) => {
        const depResult = results.get(depId);
        return depResult && (depResult as any).status === 'complete';
      });
    });

    if (readySubtasks.length === 0) return null;

    // Prioritize subtasks with no dependencies
    const noDeps = readySubtasks.filter(st => st.dependencies.length === 0);
    if (noDeps.length > 0) {
      return this.selectWeightedSubtask(noDeps);
    }

    // Otherwise select from all ready subtasks
    return this.selectWeightedSubtask(readySubtasks);
  }

  /**
   * Weighted subtask selection with exploration factor
   */
  private selectWeightedSubtask(subtasks: Subtask[]): Subtask {
    if (subtasks.length === 1) return subtasks[0];

    // Add exploration: sometimes pick a non-optimal subtask
    if (Math.random() < this.explorationFactor) {
      const randomSubtask = subtasks[Math.floor(Math.random() * subtasks.length)];
      logger.debug('plan-executor', 'Exploration: selecting random subtask', {
        subtaskId: randomSubtask.id
      });
      return randomSubtask;
    }

    // Prefer subtasks with assigned skills
    const withAssignedSkill = subtasks.filter(st => st.assignedSkill);
    if (withAssignedSkill.length > 0) {
      return withAssignedSkill[0];
    }

    // Default to first subtask
    return subtasks[0];
  }

  /**
   * Select appropriate skill for a subtask
   */
  selectSkillForSubtask(subtask: Subtask, _context: SharedContext): string {
    // If subtask has assigned skill, use it (disable exploration for plan-based execution)
    if (subtask.assignedSkill) {
      return subtask.assignedSkill; // Always use the assigned skill from the plan
    }

    // Infer skill from subtask description
    const description = subtask.description.toLowerCase();
    
    if (description.includes('create') || description.includes('code') || description.includes('function')) {
      return 'python-coding';
    }
    if (description.includes('review') || description.includes('check') || description.includes('validate')) {
      return 'quality-review';
    }
    if (description.includes('research') || description.includes('find') || description.includes('investigate')) {
      return 'research';
    }
    if (description.includes('analyze') || description.includes('data') || description.includes('statistics')) {
      return 'data-analysis';
    }
    if (description.includes('execute') || description.includes('run') || description.includes('calculate')) {
      return 'python-coding'; // Execution tasks often use python-coding
    }

    // Default to python-coding
    return 'python-coding';
  }

  /**
   * Execute a subtask with the specified skill
   */
  async executeSubtask(
    subtask: Subtask, 
    skillName: string, 
    context: SharedContext
  ): Promise<{ success: boolean; result: any; artifact?: CodeArtifact }> {
    logger.info('plan-executor', 'Executing subtask', {
      subtaskId: subtask.id,
      skill: skillName,
      description: subtask.description
    });

    try {
      // Build skill parameters with enhanced context
      const skillParams = {
        task: subtask.description,
        subtask_id: subtask.id,
        plan_context: {
          originalRequest: context.plan.userRequest, // Add original request
          previousResults: Array.from(context.results.entries()),
          artifacts: context.artifacts,
          currentStep: subtask.id,
          totalSteps: context.plan.subtasks.length,
          stepDescription: subtask.description,
          requirements: subtask.requirements,
          successCriteria: subtask.successCriteria
        }
      };

      const skillContext = {
        userMessage: context.plan.userRequest, // Original user request
        conversationHistory: [], // Fresh context for subtask
        pythonRuntime: this.python,
        sharedContext: context // Pass full context for advanced skills
      };

      const result = await skillsEngine.executeSkill(skillName, skillParams, skillContext);
      
      // Parse for artifacts
      let artifact: CodeArtifact | undefined;
      try {
        const output = result.output || '';
        const jsonStart = output.indexOf('{');
        const jsonEnd = output.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          const jsonStr = output.substring(jsonStart, jsonEnd + 1);
          const parsed = JSON.parse(jsonStr);
          
          if (parsed.id && parsed.function) {
            artifact = parsed;
            if (artifact) {
              context.artifacts.push(artifact);
              // Save to VFS for persistence
              const artifactPath = `keel://artifacts/${artifact.id || 'unnamed'}.py`;
              const storage = (await import("./storage")).storage;
              await storage.writeFile(artifactPath, 
                `# Artifact: ${artifact.name}\n# ID: ${artifact.id}\n\n${artifact.function}\n\n${artifact.usage || ''}`);
            }
          }
        }
      } catch (e) {
        // Not JSON, ignore
      }

      return {
        success: result.success || false,
        result: result.output || result.error || 'No result',
        artifact
      };
    } catch (error) {
      logger.error('plan-executor', 'Subtask execution failed', {
        subtaskId: subtask.id,
        skill: skillName,
        error
      });

      return {
        success: false,
        result: `Execution failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Update context with subtask results
   */
  updateContext(context: SharedContext, subtask: Subtask, executionResult: { success: boolean; result: any; artifact?: CodeArtifact }): void {
    // Update subtask status
    subtask.status = executionResult.success ? 'complete' : 'failed';
    subtask.result = executionResult.result;
    
    // Store result
    context.results.set(subtask.id, {
      status: subtask.status,
      result: executionResult.result,
      timestamp: new Date()
    });

    // Update skill history
    const usedSkill = this.selectSkillForSubtask(subtask, context);
    context.skillHistory.push(usedSkill);
    
    // Update plan focus
    context.plan.currentFocus = undefined; // Clear current focus, will be set by next selection

    logger.info('plan-executor', 'Updated context', {
      subtaskId: subtask.id,
      status: subtask.status,
      totalComplete: Array.from(context.results.values()).filter(r => r.status === 'complete').length
    });
  }

  /**
   * Check if plan is complete
   */
  isPlanComplete(context: SharedContext): boolean {
    const { plan, results } = context;
    
    // All subtasks must be complete or failed
    const allSubtasksProcessed = plan.subtasks.every(subtask => {
      const result = results.get(subtask.id);
      return result && (result.status === 'complete' || result.status === 'failed');
    });

    // At least one subtask must be complete
    const hasCompleteSubtasks = Array.from(results.values()).some(r => r.status === 'complete');

    return allSubtasksProcessed && hasCompleteSubtasks;
  }

  /**
   * Synthesize final result from all subtask results
   */
  synthesizeResult(context: SharedContext): string {
    const { plan, results } = context;
    
    // Find the final answer - usually from the last subtask
    const sortedSubtasks = plan.subtasks.sort((a, b) => {
      // Prefer subtasks that sound like they produce final answers
      const aDesc = a.description.toLowerCase();
      const bDesc = b.description.toLowerCase();
      
      if (aDesc.includes('execute') || aDesc.includes('calculate') || aDesc.includes('final')) return 1;
      if (bDesc.includes('execute') || bDesc.includes('calculate') || bDesc.includes('final')) return -1;
      return 0;
    });

    // Get results from complete subtasks
    const completeResults = Array.from(results.entries())
      .filter(([_, result]: [string, any]) => (result as any).status === 'complete')
      .map(([subtaskId, result]: [string, any]) => {
        const subtask = sortedSubtasks.find((st: Subtask) => st.id === subtaskId);
        return {
          subtask: subtask?.description || 'Unknown',
          result: (result as any).result
        };
      });

    // If we have execution results, prioritize those
    const executionResults = completeResults.filter((r: any) => 
      r.subtask.toLowerCase().includes('execute') || 
      r.subtask.toLowerCase().includes('calculate') ||
      r.subtask.toLowerCase().includes('run')
    );

    if (executionResults.length > 0) {
      return executionResults[executionResults.length - 1].result;
    }

    // Otherwise return the last complete result
    if (completeResults.length > 0) {
      return completeResults[completeResults.length - 1].result;
    }

    // Fallback: summarize all results
    if (completeResults.length > 0) {
      return `Task completed with ${completeResults.length} steps:\n` +
             completeResults.map(r => `- ${r.subtask}: ${r.result}`).join('\n');
    }

    return 'Task completed but no successful results were generated.';
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
