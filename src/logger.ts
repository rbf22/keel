export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: 'llm' | 'python' | 'system' | 'orchestrator' | 'storage' | 'vfs' | 'main' | 'secure-fetch' | 'skills';
  message: string;
  data?: any;
}

type LogListener = (entry: LogEntry) => void;

class Logger {
  private listeners: LogListener[] = [];
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000; // Configurable max log limit

  log(entry: Omit<LogEntry, 'timestamp'>) {
    const fullEntry: LogEntry = {
      ...entry,
      timestamp: Date.now(),
    };
    
    // Add new log
    this.logs.push(fullEntry);
    
    // Maintain circular buffer behavior
    if (this.logs.length > this.maxLogs) {
      // Remove oldest logs to maintain size limit
      const excess = this.logs.length - this.maxLogs;
      this.logs.splice(0, excess);
    }
    
    // Notify listeners
    this.listeners.forEach(l => l(fullEntry));
  }

  info(category: LogEntry['category'], message: string, data?: any) {
    this.log({ level: 'info', category, message, data });
  }

  warn(category: LogEntry['category'], message: string, data?: any) {
    this.log({ level: 'warn', category, message, data });
  }

  error(category: LogEntry['category'], message: string, data?: any) {
    this.log({ level: 'error', category, message, data });
  }

  debug(category: LogEntry['category'], message: string, data?: any) {
    this.log({ level: 'debug', category, message, data });
  }

  subscribe(listener: LogListener) {
    this.listeners.push(listener);
    // Send only recent logs to new subscriber (last 100 entries to prevent memory spikes)
    const recentLogs = this.logs.slice(-100);
    recentLogs.forEach(l => listener({ ...l }));
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getLogs() {
    // Return cloned logs to prevent external mutation
    return this.logs.map(l => ({ ...l }));
  }

  setMaxLogs(max: number) {
    if (max < 100) {
      console.warn('Logger: maxLogs should be at least 100 for proper operation');
      max = 100;
    }
    this.maxLogs = max;
    
    // Trim existing logs if necessary
    if (this.logs.length > this.maxLogs) {
      const excess = this.logs.length - this.maxLogs;
      this.logs.splice(0, excess);
    }
  }

  getMaxLogs(): number {
    return this.maxLogs;
  }
}

export const logger = new Logger();
