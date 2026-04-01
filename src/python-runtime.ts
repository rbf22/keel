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
    logger.info('python', 'PythonRuntime initialized');
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
    logger.info('python', 'Initializing Python runtime');
    return new Promise<void>((resolve, reject) => {
      // Try multiple worker loading strategies for compatibility
      logger.debug('python', 'Creating Python worker');
      
      try {
        // Strategy 1: Standard Vite worker URL
        this.worker = new Worker(new URL('./python-worker.ts', import.meta.url), {
          type: 'module'
        });
        logger.debug('python', 'Worker created with standard Vite URL');
      } catch (workerError) {
        logger.error('python', 'Failed to create worker with standard URL', { error: workerError });
        // If this fails, the onerror handler will catch it
      }

      this.worker!.onmessage = (event) => {
        const output: PythonOutput = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        logger.debug('python', `Worker output: ${output.type}`, output);
        
        if (output.type === 'ready') {
          logger.info('python', 'Python runtime ready');
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

      this.worker!.onerror = (error) => {
        logger.error('python', 'Worker error occurred during initialization', { 
          error,
          message: error.message,
          filename: error.filename,
          lineno: error.lineno,
          colno: error.colno
        });
        const errorMessage = error.message || 'Python worker failed to load. This might be due to a network error, browser restriction, or the worker file not being found.';
        this.onOutput({ type: 'error', message: errorMessage });
        if (!this.isReady) {
          this.terminate();
          reject(new Error(errorMessage));
        }
      };
    });
  }

  async execute(code: string, resources?: Record<string, string>) {
    logger.info('python', 'Code execution requested', { 
      codeLength: code.length,
      hasResources: !!resources,
      resourceCount: resources ? Object.keys(resources).length : 0,
      queueLength: this.executionQueue.length
    });
    
    if (!this.worker || !this.isReady) {
      logger.error('python', 'Python runtime not ready for execution');
      throw new Error('Python runtime not ready');
    }

    // Use a unique ID for each execution to handle timeouts safely
    const executionId = Math.random().toString(36).substring(7);
    logger.debug('python', 'Generated execution ID', { executionId });

    // Add to queue and wait for turn
    return new Promise<void>((resolve, reject) => {
      this.executionQueue.push({ code, resources, resolve, reject, executionId });
      logger.debug('python', 'Added to execution queue', { 
        executionId,
        queueLength: this.executionQueue.length 
      });
      void this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isExecuting || this.executionQueue.length === 0) {
      return;
    }

    const task = this.executionQueue.shift();
    if (!task) return;

    logger.info('python', 'Processing execution queue', {
      executionId: task.executionId,
      queueLength: this.executionQueue.length,
      isExecuting: this.isExecuting
    });

    this.isExecuting = true;
    try {
      if (!this.worker || !this.isReady) {
        logger.error('python', 'Python runtime terminated or not ready during queue processing');
        throw new Error('Python runtime terminated or not ready');
      }
      await this.internalExecute(task.code, task.resources, task.executionId);
      logger.info('python', 'Execution completed successfully', { executionId: task.executionId });
      task.resolve();
    } catch (error) {
      logger.error('python', 'Execution failed', { 
        executionId: task.executionId,
        error: error instanceof Error ? error.message : String(error)
      });
      task.reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isExecuting = false;
      logger.debug('python', 'Execution finished, processing next in queue', {
        remainingQueue: this.executionQueue.length
      });
      void this.processQueue();
    }
  }

  private async internalExecute(code: string, resources?: Record<string, string>, executionId?: string) {
    if (!this.worker) {
      throw new Error('Python worker lost during execution');
    }

    logger.info('python', 'Starting code execution', { 
      codeLength: code.length,
      hasResources: !!resources,
      executionId 
    });
    const startTime = performance.now();

    return new Promise<void>((resolve, reject) => {
      this.currentReject = reject;
      let timeout: number | undefined;

      const handleMessage = (event: MessageEvent) => {
        const output: PythonOutput = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        logger.debug('python', `Execution message: ${output.type}`, { executionId });
        
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
            logger.info('python', 'Execution completed successfully', { 
              durationMs: duration, 
              executionId 
            });
            resolve();
          } else {
            logger.error('python', `Execution error: ${output.message}`, { 
              executionId,
              errorMessage: output.message 
            });
            reject(new Error(output.message));
          }
        }
      };

      this.worker!.addEventListener('message', handleMessage);

      logger.debug('python', 'Sending code to worker', { executionId });
      this.worker!.postMessage(JSON.stringify({ type: 'execute', code, resources, executionId }));

      this.currentTimeout = timeout = setTimeout(() => {
        // Check if this timeout is still the current one (prevents race conditions)
        if (this.currentTimeout === timeout && this.worker) {
          logger.warn('python', 'Execution timed out', { 
            executionId,
            timeoutMs: this.executionTimeout 
          });
          // Remove event listener first to prevent memory leaks
          this.worker.removeEventListener('message', handleMessage);
          // Clear current reject
          this.currentReject = null;
          
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
    logger.warn('python', 'Terminating Python runtime', {
      isExecuting: this.isExecuting,
      queueLength: this.executionQueue.length,
      hasWorker: !!this.worker,
      hasTimeout: this.currentTimeout !== undefined
    });
    
    // Clear any pending timeout
    if (this.currentTimeout !== undefined) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = undefined;
      logger.debug('python', 'Cleared execution timeout');
    }
    
    // Reject currently executing task
    if (this.currentReject) {
      logger.debug('python', 'Rejecting currently executing task');
      this.currentReject(new Error('Python runtime terminated'));
      this.currentReject = null;
    }
    
    // Reject all pending tasks in the queue
    const error = new Error('Python runtime terminated');
    const pendingTasks = [...this.executionQueue];
    this.executionQueue = [];
    this.isExecuting = false;
    
    logger.info('python', 'Rejecting pending tasks', { pendingTaskCount: pendingTasks.length });
    for (const task of pendingTasks) {
      task.reject(error);
    }
    
    if (this.worker) {
      logger.debug('python', 'Terminating Python worker');
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
      logger.info('python', 'Python runtime terminated successfully');
    }
  }
}
