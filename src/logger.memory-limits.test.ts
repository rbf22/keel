import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger } from './logger';

describe('Logger - Memory Limits', () => {
  beforeEach(() => {
    // Clear logs before each test
    const loggerAny = logger as any;
    loggerAny.logs = [];
  });

  it('should maintain default max logs limit', () => {
    const loggerAny = logger as any;
    expect(loggerAny.getMaxLogs()).toBe(1000);
  });

  it('should allow setting custom max logs', () => {
    const loggerAny = logger as any;
    loggerAny.setMaxLogs(500);
    expect(loggerAny.getMaxLogs()).toBe(500);
  });

  it('should enforce minimum limit of 100', () => {
    const loggerAny = logger as any;
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    loggerAny.setMaxLogs(50);
    expect(loggerAny.getMaxLogs()).toBe(100);
    expect(consoleSpy).toHaveBeenCalledWith('Logger: maxLogs should be at least 100 for proper operation');
    
    consoleSpy.mockRestore();
  });

  it('should trim old logs when exceeding max limit', () => {
    const loggerAny = logger as any;
    loggerAny.setMaxLogs(100); // Set to minimum allowed
    
    // Add 105 logs
    for (let i = 0; i < 105; i++) {
      logger.info('system', `message ${i}`);
    }
    
    const logs = logger.getLogs();
    expect(logs).toHaveLength(100);
    
    // Should keep the 100 most recent logs
    expect(logs[0].message).toBe('message 5');
    expect(logs[99].message).toBe('message 104');
  });

  it('should trim existing logs when reducing max limit', () => {
    const loggerAny = logger as any;
    
    // First increase limit to 200
    loggerAny.setMaxLogs(200);
    
    // Add 150 logs
    for (let i = 0; i < 150; i++) {
      logger.info('skills', `message ${i}`);
    }
    
    expect(loggerAny.getLogs()).toHaveLength(150);
    
    // Reduce limit to 100 (minimum)
    loggerAny.setMaxLogs(100);
    
    const logs = logger.getLogs();
    expect(logs).toHaveLength(100);
    
    // Should keep the 100 most recent logs
    expect(logs[0].message).toBe('message 50');
    expect(logs[99].message).toBe('message 149');
  });

  it('should notify listeners of all logs including during trimming', () => {
    const loggerAny = logger as any;
    const receivedLogs: any[] = [];
    
    loggerAny.setMaxLogs(100);
    
    // Subscribe to logs
    const unsubscribe = loggerAny.subscribe((log: any) => {
      receivedLogs.push(log);
    });
    
    // Add 105 logs
    for (let i = 0; i < 105; i++) {
      logger.info('system', `message ${i}`);
    }
    
    // Should receive all 105 logs despite trimming
    expect(receivedLogs).toHaveLength(105);
    
    unsubscribe();
  });

  it('should handle high log volume without memory issues', () => {
    const loggerAny = logger as any;
    loggerAny.setMaxLogs(100);
    
    const startTime = performance.now();
    
    // Add 10,000 logs
    for (let i = 0; i < 10000; i++) {
      logger.info('system', `message ${i}`, { data: `extra data ${i}` });
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should complete quickly (under 200ms for 10k logs)
    expect(duration).toBeLessThan(200);
    
    // Should maintain size limit
    expect(logger.getLogs()).toHaveLength(100);
    
    // Should keep most recent logs
    const logs = logger.getLogs();
    expect(logs[0].message).toBe('message 9900');
    expect(logs[99].message).toBe('message 9999');
  });

  it('should preserve log order when trimming', async () => {
    const loggerAny = logger as any;
    loggerAny.setMaxLogs(100); // Use minimum allowed value
    
    // Add logs with timestamps
    const timestamps: number[] = [];
    for (let i = 0; i < 105; i++) {
      logger.info('system', `message ${i}`);
      timestamps.push(Date.now());
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    const logs = logger.getLogs();
    
    // Logs should be in chronological order (newest last)
    for (let i = 0; i < logs.length - 1; i++) {
      expect(logs[i].timestamp).toBeLessThanOrEqual(logs[i + 1].timestamp);
    }
  });

  it('should handle different log levels with trimming', () => {
    const loggerAny = logger as any;
    loggerAny.setMaxLogs(100);
    
    // Add 105 logs with different levels
    for (let i = 0; i < 35; i++) {
      logger.info('system', `info ${i}`);
    }
    for (let i = 0; i < 35; i++) {
      logger.warn('system', `warn ${i}`);
    }
    for (let i = 0; i < 35; i++) {
      logger.error('system', `error ${i}`);
    }
    
    const logs = logger.getLogs();
    expect(logs).toHaveLength(100);
    
    // Should have trimmed from the start
    const infoLogs = logs.filter(l => l.level === 'info');
    const warnLogs = logs.filter(l => l.level === 'warn');
    const errorLogs = logs.filter(l => l.level === 'error');
    
    // First 5 info logs should be trimmed
    expect(infoLogs.length).toBe(30);
    expect(warnLogs.length).toBe(35);
    expect(errorLogs.length).toBe(35);
    
    // Verify the oldest log is from info level
    expect(logs[0].level).toBe('info');
    expect(logs[0].message).toBe('info 5');
  });
});
