/**
 * Generic handler manager to prevent memory leaks when swapping handlers.
 * Uses a stack-based approach to properly manage handler lifecycle.
 */

export class HandlerManager<T> {
    private handlers: T[] = [];
    private defaultHandler: T;
    
    constructor(defaultHandler: T) {
        this.defaultHandler = defaultHandler;
    }
    
    /**
     * Push a new handler onto the stack
     */
    push(handler: T): void {
        this.handlers.push(handler);
    }
    
    /**
     * Remove and return the current handler from the stack
     */
    pop(): T | undefined {
        return this.handlers.pop();
    }
    
    /**
     * Get the current active handler, or default if none are active
     */
    getCurrent(): T {
        return this.handlers[this.handlers.length - 1] ?? this.defaultHandler;
    }
    
    /**
     * Check if any handlers are stacked
     */
    hasHandlers(): boolean {
        return this.handlers.length > 0;
    }
    
    /**
     * Clear all handlers and reset to default
     */
    clear(): void {
        this.handlers = [];
    }

    /**
     * Get the default handler (the one provided during construction)
     */
    getDefault(): T {
        return this.defaultHandler;
    }
    
    /**
     * Get the number of active handlers
     */
    size(): number {
        return this.handlers.length;
    }
    
    /**
     * Execute a function with a temporary handler
     * Automatically restores the previous handler after completion
     */
    async withTemporaryHandler<R>(handler: T, fn: () => Promise<R>): Promise<R> {
        this.push(handler);
        try {
            return await fn();
        } finally {
            this.pop();
        }
    }
    
    /**
     * Execute a function with a temporary handler (synchronous version)
     */
    withTemporaryHandlerSync<R>(handler: T, fn: () => R): R {
        this.push(handler);
        try {
            return fn();
        } finally {
            this.pop();
        }
    }
}
