import { describe, it, expect, beforeEach } from 'vitest';
import { HandlerManager } from './handler-manager';

describe('HandlerManager', () => {
  let manager: HandlerManager<string>;

  beforeEach(() => {
    manager = new HandlerManager('default');
  });

  describe('constructor', () => {
    it('should initialize with default handler', () => {
      expect(manager.getCurrent()).toBe('default');
      expect(manager.hasHandlers()).toBe(false);
      expect(manager.size()).toBe(0);
    });
  });

  describe('push', () => {
    it('should add handler to stack', () => {
      manager.push('handler1');
      expect(manager.getCurrent()).toBe('handler1');
      expect(manager.hasHandlers()).toBe(true);
      expect(manager.size()).toBe(1);
    });

    it('should stack multiple handlers', () => {
      manager.push('handler1');
      manager.push('handler2');
      manager.push('handler3');
      
      expect(manager.getCurrent()).toBe('handler3');
      expect(manager.size()).toBe(3);
    });
  });

  describe('pop', () => {
    it('should remove and return top handler', () => {
      manager.push('handler1');
      manager.push('handler2');
      
      const popped = manager.pop();
      
      expect(popped).toBe('handler2');
      expect(manager.getCurrent()).toBe('handler1');
      expect(manager.size()).toBe(1);
    });

    it('should return undefined when popping from empty stack', () => {
      const popped = manager.pop();
      
      expect(popped).toBeUndefined();
      expect(manager.getCurrent()).toBe('default');
      expect(manager.size()).toBe(0);
    });

    it('should return to default when all handlers popped', () => {
      manager.push('handler1');
      manager.pop();
      
      expect(manager.getCurrent()).toBe('default');
      expect(manager.hasHandlers()).toBe(false);
    });
  });

  describe('getCurrent', () => {
    it('should return default when no handlers', () => {
      expect(manager.getCurrent()).toBe('default');
    });

    it('should return top handler when handlers exist', () => {
      manager.push('handler1');
      manager.push('handler2');
      
      expect(manager.getCurrent()).toBe('handler2');
    });

    it('should return previous handler after pop', () => {
      manager.push('handler1');
      manager.push('handler2');
      manager.pop();
      
      expect(manager.getCurrent()).toBe('handler1');
    });
  });

  describe('hasHandlers', () => {
    it('should return false when no handlers', () => {
      expect(manager.hasHandlers()).toBe(false);
    });

    it('should return true when handlers exist', () => {
      manager.push('handler1');
      expect(manager.hasHandlers()).toBe(true);
    });

    it('should return false when all handlers cleared', () => {
      manager.push('handler1');
      manager.clear();
      expect(manager.hasHandlers()).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all handlers', () => {
      manager.push('handler1');
      manager.push('handler2');
      manager.push('handler3');
      
      manager.clear();
      
      expect(manager.size()).toBe(0);
      expect(manager.hasHandlers()).toBe(false);
      expect(manager.getCurrent()).toBe('default');
    });
  });

  describe('size', () => {
    it('should return 0 when empty', () => {
      expect(manager.size()).toBe(0);
    });

    it('should return correct size with handlers', () => {
      manager.push('handler1');
      expect(manager.size()).toBe(1);
      
      manager.push('handler2');
      expect(manager.size()).toBe(2);
      
      manager.pop();
      expect(manager.size()).toBe(1);
    });
  });

  describe('withTemporaryHandler', () => {
    it('should execute function with temporary handler', async () => {
      const result = await manager.withTemporaryHandler('temp', async () => {
        expect(manager.getCurrent()).toBe('temp');
        return 'result';
      });

      expect(result).toBe('result');
      expect(manager.getCurrent()).toBe('default');
      expect(manager.size()).toBe(0);
    });

    it('should restore handler even if function throws', async () => {
      manager.push('existing');
      
      await expect(manager.withTemporaryHandler('temp', async () => {
        expect(manager.getCurrent()).toBe('temp');
        throw new Error('Test error');
      })).rejects.toThrow('Test error');

      expect(manager.getCurrent()).toBe('existing');
      expect(manager.size()).toBe(1);
    });

    it('should work with nested temporary handlers', async () => {
      const result = await manager.withTemporaryHandler('outer', async () => {
        expect(manager.getCurrent()).toBe('outer');
        
        return await manager.withTemporaryHandler('inner', async () => {
          expect(manager.getCurrent()).toBe('inner');
          return 'nested';
        });
      });

      expect(result).toBe('nested');
      expect(manager.getCurrent()).toBe('default');
      expect(manager.size()).toBe(0);
    });
  });

  describe('withTemporaryHandlerSync', () => {
    it('should execute function with temporary handler synchronously', () => {
      const result = manager.withTemporaryHandlerSync('temp', () => {
        expect(manager.getCurrent()).toBe('temp');
        return 'sync-result';
      });

      expect(result).toBe('sync-result');
      expect(manager.getCurrent()).toBe('default');
      expect(manager.size()).toBe(0);
    });

    it('should restore handler even if function throws', () => {
      manager.push('existing');
      
      expect(() => {
        manager.withTemporaryHandlerSync('temp', () => {
          expect(manager.getCurrent()).toBe('temp');
          throw new Error('Sync error');
        });
      }).toThrow('Sync error');

      expect(manager.getCurrent()).toBe('existing');
      expect(manager.size()).toBe(1);
    });

    it('should work with nested temporary sync handlers', () => {
      const result = manager.withTemporaryHandlerSync('outer', () => {
        expect(manager.getCurrent()).toBe('outer');
        
        return manager.withTemporaryHandlerSync('inner', () => {
          expect(manager.getCurrent()).toBe('inner');
          return 'nested-sync';
        });
      });

      expect(result).toBe('nested-sync');
      expect(manager.getCurrent()).toBe('default');
      expect(manager.size()).toBe(0);
    });
  });

  describe('complex scenarios', () => {
    it('should handle mixed push/pop and temporary operations', () => {
      manager.push('handler1');
      
      const result1 = manager.withTemporaryHandlerSync('temp1', () => {
        expect(manager.getCurrent()).toBe('temp1');
        return 'complex';
      });

      expect(result1).toBe('complex');
      // After temporary handler is popped, we should be back to handler1
      expect(manager.getCurrent()).toBe('handler1');
      expect(manager.size()).toBe(1);
      
      manager.pop();
      expect(manager.getCurrent()).toBe('default');
      expect(manager.size()).toBe(0);
    });

    it('should work with different handler types', () => {
      const fnManager = new HandlerManager<() => string>(() => 'default');
      
      const handler1 = () => 'handler1';
      const handler2 = () => 'handler2';
      
      fnManager.push(handler1);
      expect(fnManager.getCurrent()()).toBe('handler1');
      
      fnManager.push(handler2);
      expect(fnManager.getCurrent()()).toBe('handler2');
      
      fnManager.pop();
      expect(fnManager.getCurrent()()).toBe('handler1');
    });
  });
});
