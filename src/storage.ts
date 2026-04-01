import { logger } from "./logger";
import { VFSFile, MemoryCategory, AgentMemory } from "./types";

export class KeelStorage {
  private dbName = "keel-storage";
  private dbVersion = 2; // Bumped version
  private db: IDBDatabase | null = null;

  async init() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // VFS Store
        if (!db.objectStoreNames.contains("vfs")) {
          db.createObjectStore("vfs", { keyPath: "path" });
        } else {
            // Migration logic if needed - for now we'll just ensure it's there
        }

        // Memories Store
        if (!db.objectStoreNames.contains("memories")) {
          const memoryStore = db.createObjectStore("memories", { keyPath: "id", autoIncrement: true });
          memoryStore.createIndex("category", "category", { unique: false });
        } else {
            // Update memories if needed
            const transaction = (event.target as IDBOpenDBRequest).transaction!;
            const memoryStore = transaction.objectStore("memories");
            if (!memoryStore.indexNames.contains("category")) {
                memoryStore.createIndex("category", "category", { unique: false });
            }
        }

        // Skills Store
        if (!db.objectStoreNames.contains("skills")) {
          db.createObjectStore("skills", { keyPath: "id" });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        logger.info("storage", "IndexedDB initialized v" + this.dbVersion);
        resolve();
      };

      request.onerror = (event) => {
        logger.error("storage", "IndexedDB error", { error: (event.target as IDBOpenDBRequest).error });
        reject((event.target as IDBOpenDBRequest).error);
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
