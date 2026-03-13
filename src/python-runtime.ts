export interface PythonOutput {
  type: 'log' | 'table' | 'chart' | 'download' | 'error' | 'ready' | 'complete';
  message?: string;
  data?: any[];
  spec?: any;
  filename?: string;
  content?: string;
}

export class PythonRuntime {
  private worker: Worker | null = null;
  private onOutput: (output: PythonOutput) => void;
  private isReady = false;
  private executionTimeout = 10000; // 10 seconds

  constructor(onOutput: (output: PythonOutput) => void) {
    this.onOutput = onOutput;
  }

  async init() {
    return new Promise<void>((resolve, reject) => {
      // In Vite, you can use new Worker(new URL('./path', import.meta.url))
      this.worker = new Worker(new URL('./python-worker.ts', import.meta.url), {
        type: 'module'
      });

      this.worker.onmessage = (event) => {
        const output: PythonOutput = JSON.parse(event.data);
        if (output.type === 'ready') {
          this.isReady = true;
          this.onOutput(output);
          resolve();
        } else {
          this.onOutput(output);
        }
      };

      this.worker.onerror = (error) => {
        console.error('Worker error:', error);
        this.onOutput({ type: 'error', message: 'Worker error occurred' });
        reject(error);
      };
    });
  }

  async execute(code: string) {
    if (!this.worker || !this.isReady) {
      throw new Error('Python runtime not ready');
    }

    return new Promise<void>((resolve, reject) => {
      let timeout: any;

      const handleMessage = (event: MessageEvent) => {
        const output: PythonOutput = JSON.parse(event.data);
        if (output.type === 'complete' || output.type === 'error') {
          clearTimeout(timeout);
          this.worker!.removeEventListener('message', handleMessage);
          if (output.type === 'complete') {
            resolve();
          } else {
            reject(new Error(output.message));
          }
        }
      };

      this.worker!.addEventListener('message', handleMessage);

      this.worker!.postMessage(JSON.stringify({ type: 'execute', code }));

      timeout = setTimeout(() => {
        this.worker!.removeEventListener('message', handleMessage);
        this.terminate();
        this.onOutput({ type: 'error', message: 'Execution timed out. Worker terminated.' });
        reject(new Error('Execution timed out'));
      }, this.executionTimeout);
    });
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }
}
