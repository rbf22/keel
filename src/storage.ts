import { logger } from "./logger";
import { VFSFile, MemoryCategory, AgentMemory } from "./types";

export class KeelStorage {
  private dbName = "keel-storage";
  private dbVersion = 2; // Bumped version
  private db: IDBDatabase | null = null;

  async init() {
    logger.info("storage", "[INIT] Starting IndexedDB initialization", {
      dbName: this.dbName,
      version: this.dbVersion,
      timestamp: new Date().toISOString()
    });

    // Check if already initialized
    if (this.db) {
      logger.warn("storage", "[INIT] Database already initialized", {
        dbName: this.dbName
      });
      return;
    }

    // Check for existing database and its version
    try {
      logger.debug("storage", "[INIT] Checking existing database versions");
      const databases = await indexedDB.databases();
      const existingDb = databases.find(db => db.name === this.dbName);
      
      logger.info("storage", "[INIT] Existing database check", {
        dbName: this.dbName,
        existingDb: existingDb ? {
          name: existingDb.name,
          version: existingDb.version
        } : null,
        currentVersion: this.dbVersion
      });
    } catch (error) {
      logger.warn("storage", "[INIT] Failed to check existing databases", {
        error: error,
        errorType: error?.constructor?.name
      });
    }

    return new Promise<void>((resolve, reject) => {
      logger.debug("storage", "[INIT] Opening IndexedDB connection", {
        dbName: this.dbName,
        version: this.dbVersion
      });

      const request = indexedDB.open(this.dbName, this.dbVersion);

      // Track timing
      const openStartTime = Date.now();

      request.onerror = () => {
        const duration = Date.now() - openStartTime;
        const error = request.error;
        logger.error("storage", "[INIT] Failed to open database", {
          error: error,
          errorCode: error?.name,
          duration: duration,
          dbName: this.dbName
        });
        reject(error);
      };

      request.onblocked = () => {
        logger.warn("storage", "[INIT] Database open blocked", {
          dbName: this.dbName,
          version: this.dbVersion,
          duration: Date.now() - openStartTime
        });
      };

      request.onsuccess = () => {
        const duration = Date.now() - openStartTime;
        this.db = request.result;
        
        logger.info("storage", "[INIT] Database opened successfully", {
          dbName: this.dbName,
          version: this.dbVersion,
          duration: duration,
          objectStoreNames: Array.from(this.db.objectStoreNames)
        });

        // Verify required object stores exist
        const requiredStores = ['vfs', 'memories', 'skills'];
        const missingStores = requiredStores.filter(store => !this.db!.objectStoreNames.contains(store));
        
        if (missingStores.length > 0) {
          logger.error("storage", "[INIT] Missing required object stores", {
            dbName: this.dbName,
            missingStores: missingStores,
            existingStores: Array.from(this.db!.objectStoreNames)
          });
          reject(new Error(`Missing object stores: ${missingStores.join(', ')}`));
          return;
        }

        logger.info("storage", "[INIT] All required object stores verified", {
          dbName: this.dbName,
          stores: requiredStores
        });

        // Set up error handler for the database
        this.db.onerror = (event) => {
          logger.error("storage", "[DB_ERROR] Database error", {
            dbName: this.dbName,
            error: (event.target as IDBRequest)?.error,
            type: event.type
          });
        };

        resolve();
      };

      request.onupgradeneeded = (event) => {
        const duration = Date.now() - openStartTime;
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;
        const newVersion = event.newVersion;
        
        logger.info("storage", "[INIT] Database upgrade needed", {
          dbName: this.dbName,
          oldVersion: oldVersion,
          newVersion: newVersion,
          duration: duration
        });

        // VFS Store
        if (!db.objectStoreNames.contains("vfs")) {
          logger.info("storage", "[INIT] Creating VFS store", {
            dbName: this.dbName
          });
          db.createObjectStore("vfs", { keyPath: "path" });
        } else {
          logger.debug("storage", "[INIT] VFS store already exists", {
            dbName: this.dbName
          });
        }

        // Memories Store
        if (!db.objectStoreNames.contains("memories")) {
          logger.info("storage", "[INIT] Creating memories store with index", {
            dbName: this.dbName
          });
          const memoryStore = db.createObjectStore("memories", { keyPath: "id", autoIncrement: true });
          memoryStore.createIndex("category", "category", { unique: false });
        } else {
          logger.debug("storage", "[INIT] Memories store exists, checking index", {
            dbName: this.dbName
          });
          // Update memories if needed
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          const memoryStore = transaction.objectStore("memories");
          if (!memoryStore.indexNames.contains("category")) {
            logger.info("storage", "[INIT] Adding category index to memories store", {
              dbName: this.dbName
            });
            memoryStore.createIndex("category", "category", { unique: false });
          }
        }

        // Skills Store
        if (!db.objectStoreNames.contains("skills")) {
          logger.info("storage", "[INIT] Creating skills store", {
            dbName: this.dbName
          });
          db.createObjectStore("skills", { keyPath: "id" });
        } else {
          logger.debug("storage", "[INIT] Skills store already exists", {
            dbName: this.dbName
          });
        }

        logger.info("storage", "[INIT] Database upgrade complete", {
          dbName: this.dbName,
          finalVersion: newVersion,
          objectStoreNames: Array.from(db.objectStoreNames)
        });
      };
    });
  }

  // VFS Methods with keel:// support
  private normalizePath(path: string): string {
    if (path.startsWith("keel://")) return path;
    if (path.startsWith("/")) return `keel:/${path}`;
    return `keel://resources/${path}`;
  }

  async writeFile(path: string, content: string, l0?: string, l1?: string, mimeType = "text/plain", metadata = {}) {
    if (!this.db) throw new Error("Storage not initialized");
    const fullPath = this.normalizePath(path);
    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(["vfs"], "readwrite");
      const store = transaction.objectStore("vfs");
      const file: VFSFile = {
        path: fullPath,
        content,
        l0,
        l1,
        mimeType,
        metadata,
        updatedAt: Date.now(),
      };
      const request = store.put(file);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async readFile(path: string, level: 'L0' | 'L1' | 'L2' = 'L2'): Promise<string | null> {
    if (!this.db) throw new Error("Storage not initialized");
    const fullPath = this.normalizePath(path);
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["vfs"], "readonly");
      const store = transaction.objectStore("vfs");
      const request = store.get(fullPath);
      request.onsuccess = () => {
        const file = request.result as VFSFile;
        if (!file) {
            resolve(null);
            return;
        }
        if (level === 'L0') resolve(file.l0 || file.content.substring(0, 100));
        else if (level === 'L1') resolve(file.l1 || file.content.substring(0, 2000));
        else resolve(file.content);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFile(path: string): Promise<boolean> {
    if (!this.db) throw new Error("Storage not initialized");
    const fullPath = this.normalizePath(path);
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["vfs"], "readwrite");
      const store = transaction.objectStore("vfs");
      const request = store.delete(fullPath);
      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        if (request.error?.name === 'NotFoundError') {
          resolve(false); // File didn't exist
        } else {
          reject(request.error);
        }
      };
    });
  }

  async listFiles(prefix = "keel://"): Promise<string[]> {
    if (!this.db) throw new Error("Storage not initialized");
    const fullPrefix = this.normalizePath(prefix);
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["vfs"], "readonly");
      const store = transaction.objectStore("vfs");
      const request = store.getAllKeys();
      request.onsuccess = () => {
        const keys = request.result as string[];
        resolve(keys.filter(k => k.startsWith(fullPrefix)));
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Memory Methods
  async addMemory(category: MemoryCategory, content: string, tags: string[] = [], metadata = {}) {
    if (!this.db) throw new Error("Storage not initialized");
    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(["memories"], "readwrite");
      const store = transaction.objectStore("memories");
      const memory: AgentMemory = {
        category,
        content,
        tags,
        metadata,
        timestamp: Date.now(),
      };
      const request = store.add(memory);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMemories(category?: MemoryCategory): Promise<AgentMemory[]> {
    if (!this.db) throw new Error("Storage not initialized");
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["memories"], "readonly");
      const store = transaction.objectStore("memories");
      let request;
      if (category) {
        const index = store.index("category");
        request = index.getAll(category);
      } else {
        request = store.getAll();
      }
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Skill Methods
  async saveSkill(id: string, definition: Record<string, unknown>) {
    if (!this.db) throw new Error("Storage not initialized");
    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(["skills"], "readwrite");
      const store = transaction.objectStore("skills");
      const request = store.put({ id, ...definition });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllSkills(): Promise<Record<string, unknown>[]> {
    if (!this.db) throw new Error("Storage not initialized");
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["skills"], "readonly");
      const store = transaction.objectStore("skills");
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

export const storage = new KeelStorage();
