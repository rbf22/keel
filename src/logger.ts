export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: 'llm' | 'python' | 'system';
  message: string;
  data?: any;
}

type LogListener = (entry: LogEntry) => void;

class Logger {
  private listeners: LogListener[] = [];
  private logs: LogEntry[] = [];

  log(entry: Omit<LogEntry, 'timestamp'>) {
    const fullEntry: LogEntry = {
      ...entry,
      timestamp: Date.now(),
    };
    this.logs.push(fullEntry);
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
    // Send existing logs to new subscriber
    this.logs.forEach(l => listener(l));
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getLogs() {
    return this.logs;
  }
}

export const logger = new Logger();
