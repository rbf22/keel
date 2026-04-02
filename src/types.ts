/**
 * Shared type definitions for the Keel codebase.
 */

export interface VFSFile {
  path: string; // e.g. "keel://resources/report.txt"
  content: string; // L2: Full details
  l0?: string; // Abstract (~100 tokens)
  l1?: string; // Overview (~2000 tokens)
  mimeType: string;
  metadata: Record<string, unknown>;
  updatedAt: number;
}

export type MemoryCategory = "profile" | "preferences" | "entities" | "events" | "cases" | "patterns";

export interface AgentMemory {
  id?: number;
  category: MemoryCategory;
  content: string;
  tags: string[];
  timestamp: number;
  metadata: Record<string, unknown>;
}

export interface PythonOutput {
  type: 'log' | 'download' | 'error' | 'ready' | 'complete' | 'code' | 'vfs_write';
  message?: string;
  data?: unknown;
  spec?: unknown;
  filename?: string;
  content?: string;
  path?: string;
}

export type ResponseType = 'text' | 'error' | 'plan' | 'observation' | 'token' | 'complete' | 'tool_call' | 'memory_added';

export interface AgentResponse {
  personaId: string;
  content: string;
  type?: ResponseType;
  data?: unknown;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface PendingPythonExecution extends ToolCall {
  name: 'execute_python';
  args: { code: string };
}
