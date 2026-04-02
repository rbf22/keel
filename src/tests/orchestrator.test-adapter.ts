import { AgentOrchestrator } from "../orchestrator";
import { AgentResponse } from "../types";

export interface OrchestratorEvent extends Omit<AgentResponse, 'type'> {
  type: string;
  timestamp: number;
}

export class OrchestratorTestAdapter {
  private orchestrator: AgentOrchestrator;
  private events: OrchestratorEvent[] = [];

  constructor(engine: any, python: any) {
    this.orchestrator = new AgentOrchestrator(engine, python);
  }

  async runTaskAndCaptureEvents(task: string): Promise<OrchestratorEvent[]> {
    this.clearEvents();
    await this.orchestrator.runTask(task, (response: AgentResponse) => {
      this.events.push({
        ...response,
        type: 'token',
        timestamp: Date.now()
      });
    });
    return this.events;
  }

  getEventsForPersona(personaId: string): OrchestratorEvent[] {
    return this.events.filter(e => e.personaId === personaId);
  }

  getLastEvent(type: string): OrchestratorEvent | undefined {
    return this.events.filter(e => e.type === type).pop();
  }

  clearEvents(): void {
    this.events = [];
  }

  getOrchestrator(): AgentOrchestrator {
    return this.orchestrator;
  }
}
