import { skillStorage } from '../storage/skills'
import { ParsedSkill } from './parser'

export class SkillsRegistry {
  private static instance: SkillsRegistry
  private skills = new Map<string, ParsedSkill & { version: string }>()
  private loaded = false
  private skillHashes = new Map<string, string>()

  static getInstance(): SkillsRegistry {
    if (!SkillsRegistry.instance) {
      SkillsRegistry.instance = new SkillsRegistry()
    }
    return SkillsRegistry.instance
  }

  // Load skills from storage
  async load(): Promise<void> {
    if (this.loaded) return

    const storedSkills = await skillStorage.getAllSkills()
    
    for (const stored of storedSkills) {
      try {
        // Generate hash for version checking
        const contentHash = this.generateHash(stored.content)
        
        // Check if skill needs updating
        const existingSkill = this.skills.get(stored.name)
        if (!existingSkill || existingSkill.version !== contentHash) {
          // Don't parse again if we already have it in memory and it hasn't changed
          if (!this.skills.has(stored.name) || this.skillHashes.get(stored.name) !== contentHash) {
            // We need to import SkillsParser dynamically to avoid circular dependencies
            const { SkillsParser } = await import('./parser')
            const parsed = SkillsParser.parse(stored.content)
            
            // Store with version hash
            this.skills.set(stored.name, { ...parsed, version: contentHash })
            this.skillHashes.set(stored.name, contentHash)
          }
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to load skill ${stored.name}:`, errorMessage)
      }
    }

    this.loaded = true
  }
  
  // Generate simple hash for content
  private generateHash(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }

  // Register a skill
  register(skill: ParsedSkill & { version?: string }): void {
    const skillWithVersion: ParsedSkill & { version: string } = skill.version 
      ? skill as ParsedSkill & { version: string }
      : { ...skill, version: Date.now().toString() }
    this.skills.set(skill.name, skillWithVersion)
  }

  // Get a skill by name
  get(name: string): (ParsedSkill & { version: string }) | undefined {
    return this.skills.get(name)
  }

  // Get a skill without version for external use
  getSkill(name: string): ParsedSkill | undefined {
    const skill = this.skills.get(name)
    if (!skill) return undefined
    
    // Return without version property
    const { version, ...skillWithoutVersion } = skill
    return skillWithoutVersion
  }

  // Get all skills
  getAll(): ParsedSkill[] {
    return Array.from(this.skills.values()).map(skill => {
      const { version, ...skillWithoutVersion } = skill
      return skillWithoutVersion
    })
  }

  // Check if skill exists
  has(name: string): boolean {
    return this.skills.has(name)
  }

  // Remove a skill
  remove(name: string): boolean {
    return this.skills.delete(name)
  }

  // Clear all skills
  clear(): void {
    this.skills.clear()
    this.loaded = false
  }

  // Get skills by tag
  getByTag(tag: string): ParsedSkill[] {
    return Array.from(this.skills.values()).map(skill => {
      const { version, ...skillWithoutVersion } = skill
      return skillWithoutVersion
    }).filter(skill =>
      skill.tags?.includes(tag)
    )
  }

  // Search skills
  search(query: string): ParsedSkill[] {
    const lowerQuery = query.toLowerCase()
    return Array.from(this.skills.values()).map(skill => {
      const { version, ...skillWithoutVersion } = skill
      return skillWithoutVersion
    }).filter(skill =>
      skill.name.toLowerCase().includes(lowerQuery) ||
      skill.description.toLowerCase().includes(lowerQuery) ||
      skill.instructions.toLowerCase().includes(lowerQuery) ||
      skill.tags?.some((t: string) => t.toLowerCase().includes(lowerQuery))
    )
  }

  // Get skill count
  count(): number {
    return this.skills.size
  }

  // Get skill names
  getNames(): string[] {
    return Array.from(this.skills.keys())
  }

  // Reload from storage
  async reload(): Promise<void> {
    this.clear()
    await this.load()
  }
}

// Export singleton
export const skillsRegistry = SkillsRegistry.getInstance()
