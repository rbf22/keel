import { logger } from "../logger";

// Track cached model sizes reported by WebLLM during loading
const cachedModelSizes = new Map<string, number>();

// Cache for getAllCachedModels results to prevent redundant queries
let modelsCache: Array<{modelId: string, size: number, isCorrupted?: boolean, isEmpty?: boolean, isDownloading?: boolean, status?: string}> | null = null;
let modelsCacheTimestamp = 0;
const MODELS_CACHE_TTL = 5000; // 5 seconds cache TTL

// Track active downloads/initialization progress
export interface DownloadProgress {
  modelId: string;
  status: string;
  startTime: number;
}

const activeDownloads = new Map<string, DownloadProgress>();

export function registerDownload(modelId: string, status: string = 'Starting...'): void {
  console.log(`📥 Registering download: ${modelId} - ${status}`);
  activeDownloads.set(modelId, {
    modelId,
    status,
    startTime: Date.now()
  });
  
  // Invalidate models cache to force refresh
  modelsCache = null;
  modelsCacheTimestamp = 0;
}

export function updateDownloadProgress(modelId: string, status: string): void {
  console.log(`📈 Updating download progress: ${modelId} - ${status}`);
  const download = activeDownloads.get(modelId);
  if (download) {
    download.status = status;
  } else {
    console.log(`📥 Auto-registering download for: ${modelId}`);
    registerDownload(modelId, status);
  }
}

// Track callbacks for when downloads complete
const downloadCompleteCallbacks: Array<() => void> = [];

export function onDownloadComplete(callback: () => void): void {
  downloadCompleteCallbacks.push(callback);
}

export function unregisterDownload(modelId: string): void {
  const wasDownloading = activeDownloads.has(modelId);
  activeDownloads.delete(modelId);
  
  // Invalidate the models cache when a download completes to force refresh
  modelsCache = null;
  modelsCacheTimestamp = 0;
  
  // If this was the last active download, trigger callbacks
  if (wasDownloading && activeDownloads.size === 0) {
    downloadCompleteCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in download complete callback:', error);
      }
    });
  }
}

export function invalidateModelsCache(): void {
  modelsCache = null;
  modelsCacheTimestamp = 0;
  logger.debug("llm", "Models cache invalidated");
}

export function getActiveDownloads(): DownloadProgress[] {
  return Array.from(activeDownloads.values());
}

export function getCachedModelSizeFromWebLLM(modelId: string): number {
  return cachedModelSizes.get(modelId) || 0;
}

export function setCachedModelSizeFromWebLLM(modelId: string, sizeBytes: number): void {
  cachedModelSizes.set(modelId, sizeBytes);
  // Invalidate models cache when size changes
  modelsCache = null;
  modelsCacheTimestamp = 0;
}

// Cache for model sizes to avoid repeated calculations
const modelSizeCache = new Map<string, number>();

// Helper function to get actual model size from webllm/model/urls table (optimized)
async function getModelSizeFromWebLLMTable(modelId: string): Promise<number> {
  // Check cache first
  if (modelSizeCache.has(modelId)) {
    return modelSizeCache.get(modelId)!;
  }
  
  try {
    const dbName = 'webllm/model';
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    
    const transaction = db.transaction(['urls'], 'readonly');
    const store = transaction.objectStore('urls');
    
    // Use cursor instead of getAll() to avoid loading all entries into memory
    const totalSize = await new Promise<number>((resolve, reject) => {
      let size = 0;
      const modelSearchTerm = modelId.replace('-MLC', '');
      
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const entry = cursor.value;
          const url = entry.url || '';
          
          // Only calculate size for entries matching this model
          if (url.includes(modelSearchTerm)) {
            const entrySize = calculateSize(entry);
            size += entrySize;
          }
          
          cursor.continue();
        } else {
          // Cursor finished
          resolve(size);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
    
    db.close();
    
    // Cache the result
    modelSizeCache.set(modelId, totalSize);
    return totalSize;
    
  } catch (error) {
    logger.warn("llm", "Error getting size from WebLLM table", { 
      modelId, 
      error: error instanceof Error ? error.message : String(error)
    });
    return 0;
  }
}


// Helper to recursively calculate size of nested objects
export function calculateSize(value: unknown): number {
  if (value === null || value === undefined) return 0;
  
  // Fast path for WebLLM data objects
  if (typeof value === 'object' && value !== null) {
    const kv = value as Record<string, unknown>;
    
    // WebLLM stores data in a 'data' property as ArrayBuffer/Uint8Array
    if (kv.data && (kv.data instanceof ArrayBuffer || kv.data instanceof Uint8Array)) {
      return kv.data.byteLength || 0;
    }
    
    // Also check for 'buffer' property
    if (kv.buffer && (kv.buffer instanceof ArrayBuffer || kv.buffer instanceof Uint8Array)) {
      return kv.buffer.byteLength || 0;
    }
  }
  
  // Fallback to standard size calculation
  if (value instanceof ArrayBuffer) {
    return value.byteLength;
  }
  
  if (value instanceof Uint8Array || value instanceof Int8Array || 
      value instanceof Uint16Array || value instanceof Int16Array ||
      value instanceof Uint32Array || value instanceof Int32Array) {
    return value.length * value.BYTES_PER_ELEMENT;
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
  
  // For arrays, estimate if large to avoid slow processing
  if (Array.isArray(value)) {
    return value.length * 8; // Simple estimate for arrays
  }
  
  // For objects, limit complexity to avoid hangs
  if (typeof value === 'object' && value !== null) {
    let size = 0;
    const kv = value as Record<string, unknown>;
    const keys = Object.keys(kv);
    
    // Limit to first 10 keys for performance
    for (let i = 0; i < Math.min(keys.length, 10); i++) {
      const key = keys[i];
      size += key.length * 2;
      // Don't recurse deeply for performance
      if (typeof kv[key] === 'string') {
        size += (kv[key] as string).length * 2;
      } else if (typeof kv[key] === 'number') {
        size += 8;
      }
    }
    
    return size;
  }
  
  return 0;
}

// Helper function to get actual model size from WebLLM cache
function getActualModelSize(modelId: string): number {
  // First try to get from WebLLM cache (set during model loading)
  const cachedSize = getCachedModelSizeFromWebLLM(modelId);
  if (cachedSize > 0) {
    return cachedSize;
  }
  
  // If not cached, return 0 - we'll measure it properly in getIndexedDBSizeStatic
  return 0;
}

// Helper function to get actual database size by measuring all objects
async function getActualDatabaseSize(dbName: string): Promise<number> {
  console.log(`🔍 Measuring database size: ${dbName}`);
  
  return new Promise((resolve) => {
    const request = indexedDB.open(dbName);
    
    request.onsuccess = () => {
      const db = request.result;
      const storeNames = Array.from(db.objectStoreNames);
      
      console.log(`📋 Database ${dbName} has stores: ${storeNames.join(', ')}`);
      
      if (storeNames.length === 0) {
        console.log(`⚠️ No object stores found for ${dbName}, trying alternative methods`);
        
        // WebLLM databases might not have visible stores but still contain data
        // Try to access any possible stores or use alternative methods
        try {
          // Method 1: Try to create a transaction to see if there's hidden data
          const transaction = db.transaction(db.objectStoreNames || [], 'readonly');
          
          // Method 2: Try to iterate through all possible store names
          const possibleStoreNames = ['data', 'model', 'weights', 'tensors', 'binary', 'cache', 'storage', 'urls'];
          
          console.log(`🔍 Trying possible store names: ${possibleStoreNames.join(', ')}`);
          
          const checkStore = (storeName: string) => {
            return new Promise<number>((storeResolve) => {
              try {
                if (!db.objectStoreNames.contains(storeName)) {
                  console.log(`❌ Store ${storeName} not found`);
                  storeResolve(0);
                  return;
                }
                
                console.log(`✅ Found store: ${storeName}`);
                const store = transaction.objectStore(storeName);
                let storeSize = 0;
                
                const cursorRequest = store.openCursor();
                
                cursorRequest.onsuccess = (event) => {
                  const cursor = (event.target as IDBRequest).result;
                  if (cursor) {
                    // Calculate size of the value
                    const value = cursor.value;
                    if (value) {
                      if (value instanceof ArrayBuffer) {
                        storeSize += value.byteLength;
                      } else if (value instanceof Uint8Array) {
                        storeSize += value.length;
                      } else if (value instanceof Blob) {
                        storeSize += value.size;
                      } else {
                        // For objects/strings, estimate size
                        storeSize += JSON.stringify(value).length * 2; // UTF-16
                      }
                    }
                    cursor.continue();
                  } else {
                    console.log(`📊 Store ${storeName} size: ${storeSize} bytes`);
                    storeResolve(storeSize);
                  }
                };
                
                cursorRequest.onerror = () => {
                  console.log(`❌ Error accessing store ${storeName}`);
                  storeResolve(0);
                };
              } catch (error) {
                console.log(`❌ Error checking store ${storeName}: ${error}`);
                storeResolve(0);
              }
            });
          };
          
          // Check all possible stores
          const storePromises = possibleStoreNames.map(checkStore);
          
          Promise.all(storePromises).then(sizes => {
            const total = sizes.reduce((sum, size) => sum + size, 0);
            console.log(`📊 Total size for ${dbName}: ${total} bytes`);
            db.close();
            resolve(total);
          }).catch((error) => {
            console.log(`❌ Error measuring stores: ${error}`);
            db.close();
            resolve(0);
          });
          
        } catch (error) {
          console.log(`❌ Error in alternative measurement: ${error}`);
          db.close();
          resolve(0);
        }
      } else {
        console.log(`✅ Found ${storeNames.length} stores, measuring normally`);
        // Traditional approach for databases with visible stores
        const transaction = db.transaction(storeNames, 'readonly');
        
        const checkStore = (storeName: string) => {
          return new Promise<number>((storeResolve) => {
            try {
              const store = transaction.objectStore(storeName);
              let storeSize = 0;
              
              const cursorRequest = store.openCursor();
              
              cursorRequest.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor) {
                  const value = cursor.value;
                  if (value) {
                    if (value instanceof ArrayBuffer) {
                      storeSize += value.byteLength;
                    } else if (value instanceof Uint8Array) {
                      storeSize += value.length;
                    } else if (value instanceof Blob) {
                      storeSize += value.size;
                    } else {
                      storeSize += JSON.stringify(value).length * 2;
                    }
                  }
                  cursor.continue();
                } else {
                  console.log(`📊 Store ${storeName} size: ${storeSize} bytes`);
                  storeResolve(storeSize);
                }
              };
              
              cursorRequest.onerror = () => {
                console.log(`❌ Error accessing store ${storeName}`);
                storeResolve(0);
              };
            } catch (error) {
              console.log(`❌ Error checking store ${storeName}: ${error}`);
              storeResolve(0);
            }
          });
        };
        
        const storePromises = storeNames.map(checkStore);
        
        Promise.all(storePromises).then(sizes => {
          const total = sizes.reduce((sum, size) => sum + size, 0);
          console.log(`📊 Total size for ${dbName}: ${total} bytes`);
          db.close();
          resolve(total);
        }).catch((error) => {
          console.log(`❌ Error measuring stores: ${error}`);
          db.close();
          resolve(0);
        });
      }
    };
    
    request.onerror = () => {
      console.log(`❌ Error opening database ${dbName}`);
      resolve(0);
    };
  });
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
        
        // For WebLLM model databases, they might not have traditional object stores
        // but still contain model data. Use a different approach.
        if (dbName.startsWith('webllm:') && dbName.includes('-MLC')) {
          // This is likely a model database - return 0 to trigger fallback logic
          // The actual size measurement will happen in the calling function
          resolve(0);
        } else {
          resolve(0);
        }
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
      try {
        await indexedDB.deleteDatabase(db.name!);
        logger.info("llm", `Deleted cached model database: ${db.name}`);
      } catch (error) {
        logger.error("llm", `Failed to delete cached model database: ${db.name}`, { error });
      }
    }
    
    // Also clear from ModelStorage
    const { modelStorage } = await import("../storage/models");
    const allModels = await modelStorage.getAllModels();
    for (const model of allModels) {
      try {
        await modelStorage.deleteModel(model.modelId);
      } catch (error) {
        logger.error("llm", `Failed to delete model from storage: ${model.modelId}`, { error });
      }
    }
    
    logger.info("llm", "All cached models cleared");
  } catch (error) {
    logger.error("llm", "Failed to clear all cached models", { error });
    throw error;
  }
}

export async function clearCachedModel(modelId: string): Promise<void> {
  try {
    if (typeof indexedDB === 'undefined') {
      logger.warn("llm", "IndexedDB not available");
      return;
    }
    
    const dbName = `webllm:${modelId}`;
    await indexedDB.deleteDatabase(dbName);
    logger.info("llm", `Deleted cached model database: ${dbName}`);
    
    // Also clear from ModelStorage
    const { modelStorage } = await import("../storage/models");
    await modelStorage.deleteModel(modelId);
    
    logger.info("llm", `Cached model cleared: ${modelId}`);
  } catch (error) {
    logger.error("llm", `Failed to clear cached model: ${modelId}`, { error });
    throw error;
  }
}

export async function getAllCachedModels(): Promise<Array<{modelId: string, size: number, isCorrupted?: boolean, isEmpty?: boolean, isDownloading?: boolean, status?: string}>> {
  const now = Date.now();
  
  // Return cached result if still valid
  if (modelsCache && (now - modelsCacheTimestamp) < MODELS_CACHE_TTL) {
    logger.debug("llm", "Returning cached models result", { 
      cacheAge: now - modelsCacheTimestamp,
      modelCount: modelsCache.length 
    });
    return modelsCache;
  }

  console.log("🔍 getAllCachedModels called (cache miss or expired)");
  try {
    if (typeof indexedDB === 'undefined') {
      logger.warn("llm", "IndexedDB not available");
      return [];
    }
    
    const databases = await indexedDB.databases();
    logger.debug("llm", "Found databases", { databases: databases.map(db => ({ name: db.name, version: db.version })) });
    
    const webLLmDBs = databases.filter(db => db.name && db.name.startsWith('webllm:'));
    logger.debug("llm", "WebLLM databases found", { count: webLLmDBs.length, databases: webLLmDBs.map(db => db.name) });
    
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
    
    // Check for models in webllm/model database (where actual model data is stored) - OPTIMIZED
    if (databases.some(db => db.name === 'webllm/model')) {
      logger.debug("llm", "Found webllm/model database, checking for models");
      
      try {
        const modelDb = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('webllm/model');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        
        const transaction = modelDb.transaction(['urls'], 'readonly');
        const store = transaction.objectStore('urls');
        
        // Use cursor instead of getAll() for better performance
        const modelIdsFromUrls = new Set<string>();
        
        await new Promise<void>((resolve, reject) => {
          const request = store.openCursor();
          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
              const entry = cursor.value;
              const url = entry.url || '';
              // Extract model ID from URL patterns
              const match = url.match(/mlc-ai\/([^\/]+)-MLC/);
              if (match) {
                modelIdsFromUrls.add(match[1] + '-MLC');
              }
              cursor.continue();
            } else {
              resolve();
            }
          };
          request.onerror = () => reject(request.error);
        });
        
        logger.debug("llm", "Found model IDs in webllm/model", { modelIds: Array.from(modelIdsFromUrls) });
        
        // Add models found in webllm/model database
        for (const modelId of modelIdsFromUrls) {
          if (!processedModelIds.has(modelId)) {
            // Get size from cache first, then calculate if needed
            let size = getCachedModelSizeFromWebLLM(modelId);
            
            if (size === 0) {
              // Calculate size for this model from the webllm/model table
              size = await getModelSizeFromWebLLMTable(modelId);
              
              // Cache the size for future use
              if (size > 0) {
                setCachedModelSizeFromWebLLM(modelId, size);
              }
            }
            
            logger.debug("llm", "Model from webllm/model table", { 
              modelId, 
              sizeMB: (size / 1024 / 1024).toFixed(2)
            });
            
            const isCorrupted = size > 0 && size < 1024 * 1024;
            const isEmpty = size === 0;
            
            models.push({ modelId, size, isCorrupted, isEmpty });
            processedModelIds.add(modelId);
          }
        }
        
        modelDb.close();
        
      } catch (error) {
        logger.warn("llm", "Error checking webllm/model database", { error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    // Also check legacy webllm: databases (for compatibility)
    for (const dbInfo of webLLmDBs) {
      const dbName = dbInfo.name!;
      const modelId = dbName.replace('webllm:', '');
      
      logger.debug("llm", "Processing legacy database", { dbName, modelId });
      
      // Skip if already in list (e.g. if it's both downloading and has some data in IDB)
      if (processedModelIds.has(modelId)) {
        logger.debug("llm", "Skipping already processed model", { modelId });
        continue;
      }
      
      let size = getActualModelSize(modelId);
      let calculationTimedOut = false;

      logger.debug("llm", "Model size from WebLLM cache", { modelId, size });

      if (size === 0) {
        logger.debug("llm", "Calculating IndexedDB size", { modelId, dbName });
        const measuredSize = await getIndexedDBSizeStatic(dbName);
        logger.debug("llm", "Measured IndexedDB size", { modelId, measuredSize });
        
        // If measured size is 0 and it's a WebLLM model database, use actual measurement
        if (measuredSize === 0 && dbName.startsWith('webllm:') && dbName.includes('-MLC')) {
          const actualSize = await getActualDatabaseSize(dbName);
          logger.debug("llm", "Using actual database size measurement", { modelId, actualSize });
          
          // Cache the actual size
          if (actualSize > 0) {
            setCachedModelSizeFromWebLLM(modelId, actualSize);
          }
          
          size = actualSize;
        } else {
          if (measuredSize === -1) {
            calculationTimedOut = true;
            size = 0;
          } else {
            size = measuredSize;
          }
        }
      }
      
      const isCorrupted = size > 0 && size < 1024 * 1024;
      // If we timed out but the DB exists, it's NOT empty.
      // If size is 0 and we didn't timeout, it might be truly empty.
      const isEmpty = size === 0 && !calculationTimedOut;
      
      logger.debug("llm", "Legacy model analysis complete", { 
        modelId, 
        size, 
        sizeMB: (size / 1024 / 1024).toFixed(2),
        isCorrupted, 
        isEmpty,
        calculationTimedOut 
      });
      
      models.push({ modelId, size, isCorrupted, isEmpty });
      processedModelIds.add(modelId);
    }
    
    logger.debug("llm", "Final models result", { 
      totalModels: models.length, 
      models: models.map(m => ({ 
        modelId: m.modelId, 
        sizeMB: (m.size / 1024 / 1024).toFixed(2),
        isCorrupted: m.isCorrupted,
        isEmpty: m.isEmpty,
        isDownloading: m.isDownloading 
      }))
    });
    
    // Cache the result
    modelsCache = models;
    modelsCacheTimestamp = now;
    
    return models;
  } catch (error) {
    logger.error("llm", "Failed to get all cached models", { error });
    return [];
  }
}
