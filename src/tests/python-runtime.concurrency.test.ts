import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PythonRuntime } from '../python-runtime';
import { PythonOutput } from '../types';

// Mock Worker
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((error: ErrorEvent) => void) | null = null;
  private terminated = false;
  
  constructor() {
    setTimeout(() => {
      if (this.onmessage && !this.terminated) {
        this.onmessage(new MessageEvent('message', { 
          data: JSON.stringify({ type: 'ready' }) 
        }));
      }
    }, 0);
  }
  
  postMessage(data: string) {
    if (this.terminated) return;
    const parsed = JSON.parse(data);
    if (parsed.type === 'execute') {
      // Simulate variable execution time
      const delay = parsed.code.includes('long') ? 100 : 10;
      setTimeout(() => {
        if (this.onmessage && !this.terminated) {
          this.onmessage(new MessageEvent('message', { 
            data: JSON.stringify({ type: 'complete' }) 
          }));
        }
      }, delay);
    }
  }
  
  terminate() {
    this.terminated = true;
  }
  
  addEventListener(type: string, listener: EventListener) {
    if (type === 'message') {
      const originalOnMessage = this.onmessage;
      this.onmessage = (event: MessageEvent) => {
        if (originalOnMessage) (originalOnMessage as any)(event);
        (listener as any)(event);
      };
    }
  }
  
  removeEventListener(type: string, listener: EventListener) {
    // Basic mock removal
  }
}

describe('PythonRuntime Concurrency', () => {
  let runtime: PythonRuntime;
  
  beforeEach(() => {
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

  it('should handle rapid sequential executions', async () => {
    await runtime.init();
    
    // Execute 5 times in rapid succession (though await makes it sequential)
    for (let i = 0; i < 5; i++) {
      await expect(runtime.execute(`print(${i})`)).resolves.toBeUndefined();
    }
  });

  it('should handle overlapping execution attempts', async () => {
    await runtime.init();
    
    // Start multiple executions without awaiting the first ones
    const p1 = runtime.execute('long execution');
    const p2 = runtime.execute('short execution');
    
    await Promise.all([p1, p2]);
    // Both should complete eventually if internal handling is robust
  });

  it('should correctly manage timeouts for overlapping calls', async () => {
    await runtime.init();
    
    // Set a very short timeout
    (runtime as any).executionTimeout = 50;
    
    // Start a long one that will timeout, and a short one that wouldn't
    const p1 = runtime.execute('long execution').catch(e => e.message);
    const p2 = runtime.execute('short execution').catch(e => e.message);
    
    const results = await Promise.all([p1, p2]);
    
    // If one times out, the worker is terminated, so both should likely fail
    expect(results).toContain('Execution timed out');
  });
});
