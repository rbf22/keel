/**
 * Promise-based wrapper for IndexedDB operations to prevent race conditions
 * and provide proper error handling.
 */

import { VFSFile } from "../types";
import { logger } from "../logger";

/**
 * Interface for storage objects that have an IndexedDB database
 */
export interface StorageWithDB {
    init(): Promise<void>;
    listFiles(): Promise<string[]>;
    readFile(path: string, level?: number): Promise<string | null>;
    writeFile(path: string, content: string, l0?: number, l1?: number): Promise<void>;
    addMemory(category: string, content: string, tags?: string[]): Promise<void>;
    db: IDBDatabase;
}

/**
 * Type guard to check if storage has an accessible database
 */
export function isStorageWithDB(obj: unknown): obj is { db: IDBDatabase } & Record<string, unknown> {
    return !!obj && 
           typeof obj === 'object' && 
           'db' in obj && 
           (obj as { db: unknown }).db instanceof IDBDatabase;
}

export class IndexedDBWrapper {
    /**
     * Safely get file details from IndexedDB with proper error handling
     */
    static async getFileDetails(db: IDBDatabase, path: string): Promise<VFSFile | null> {
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction(["vfs"], "readonly");
                const store = transaction.objectStore("vfs");
                const request = store.get(path);
                
                request.onsuccess = () => {
                    resolve(request.result || null);
                };
                
                request.onerror = () => {
                    reject(new Error(`Failed to get file ${path}: ${request.error?.message || 'Unknown error'}`));
                };
                
                // Handle transaction errors
                transaction.onerror = () => {
                    reject(new Error(`Transaction failed for file ${path}: ${transaction.error?.message || 'Unknown error'}`));
                };
            } catch (error) {
                reject(new Error(`Failed to create transaction for file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });
    }
    
    /**
     * Get multiple files in parallel while maintaining order
     */
    static async getMultipleFiles(db: IDBDatabase, paths: string[]): Promise<Array<{ path: string; file: VFSFile | null }>> {
        const filePromises = paths.map(async (path) => {
            try {
                const file = await this.getFileDetails(db, path);
                return { path, file };
            } catch (error) {
                // Log error but don't fail the entire operation
                logger.error('storage', `Failed to get file ${path}`, { error });
                return { path, file: null };
            }
        });
        
        return Promise.all(filePromises);
    }
    
    /**
     * Check if database is healthy and accessible
     */
    static async checkDatabaseHealth(db: IDBDatabase): Promise<boolean> {
        try {
            const transaction = db.transaction(["vfs"], "readonly");
            const store = transaction.objectStore("vfs");
            const request = store.count();
            
            return new Promise((resolve) => {
                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
                transaction.onerror = () => resolve(false);
            });
        } catch {
            return false;
        }
    }
}
