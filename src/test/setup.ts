// Test setup file
import { vi } from 'vitest'
import 'fake-indexeddb/auto'

// Mock WebLLM for tests
vi.mock('@mlc-ai/web-llm', () => ({
  CreateMLCEngine: vi.fn(),
  CreateWebWorkerEngine: vi.fn()
}))

// Mock Pyodide for tests
vi.mock('pyodide', () => ({
  loadPyodide: vi.fn(() => Promise.resolve({
    runPython: vi.fn(),
    runPythonAsync: vi.fn(),
    toPy: vi.fn(),
    registerJsModule: vi.fn()
  }))
}))

// Global test utilities
const originalConsole = globalThis.console
globalThis.console = {
  ...originalConsole,
  // Suppress console.log in tests unless needed
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: originalConsole.warn,
  error: originalConsole.error
}
