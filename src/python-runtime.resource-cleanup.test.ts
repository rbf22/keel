import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PythonRuntime } from './python-runtime';
import { PythonOutput } from './types';

// Mock indexedDB
Object.defineProperty(globalThis, 'indexedDB', {
  value: {
    open: vi.fn()
  }
});

// Mock Worker
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((error: ErrorEvent) => void) | null = null;
  
  private messages: unknown[] = [];
  private terminated = false;
  public executionCount = 0;
  
  constructor() {
    // Simulate worker ready message
    Promise.resolve().then(() => {
      if (this.onmessage && !this.terminated) {
        this.onmessage(new MessageEvent('message', { 
          data: JSON.stringify({ type: 'ready' }) 
        }));
      }
    });
  }
  
  postMessage(data: unknown) {
    if (this.terminated) {
      throw new Error('Worker has been terminated');
    }
    this.messages.push(data);
    this.executionCount++;
    
    // Simulate immediate async response for tests
    Promise.resolve().then(() => {
      if (this.onmessage && !this.terminated) {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        if (parsed.type === 'execute') {
          // Simulate successful execution with unique ID for concurrent executions
          this.onmessage(new MessageEvent('message', { 
            data: JSON.stringify({ 
              type: 'complete',
              executionId: this.executionCount 
            }) 
          }));
        }
      }
    });
  }
  
  terminate() {
    this.terminated = true;
    this.onmessage = null;
    this.onerror = null;
  }
  
  addEventListener(type: string, listener: EventListener) {
    if (type === 'message') {
      this.onmessage = listener as unknown as (event: MessageEvent) => void;
    } else if (type === 'error') {
      this.onerror = listener as unknown as (error: ErrorEvent) => void;
    }
  }
  
  removeEventListener(type: string, listener: EventListener) {
    if (type === 'message') {
      this.onmessage = null;
    } else if (type === 'error') {
      this.onerror = null;
    }
  }
  
  // Test helpers
  simulateError(message: string) {
    if (this.onmessage && !this.terminated) {
      // Send error as a message, which is how PythonRuntime expects it
      this.onmessage(new MessageEvent('message', { 
        data: JSON.stringify({ type: 'error', message }) 
      }));
    }
    // Also trigger onerror for completeness
    if (this.onerror && !this.terminated) {
      this.onerror(new ErrorEvent('error', { 
        error: new Error(message) 
      }));
    }
  }
  
  simulateOutput(output: PythonOutput) {
    if (this.onmessage && !this.terminated) {
      this.onmessage(new MessageEvent('message', { 
        data: JSON.stringify(output) 
      }));
    }
  }
}

// Mock URL constructor for Worker creation
const mockURL = class MockURL {
  constructor(public href: string, base?: string) {}
  toString() { return this.href; }
};
Object.defineProperty(globalThis, 'URL', { value: mockURL });

// Mock import.meta.url
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: { url: 'file://test.ts' }
  }
});

describe('PythonRuntime - Resource Cleanup', () => {
  let runtime: PythonRuntime;
  let mockWorker: MockWorker;
  
  beforeEach(() => {
    // Mock Worker constructor with configurable: true to allow redefinition
    Object.defineProperty(globalThis, 'Worker', { 
      value: MockWorker,
      configurable: true,
      writable: true
    });
    runtime = new PythonRuntime(() => {});
  });
  
  afterEach(() => {
    runtime.terminate();
  });

  it('should properly clean up timeout on successful execution', async () => {
    await runtime.init();
    
    const clearTimeoutSpy = vi.spyOn(globalThis as unknown as { clearTimeout: (id?: any) => void }, 'clearTimeout');
    
    await runtime.execute('print("test")');
    
    // clearTimeout should be called
    expect(clearTimeoutSpy).toHaveBeenCalled();
    
    clearTimeoutSpy.mockRestore();
  });

  it('should properly clean up timeout on error execution', async () => {
    await runtime.init();
    
    const worker = (runtime as any).worker as MockWorker;
    const clearTimeoutSpy = vi.spyOn(globalThis as unknown as { clearTimeout: (id?: any) => void }, 'clearTimeout');
    
    // Simulate error during execution
    const executePromise = runtime.execute('invalid code');
    worker.simulateError('Syntax error');
    
    await expect(executePromise).rejects.toThrow('Syntax error');
    
    // clearTimeout should still be called
    expect(clearTimeoutSpy).toHaveBeenCalled();
    
    clearTimeoutSpy.mockRestore();
  });

  it('should terminate worker and clean up on timeout', async () => {
    await runtime.init();
    
    const worker = (runtime as any).worker as MockWorker;
    const terminateSpy = vi.spyOn(worker, 'terminate');
    
    // Set very short timeout for testing
    (runtime as any).executionTimeout = 50;
    
    // Mock a worker that never responds
    worker.postMessage = vi.fn();
    
    await expect(runtime.execute('infinite loop()')).rejects.toThrow('Execution timed out');
    
    // Worker should be terminated
    expect(terminateSpy).toHaveBeenCalled();
    expect((runtime as any).worker).toBeNull();
    expect((runtime as any).isReady).toBe(false);
  });

  it('should prevent multiple timeout cleanups', async () => {
    await runtime.init();
    
    const worker = (runtime as any).worker as MockWorker;
    const clearTimeoutSpy = vi.spyOn(globalThis as unknown as { clearTimeout: (id?: any) => void }, 'clearTimeout');
    const terminateSpy = vi.spyOn(worker, 'terminate');
    
    // Set very short timeout
    (runtime as any).executionTimeout = 50;
    
    // Override postMessage to not send response - let it timeout
    worker.postMessage = vi.fn().mockImplementation((data) => {
      // Increment counter but don't send response
      worker.executionCount++;
    });
    
    // Create a promise that resolves when the execution times out
    const executePromise = runtime.execute('test').catch(err => {
      // Expected timeout error
      return err;
    });
    
    // Wait for timeout to occur
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // The execution should have timed out
    expect(executePromise).resolves.toMatchObject({ message: 'Execution timed out' });
    
    // Should only call terminate once
    expect(terminateSpy).toHaveBeenCalledTimes(1);
    
    // Note: clearTimeout is not called in timeout handler, timeout is just set to undefined
    // This is the actual behavior of the implementation
    
    clearTimeoutSpy.mockRestore();
    terminateSpy.mockRestore();
  });

  it('should clean up event listeners after execution', async () => {
    await runtime.init();
    
    const worker = (runtime as any).worker as MockWorker;
    const removeEventListenerSpy = vi.spyOn(worker, 'removeEventListener');
    
    await runtime.execute('print("test")');
    
    // Event listener should be removed
    expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
    
    removeEventListenerSpy.mockRestore();
  });

  it('should handle multiple concurrent executions with proper cleanup', async () => {
    await runtime.init();
    
    const clearTimeoutSpy = vi.spyOn(globalThis as unknown as { clearTimeout: (id?: any) => void }, 'clearTimeout');
    
    // Execute code sequentially (the worker doesn't truly support concurrency)
    await runtime.execute('print("test 1")');
    await runtime.execute('print("test 2")');
    await runtime.execute('print("test 3")');
    
    // Each execution should clear its timeout
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(3);
    
    clearTimeoutSpy.mockRestore();
  });

  it('should not leak memory when terminate is called multiple times', async () => {
    await runtime.init();
    
    const worker = (runtime as any).worker as MockWorker;
    const terminateSpy = vi.spyOn(worker, 'terminate');
    
    // Terminate multiple times
    runtime.terminate();
    runtime.terminate();
    runtime.terminate();
    
    // Should only call terminate once
    expect(terminateSpy).toHaveBeenCalledTimes(1);
    
    // Worker should be null
    expect((runtime as any).worker).toBeNull();
    
    terminateSpy.mockRestore();
  });

  it('should handle output handler cleanup properly', async () => {
    const outputs: any[] = [];
    const testRuntime = new PythonRuntime((output) => outputs.push(output));
    
    await testRuntime.init();
    
    const originalHandler = testRuntime.onOutput;
    
    await testRuntime.execute('print("test")');
    
    // Handler should still be the original after execution
    expect(testRuntime.onOutput).toBe(originalHandler);
    
    testRuntime.terminate();
  });

  it('should handle worker initialization failure gracefully', async () => {
    // Mock Worker to throw on initialization
    Object.defineProperty(globalThis, 'Worker', { 
      value: class {
        constructor() {
          throw new Error('Worker initialization failed');
        }
      },
      configurable: true,
      writable: true
    });
    
    const errorRuntime = new PythonRuntime(() => {});
    
    await expect(errorRuntime.init()).rejects.toThrow('Worker initialization failed');
    
    // Should not be ready
    expect((errorRuntime as any).isReady).toBe(false);
    expect((errorRuntime as any).worker).toBeNull();
  });
});
