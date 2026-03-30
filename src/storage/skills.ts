// Skill storage interface
export interface StoredSkill {
  name: string
  description: string
  source: string // GitHub URL
  content: string // SKILL.md content
  converted: boolean // Whether JS was converted to Python
  originalLanguage?: string // Track source language if converted
  conversionMethod?: 'simple' | 'llm' | 'manual' // Track how it was converted
  downloadDate: Date
  tags?: string[]
}

// Skill storage using IndexedDB
export class SkillStorage {
  private dbName = 'KeelSkills'
  private storeName = 'skills'
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
          const store = db.createObjectStore(this.storeName, { keyPath: 'name' })
          store.createIndex('source', 'source', { unique: false })
          store.createIndex('downloadDate', 'downloadDate', { unique: false })
        }
      }
    })
  }

  async saveSkill(skill: StoredSkill): Promise<void> {
    if (!this.db) {
      await this.init()
    }
    
    // Validate skill before saving
    if (!skill || !skill.name || !skill.content) {
      throw new Error('Invalid skill: missing required fields')
    }
    
    // Check storage quota
    const nav = (globalThis as any).navigator
    if (nav && nav.storage && nav.storage.estimate) {
      try {
        const estimate = await nav.storage.estimate()
        const usage = estimate.usage || 0
        const quota = estimate.quota || 0
        
        // Warn if using more than 80% of quota
        if (quota > 0 && usage / quota > 0.8) {
          console.warn(`Storage quota warning: ${Math.round(usage / quota * 100)}% used`)
        }
        
        // Throw error if quota exceeded
        if (quota > 0 && usage >= quota) {
          throw new Error('Storage quota exceeded. Please delete some skills to free up space.')
        }
      } catch (error) {
        console.warn('Could not check storage quota:', error)
      }
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      
      const request = store.put(skill)
      request.onerror = () => reject(new Error(`Failed to save skill: ${request.error?.message || 'Unknown error'}`))
      request.onsuccess = () => resolve()
    })
  }

  async getSkill(name: string): Promise<StoredSkill | null> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(name)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || null)
    })
  }

  async getAllSkills(): Promise<StoredSkill[]> {
    if (!this.db) {
      await this.init()
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      
      const request = store.getAll()
      request.onerror = () => reject(new Error(`Failed to get skills: ${request.error?.message || 'Unknown error'}`))
      request.onsuccess = () => {
        const skills = request.result || []
        // Validate each skill
        const validSkills = skills.filter(skill => 
          skill && skill.name && skill.content
        )
        resolve(validSkills)
      }
    })
  }

  async deleteSkill(name: string): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(name)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async searchSkills(query: string): Promise<StoredSkill[]> {
    const allSkills = await this.getAllSkills()
    const lowerQuery = query.toLowerCase()
    
    return allSkills.filter(skill => 
      skill.name.toLowerCase().includes(lowerQuery) ||
      skill.description.toLowerCase().includes(lowerQuery) ||
      skill.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
  }

  async getSkillsBySource(source: string): Promise<StoredSkill[]> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const index = store.index('source')
      const request = index.getAll(source)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || [])
    })
  }

  async exportSkills(): Promise<string> {
    const skills = await this.getAllSkills()
    return JSON.stringify(skills, null, 2)
  }

  async importSkills(jsonData: string): Promise<number> {
    const skills = JSON.parse(jsonData) as StoredSkill[]
    let count = 0
    
    for (const skill of skills) {
      await this.saveSkill(skill)
      count++
    }
    
    return count
  }
}

export const skillStorage = new SkillStorage()
