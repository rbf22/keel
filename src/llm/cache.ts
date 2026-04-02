import { logger } from "../logger";

// Track cached model sizes reported by WebLLM during loading
const cachedModelSizes = new Map<string, number>();

// Track active downloads/initialization progress
export interface DownloadProgress {
  modelId: string;
  status: string;
  startTime: number;
}

const activeDownloads = new Map<string, DownloadProgress>();

export function registerDownload(modelId: string, status: string = 'Starting...'): void {
  activeDownloads.set(modelId, {
    modelId,
    status,
    startTime: Date.now()
  });
}

export function updateDownloadProgress(modelId: string, status: string): void {
  const download = activeDownloads.get(modelId);
  if (download) {
    download.status = status;
  } else {
    registerDownload(modelId, status);
  }
}

export function unregisterDownload(modelId: string): void {
  activeDownloads.delete(modelId);
}

export function getActiveDownloads(): DownloadProgress[] {
  return Array.from(activeDownloads.values());
}

export function getCachedModelSizeFromWebLLM(modelId: string): number {
  return cachedModelSizes.get(modelId) || 0;
}

export function setCachedModelSizeFromWebLLM(modelId: string, sizeBytes: number): void {
  cachedModelSizes.set(modelId, sizeBytes);
}

// Helper to recursively calculate size of nested objects
export function calculateSize(value: unknown): number {
  if (value === null || value === undefined) return 0;
  
  if (value instanceof ArrayBuffer || (typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer)) {
    return value.byteLength;
  }
  
  if (ArrayBuffer.isView(value)) {
    return value.byteLength;
  }

  if (value instanceof Blob) {
    return value.size;
  }
  
  if (typeof value === 'string') {
    return value.length * 2;
  }
  
  if (typeof value === 'number') {
    return 8;
  }
  
  if (typeof value === 'boolean') {
    return 4;
  }
  
  if (Array.isArray(value)) {
    // For large arrays, just sample or check types
    if (value.length > 100) {
        return value.length * 8; // Estimate
    }
    return value.reduce((sum, item) => sum + calculateSize(item), 0);
  }
  
  if (typeof value === 'object') {
    let size = 0;
    const kv = value as Record<string, unknown>;
    
    // Optimized check for common MLC/WebLLM structures
    if (kv.buffer && (kv.buffer instanceof ArrayBuffer || (typeof SharedArrayBuffer !== 'undefined' && kv.buffer instanceof SharedArrayBuffer))) {
        return kv.buffer.byteLength;
    }

    // Limit complexity for large objects to avoid hangs
    const keys = Object.keys(kv);
    for (let i = 0; i < Math.min(keys.length, 50); i++) {
        const key = keys[i];
        size += key.length * 2;
        size += calculateSize(kv[key]);
    }
    return size;
  }
  
  return 0;
}

export async function getIndexedDBSizeStatic(dbName: string): Promise<number> {
  return new Promise((resolve) => {
    let timeoutId: any;
    const request = indexedDB.open(dbName);
    
    request.onsuccess = () => {
      const db = request.result;
      const storeNames = Array.from(db.objectStoreNames);
      
      if (storeNames.length === 0) {
        db.close();
        if (timeoutId) clearTimeout(timeoutId);
        resolve(0);
        return;
      }
      
      const checkStore = (storeName: string) => {
        return new Promise<number>((storeResolve) => {
          try {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            let storeSize = 0;
            
            // For WebLLM, many stores are small metadata. The binary data is usually in 'data' or similar.
            // If the store is huge, iterate only a few items to estimate if we must, 
            // but usually we want a reasonably accurate total if possible.
            const cursorRequest = store.openCursor();
            
            cursorRequest.onsuccess = (event) => {
              const cursor = (event.target as IDBRequest).result;
              if (cursor) {
                storeSize += calculateSize(cursor.value);
                
                // If we've already found > 500MB, it's a large model, we can stop for performance
                // while still returning a valid large number.
                if (storeSize > 500 * 1024 * 1024) { 
                    storeResolve(storeSize);
                } else {
                    cursor.continue();
                }
              } else {
                storeResolve(storeSize);
              }
            };
            
            cursorRequest.onerror = () => storeResolve(0);
          } catch (e) {
            storeResolve(0);
          }
        });
      };
      
      Promise.all(storeNames.map(checkStore)).then((sizes) => {
        const totalSize = sizes.reduce((sum, s) => sum + s, 0);
        db.close();
        if (timeoutId) clearTimeout(timeoutId);
        resolve(totalSize);
      }).catch(() => {
        db.close();
        if (timeoutId) clearTimeout(timeoutId);
        resolve(0);
      });
    };
    
    request.onerror = () => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(0);
    };
    timeoutId = setTimeout(() => resolve(-1), 2000); // Return -1 on timeout to indicate "unknown but exists"
  });
}

export async function clearAllCachedModels(): Promise<void> {
  try {
    if (typeof indexedDB === 'undefined') {
      logger.warn("llm", "IndexedDB not available");
      return;
    }
    
    const databases = await indexedDB.databases();
    const webLLmDBs = databases.filter(db => db.name && db.name.startsWith('webllm:'));
    
    for (const db of webLLmDBs) {
      if (db.name) {
        await indexedDB.deleteDatabase(db.name);
        logger.info("llm", `Deleted IndexedDB: ${db.name}`);
      }
    }
    
    logger.info("llm", `Cleared ${webLLmDBs.length} cached model(s) from IndexedDB`);
  } catch (error) {
    logger.error("llm", "Failed to clear all cached models", { error });
    throw error;
  }
}

export async function getAllCachedModels(): Promise<Array<{modelId: string, size: number, isCorrupted?: boolean, isEmpty?: boolean, isDownloading?: boolean, status?: string}>> {
  try {
    if (typeof indexedDB === 'undefined') {
      logger.warn("llm", "IndexedDB not available");
      return [];
    }
    
    const databases = await indexedDB.databases();
    const webLLmDBs = databases.filter(db => db.name && db.name.startsWith('webllm:'));
    const models = [];
    const processedModelIds = new Set<string>();
    
    // First, add active downloads
    for (const download of activeDownloads.values()) {
      models.push({
        modelId: download.modelId,
        size: 0,
        isDownloading: true,
        status: download.status
      });
      processedModelIds.add(download.modelId);
    }
    
    for (const dbInfo of webLLmDBs) {
      const dbName = dbInfo.name!;
      const modelId = dbName.replace('webllm:', '');
      
      // Skip if already in list (e.g. if it's both downloading and has some data in IDB)
      if (processedModelIds.has(modelId)) continue;
      
      let size = getCachedModelSizeFromWebLLM(modelId);
      let calculationTimedOut = false;

      if (size === 0) {
        const measuredSize = await getIndexedDBSizeStatic(dbName);
        if (measuredSize === -1) {
            calculationTimedOut = true;
            size = 0;
        } else {
            size = measuredSize;
        }
      }
      
      const isCorrupted = size > 0 && size < 1024 * 1024;
      // If we timed out but the DB exists, it's NOT empty.
      // If size is 0 and we didn't timeout, it might be truly empty.
      const isEmpty = size === 0 && !calculationTimedOut;
      
      models.push({ modelId, size, isCorrupted, isEmpty });
      processedModelIds.add(modelId);
    }
    
    return models;
  } catch (error) {
    logger.error("llm", "Failed to get all cached models", { error });
    return [];
  }
}
