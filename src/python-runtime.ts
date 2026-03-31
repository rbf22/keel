import { logger } from "./logger";
import { HandlerManager } from "./utils/handler-manager";
import { PythonOutput } from "./types";

export class PythonRuntime {
  private worker: Worker | null = null;
  private outputHandlers: HandlerManager<(output: PythonOutput) => void>;
  private isReady = false;
  private executionTimeout = 10000; // 10 seconds
  private currentTimeout: number | undefined = undefined;
  private executionQueue: Array<{
    code: string;
    resources?: Record<string, string>;
    executionId?: string;
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];
  private isExecuting = false;
  private currentReject: ((error: Error) => void) | null = null;

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
        } else if (output.type === 'error' && !this.isReady) {
          // If we haven't resolved yet and we get an error, reject the init promise
          const errorMsg = output.message || 'Unknown initialization error';
          logger.error('python', `Initialization failed: ${errorMsg}`);
          
          let userFriendlyError = errorMsg;
          if (errorMsg.includes('Failed to fetch')) {
            userFriendlyError = 'Failed to download Python runtime (Pyodide) or packages (pandas, numpy). Please check your internet connection.';
          }
          
          this.terminate();
          reject(new Error(userFriendlyError));
        } else {
          this.onOutput(output);
        }
      };

      this.worker.onerror = (error) => {
        logger.error('python', 'Worker error occurred during initialization', { error });
        const errorMessage = 'Python worker failed to load. This might be due to a network error or browser restriction.';
        this.onOutput({ type: 'error', message: errorMessage });
        if (!this.isReady) {
          this.terminate();
          reject(new Error(errorMessage));
        }
      };
    });
  }

  async execute(code: string, resources?: Record<string, string>) {
    if (!this.worker || !this.isReady) {
      logger.error('python', 'Python runtime not ready');
      throw new Error('Python runtime not ready');
    }

    // Use a unique ID for each execution to handle timeouts safely
    const executionId = Math.random().toString(36).substring(7);

    // Add to queue and wait for turn
    return new Promise<void>((resolve, reject) => {
      this.executionQueue.push({ code, resources, resolve, reject, executionId });
      void this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isExecuting || this.executionQueue.length === 0) {
      return;
    }

    const task = this.executionQueue.shift();
    if (!task) return;

    this.isExecuting = true;
    try {
      if (!this.worker || !this.isReady) {
        throw new Error('Python runtime terminated or not ready');
      }
      await this.internalExecute(task.code, task.resources, task.executionId);
      task.resolve();
    } catch (error) {
      task.reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isExecuting = false;
      void this.processQueue();
    }
  }

  private async internalExecute(code: string, resources?: Record<string, string>, executionId?: string) {
    if (!this.worker) {
      throw new Error('Python worker lost during execution');
    }

    logger.info('python', 'Executing code', { code, hasResources: !!resources, executionId });
    const startTime = performance.now();

    return new Promise<void>((resolve, reject) => {
      this.currentReject = reject;
      let timeout: number | undefined;

      const handleMessage = (event: MessageEvent) => {
        const output: PythonOutput = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (output.type === 'complete' || output.type === 'error') {
          // Clear current reject
          this.currentReject = null;
          
          // Clear timeout and remove listener
          if (timeout !== undefined) {
            clearTimeout(timeout);
            timeout = undefined;
          }
          this.worker?.removeEventListener('message', handleMessage);
          
          if (output.type === 'complete') {
            const duration = performance.now() - startTime;
            logger.info('python', 'Execution complete', { durationMs: duration, executionId });
            resolve();
          } else {
            logger.error('python', `Execution error: ${output.message}`, { executionId });
            reject(new Error(output.message));
          }
        }
      };

      this.worker!.addEventListener('message', handleMessage);

      this.worker!.postMessage(JSON.stringify({ type: 'execute', code, resources, executionId }));

      this.currentTimeout = timeout = setTimeout(() => {
        // Check if this timeout is still the current one (prevents race conditions)
        if (this.currentTimeout === timeout && this.worker) {
          // Remove event listener first to prevent memory leaks
          this.worker.removeEventListener('message', handleMessage);
          // Clear current reject
          this.currentReject = null;
          
          // Terminate the worker
          this.terminate();
          // Send error output
          this.onOutput({ type: 'error', message: 'Execution timed out. Worker terminated.' });
          // Reject the promise
          reject(new Error('Execution timeout'));
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
    
    // Reject currently executing task
    if (this.currentReject) {
      this.currentReject(new Error('Python runtime terminated'));
      this.currentReject = null;
    }
    
    // Reject all pending tasks in the queue
    const error = new Error('Python runtime terminated');
    const pendingTasks = [...this.executionQueue];
    this.executionQueue = [];
    this.isExecuting = false;
    
    for (const task of pendingTasks) {
      task.reject(error);
    }
    
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }
}
