import { logger } from "./logger";

export interface VFSFile {
  path: string;
  content: string;
  mimeType: string;
  metadata: Record<string, any>;
  updatedAt: number;
}

export interface AgentMemory {
  agentId: string;
  timestamp: number;
  content: string;
  tags: string[];
}

export class KeelStorage {
  private dbName = "keel-storage";
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  async init() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("vfs")) {
          db.createObjectStore("vfs", { keyPath: "path" });
        }
        if (!db.objectStoreNames.contains("memories")) {
          const memoryStore = db.createObjectStore("memories", { keyPath: "id", autoIncrement: true });
          memoryStore.createIndex("agentId", "agentId", { unique: false });
        }
        if (!db.objectStoreNames.contains("skills")) {
          db.createObjectStore("skills", { keyPath: "id" });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        logger.info("storage", "IndexedDB initialized");
        resolve();
      };

      request.onerror = (event) => {
        logger.error("storage", "IndexedDB error", { error: (event.target as IDBOpenDBRequest).error });
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  // VFS Methods
  async writeFile(path: string, content: string, mimeType = "text/plain", metadata = {}) {
    if (!this.db) throw new Error("Storage not initialized");
    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(["vfs"], "readwrite");
      const store = transaction.objectStore("vfs");
      const file: VFSFile = {
        path,
        content,
        mimeType,
        metadata,
        updatedAt: Date.now(),
      };
      const request = store.put(file);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async readFile(path: string): Promise<VFSFile | null> {
    if (!this.db) throw new Error("Storage not initialized");
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["vfs"], "readonly");
      const store = transaction.objectStore("vfs");
      const request = store.get(path);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async listFiles(prefix = ""): Promise<string[]> {
    if (!this.db) throw new Error("Storage not initialized");
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["vfs"], "readonly");
      const store = transaction.objectStore("vfs");
      const request = store.getAllKeys();
      request.onsuccess = () => {
        const keys = request.result as string[];
        resolve(keys.filter(k => k.startsWith(prefix)));
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Memory Methods
  async addMemory(agentId: string, content: string, tags: string[] = []) {
    if (!this.db) throw new Error("Storage not initialized");
    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(["memories"], "readwrite");
      const store = transaction.objectStore("memories");
      const memory = {
        agentId,
        content,
        tags,
        timestamp: Date.now(),
      };
      const request = store.add(memory);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMemories(agentId: string): Promise<AgentMemory[]> {
    if (!this.db) throw new Error("Storage not initialized");
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["memories"], "readonly");
      const store = transaction.objectStore("memories");
      const index = store.index("agentId");
      const request = index.getAll(agentId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Skill Methods
  async saveSkill(id: string, definition: any) {
    if (!this.db) throw new Error("Storage not initialized");
    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(["skills"], "readwrite");
      const store = transaction.objectStore("skills");
      const request = store.put({ id, ...definition });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSkill(id: string) {
    if (!this.db) throw new Error("Storage not initialized");
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["skills"], "readonly");
      const store = transaction.objectStore("skills");
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }
}

export const storage = new KeelStorage();
