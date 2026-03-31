import { logger } from "./logger";
import { HandlerManager } from "./utils/handler-manager";

export interface PythonOutput {
  type: 'log' | 'table' | 'chart' | 'download' | 'error' | 'ready' | 'complete';
  message?: string;
  data?: unknown[];
  spec?: unknown;
  filename?: string;
  content?: string;
}

export class PythonRuntime {
  private worker: Worker | null = null;
  private outputHandlers: HandlerManager<(output: PythonOutput) => void>;
  private isReady = false;
  private executionTimeout = 10000; // 10 seconds
  private currentTimeout: number | undefined = undefined;

  constructor(onOutput: (output: PythonOutput) => void) {
    // Initialize handler manager with the default handler
    this.outputHandlers = new HandlerManager(onOutput);
  }
  
  /**
   * Get the current active output handler
   */
  get onOutput(): (output: PythonOutput) => void {
    return this.outputHandlers.getCurrent();
  }
  
  /**
   * Set a new output handler (pushes to stack)
   */
  set onOutput(handler: (output: PythonOutput) => void) {
    this.outputHandlers.push(handler);
  }
  
  /**
   * Restore the previous output handler
   */
  restoreHandler(): void {
    this.outputHandlers.pop();
  }
  
  /**
   * Execute with a temporary output handler
   */
  executeWithTemporaryOutput<R>(
    handler: (output: PythonOutput) => void, 
    fn: () => Promise<R>
  ): Promise<R> {
    return this.outputHandlers.withTemporaryHandler(handler, fn);
  }
  
  /**
   * Get the number of stacked handlers
   */
  get handlerCount(): number {
    return this.outputHandlers.size();
  }

  async init() {
    return new Promise<void>((resolve, reject) => {
      // In Vite, you can use new Worker(new URL('./path', import.meta.url))
      this.worker = new Worker(new URL('./python-worker.ts', import.meta.url), {
        type: 'module'
      });

      this.worker.onmessage = (event) => {
        const output: PythonOutput = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        logger.info('python', `Worker output: ${output.type}`, output);
        if (output.type === 'ready') {
          this.isReady = true;
          this.onOutput(output);
          resolve();
        } else {
          this.onOutput(output);
        }
      };

      this.worker.onerror = (error) => {
        logger.error('python', 'Worker error occurred', { error });
        this.onOutput({ type: 'error', message: 'Worker error occurred' });
        reject(error);
      };
    });
  }

  async execute(code: string) {
    if (!this.worker || !this.isReady) {
      logger.error('python', 'Python runtime not ready');
      throw new Error('Python runtime not ready');
    }

    logger.info('python', 'Executing code', { code });
    const startTime = performance.now();

    return new Promise<void>((resolve, reject) => {
      let timeout: number | undefined;

      const handleMessage = (event: MessageEvent) => {
        const output: PythonOutput = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (output.type === 'complete' || output.type === 'error') {
          // Clear timeout and remove listener
          if (timeout !== undefined) {
            clearTimeout(timeout);
            timeout = undefined;
          }
          this.worker!.removeEventListener('message', handleMessage);
          
          if (output.type === 'complete') {
            const duration = performance.now() - startTime;
            logger.info('python', 'Execution complete', { durationMs: duration });
            resolve();
          } else {
            logger.error('python', `Execution error: ${output.message}`);
            reject(new Error(output.message));
          }
        }
      };

      this.worker!.addEventListener('message', handleMessage);

      this.worker!.postMessage(JSON.stringify({ type: 'execute', code }));

      this.currentTimeout = timeout = setTimeout(() => {
        // Check if this timeout is still the current one (prevents race conditions)
        if (this.currentTimeout === timeout && this.worker) {
          // Remove event listener first to prevent memory leaks
          this.worker.removeEventListener('message', handleMessage);
          // Clear the timeout reference
          this.currentTimeout = undefined;
          // Terminate the worker
          this.terminate();
          // Send error output
          this.onOutput({ type: 'error', message: 'Execution timed out. Worker terminated.' });
          // Reject the promise
          reject(new Error('Execution timed out'));
        }
      }, this.executionTimeout);
    });
  }

  terminate() {
    // Clear any pending timeout
    if (this.currentTimeout !== undefined) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = undefined;
    }
    
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }
}
