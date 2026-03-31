// Skill storage interface
import { logger } from '../logger';

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
    const nav = navigator as unknown as { storage?: { estimate?: () => Promise<StorageEstimate> } }
    if (nav.storage?.estimate) {
      try {
        const estimate = await nav.storage.estimate()
        const usage = estimate.usage || 0
        const quota = estimate.quota || 0
        
        // Calculate approximate size of the skill
        const skillSize = new Blob([JSON.stringify(skill)]).size
        
        // Check if adding this skill would exceed quota
        if (quota > 0 && usage + skillSize >= quota) {
          throw new Error(`Storage quota exceeded. Cannot save skill "${skill.name}". Please delete some skills to free up space.`)
        }
        
        // Warn if using more than 80% of quota
        if (quota > 0 && (usage + skillSize) / quota > 0.8) {
          const newUsagePercent = Math.round((usage + skillSize) / quota * 100)
          console.warn(`Storage quota warning: ${newUsagePercent}% used after saving this skill`)
          logger.warn('skills', 'Storage quota warning', {
            skillName: skill.name,
            currentUsage: usage,
            skillSize,
            quota,
            usagePercent: newUsagePercent
          })
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('quota exceeded')) {
          throw error
        }
        console.warn('Could not check storage quota:', error)
      }
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      
      const request = store.put(skill)
      request.onerror = () => reject(new Error(`Failed to save skill: ${request.error?.message || 'Unknown error'}`))
      request.onsuccess = () => {
        logger.info('skills', 'Skill saved successfully', { skillName: skill.name })
        resolve()
      }
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
    let skills: StoredSkill[];
    
    // Validate and parse JSON
    try {
      skills = JSON.parse(jsonData);
    } catch (error) {
      throw new Error(`Invalid JSON data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Validate array structure
    if (!Array.isArray(skills)) {
      throw new Error('Import data must be an array of skills');
    }
    
    // Validate each skill before starting import
    for (const skill of skills) {
      if (!skill || !skill.name || !skill.content || !skill.description) {
        throw new Error(`Invalid skill: missing required fields (name, content, description)`);
      }
    }
    
    // Track imported skills for rollback
    const importedSkills: string[] = [];
    let count = 0;
    
    try {
      for (const skill of skills) {
        await this.saveSkill(skill);
        importedSkills.push(skill.name);
        count++;
      }
      return count;
    } catch (error) {
      // Rollback on failure
      logger.error('skills', 'Import failed, rolling back', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        importedCount: importedSkills.length
      });
      
      // Remove imported skills
      for (const skillName of importedSkills) {
        try {
          await this.deleteSkill(skillName);
        } catch (rollbackError) {
          console.error(`Failed to rollback skill ${skillName}:`, rollbackError);
        }
      }
      
      throw new Error(`Import failed after ${count} skills. Changes have been rolled back.`);
    }
  }
}

export const skillStorage = new SkillStorage()
