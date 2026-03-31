// Model storage interface
export interface StoredModel {
  modelId: string
  size: number
  downloadDate: Date
  status: 'downloading' | 'ready' | 'error'
  progress?: number
}

// Model storage using IndexedDB
export class ModelStorage {
  private dbName = 'KeelModels'
  private storeName = 'models'
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'modelId' })
          store.createIndex('status', 'status', { unique: false })
        }
      }
    })
  }

  async saveModel(model: StoredModel): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.put(model)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getModel(modelId: string): Promise<StoredModel | null> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(modelId)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || null)
    })
  }

  async getAllModels(): Promise<StoredModel[]> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAll()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || [])
    })
  }

  async deleteModel(modelId: string): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(modelId)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getStorageUsage(): Promise<{ used: number; available: number }> {
    const nav = navigator as unknown as { storage?: { estimate?: () => Promise<StorageEstimate> } }
    if (nav.storage?.estimate) {
      const estimate = await nav.storage.estimate()
      return {
        used: estimate.usage || 0,
        available: estimate.quota || 0
      }
    }
    return { used: 0, available: 0 }
  }
}

export const modelStorage = new ModelStorage()
