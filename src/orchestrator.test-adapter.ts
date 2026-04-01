import { AgentOrchestrator } from './orchestrator'
import { LLMEngine } from './llm'
import { PythonRuntime } from './python-runtime'
import { AgentResponse } from './types'

import { ResponseType } from './types'

// Define the event structure that the adapter will capture
export interface OrchestratorEvent {
  type: ResponseType
  personaId: string
  content: string
  metadata?: Record<string, unknown>
}

/**
 * Test adapter that captures all orchestrator callback events
 * This makes the orchestrator testable without refactoring the production code
 */
export class OrchestratorTestAdapter {
  private events: OrchestratorEvent[] = []
  private orchestrator: AgentOrchestrator
  
  constructor(engine: LLMEngine, python: PythonRuntime) {
    this.orchestrator = new AgentOrchestrator(engine, python)
  }
  
  /**
   * Run a task and capture all events that would normally be sent to callbacks
   */
  async runTaskAndCaptureEvents(request: string, _agents?: string[]): Promise<OrchestratorEvent[]> {
    this.events = []
    
    // Create a callback that captures all events
    const captureCallback = (event: AgentResponse) => {
      this.events.push({
        type: event.type || 'token',
        personaId: event.personaId || 'system',
        content: event.content || '',
        metadata: event.data as Record<string, unknown> | undefined
      })
    }
    
    // Run the orchestrator with our capturing callback
    await this.orchestrator.runTask(request, captureCallback)
    
    return this.events
  }
  
  /**
   * Get the last event of a specific type
   */
  getLastEvent(type: OrchestratorEvent['type']): OrchestratorEvent | undefined {
    return this.events
      .filter(e => e.type === type)
      .pop()
  }
  
  /**
   * Get all events for a specific persona
   */
  getEventsForPersona(personaId: string): OrchestratorEvent[] {
    return this.events.filter(e => e.personaId === personaId)
  }
  
  /**
   * Clear captured events
   */
  clearEvents(): void {
    this.events = []
  }

  /**
   * Get the orchestrator instance for direct testing
   */
  getOrchestrator(): AgentOrchestrator {
    return this.orchestrator
  }
}
