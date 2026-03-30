import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SkillsRegistry } from './registry'
import { skillStorage } from '../storage/skills'
import { ParsedSkill, SkillsParser } from './parser'
import 'fake-indexeddb/auto'

// Mock storage
vi.mock('../storage/skills', () => ({
  skillStorage: {
    init: vi.fn(),
    getAllSkills: vi.fn(),
    saveSkill: vi.fn(),
    deleteSkill: vi.fn(),
    getSkill: vi.fn(),
    close: vi.fn()
  }
}))

// Mock parser
vi.mock('./parser.js', () => ({
  SkillsParser: {
    parse: vi.fn()
  }
}))

describe('SkillsRegistry', () => {
  let registry: SkillsRegistry
  const mockSkill: ParsedSkill = {
    name: 'test-skill',
    description: 'A test skill',
    instructions: 'Test instructions',
    content: '---\nname: test-skill\ndescription: A test skill\n---\n\nTest content',
    codeBlocks: [],
    tags: ['test']
  }

  beforeEach(async () => {
    // Reset singleton
    ;(SkillsRegistry as any).instance = null
    registry = SkillsRegistry.getInstance()
    await skillStorage.init()
  })

  afterEach(() => {
    // Reset singleton instance
    ;(SkillsRegistry as any).instance = null
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SkillsRegistry.getInstance()
      const instance2 = SkillsRegistry.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should create new instance if none exists', () => {
      ;(SkillsRegistry as any).instance = null
      const newInstance = SkillsRegistry.getInstance()
      expect(newInstance).toBeInstanceOf(SkillsRegistry)
    })
  })

  describe('Loading Skills', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should load skills from storage', async () => {
      const storedSkills = [
        {
          name: 'skill1',
          description: 'Skill 1',
          content: mockSkill.content,
          source: 'test',
          downloadDate: new Date(),
          converted: false
        }
      ]

      vi.mocked(skillStorage.getAllSkills).mockResolvedValue(storedSkills)
      vi.mocked(SkillsParser.parse).mockReturnValue({...mockSkill, name: 'skill1', description: 'Skill 1'})

      await registry.load()

      expect(skillStorage.getAllSkills).toHaveBeenCalled()
      expect(SkillsParser.parse).toHaveBeenCalledTimes(1)
      
      const skills = registry.getAll()
      expect(skills).toHaveLength(1)
      expect(skills[0].name).toBe('skill1')
    })

    it('should not load skills if already loaded', async () => {
      vi.mocked(skillStorage.getAllSkills).mockResolvedValue([])
      
      await registry.load()
      await registry.load() // Second call

      expect(skillStorage.getAllSkills).toHaveBeenCalledTimes(1)
    })

    it('should handle parsing errors gracefully', async () => {
      const storedSkills = [
        {
          name: 'invalid-skill',
          description: 'Invalid skill',
          content: 'Invalid content',
          source: 'test',
          downloadDate: new Date(),
          converted: false
        }
      ]

      vi.mocked(skillStorage.getAllSkills).mockResolvedValue(storedSkills)
      vi.mocked(SkillsParser.parse).mockImplementation(() => {
        throw new Error('Parse error')
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await registry.load()

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load skill invalid-skill:',
        expect.any(Error)
      )

      const skills = registry.getAll()
      expect(skills).toHaveLength(0)

      consoleSpy.mockRestore()
    })
  })

  describe('Skill Registration', () => {
    beforeEach(async () => {
      vi.clearAllMocks()
      vi.mocked(skillStorage.getAllSkills).mockResolvedValue([])
      await registry.load()
    })

    it('should register new skill', () => {
      registry.register(mockSkill)
      
      const skills = registry.getAll()
      expect(skills).toHaveLength(1)
      expect(skills[0]).toEqual(expect.objectContaining(mockSkill))
    })

    it('should update existing skill', () => {
      // Register initial skill
      registry.register(mockSkill)
      
      // Update with new content
      const updatedSkill = {
        ...mockSkill,
        description: 'Updated description'
      }

      registry.register(updatedSkill)

      const skills = registry.getAll()
      expect(skills).toHaveLength(1)
      expect(skills[0].description).toBe('Updated description')
    })
  })

  describe('Skill Retrieval', () => {
    const skills = [
      mockSkill,
      { ...mockSkill, name: 'skill2', description: 'Second skill', tags: ['other'] },
      { ...mockSkill, name: 'skill3', description: 'Third skill', tags: ['test', 'math'] }
    ]

    beforeEach(async () => {
      vi.clearAllMocks()
      vi.mocked(skillStorage.getAllSkills).mockResolvedValue([])
      await registry.load()
      
      // Register skills directly for testing
      for (const skill of skills) {
        registry.register(skill)
      }
    })

    it('should get all skills', () => {
      const allSkills = registry.getAll()
      expect(allSkills).toHaveLength(3)
      expect(allSkills.map(s => s.name)).toEqual(['test-skill', 'skill2', 'skill3'])
    })

    it('should get skill by name', () => {
      const skill = registry.getSkill('skill2')
      expect(skill).toBeTruthy()
      if (skill) {
        expect(skill.name).toBe('skill2')
        expect(skill.description).toBe('Second skill')
      }
    })

    it('should return undefined for non-existent skill', () => {
      const skill = registry.getSkill('non-existent')
      expect(skill).toBeUndefined()
    })

    it('should check if skill exists', () => {
      expect(registry.has('skill2')).toBe(true)
      expect(registry.has('non-existent')).toBe(false)
    })
  })

  describe('Skill Removal', () => {
    beforeEach(async () => {
      vi.clearAllMocks()
      vi.mocked(skillStorage.getAllSkills).mockResolvedValue([])
      await registry.load()
      registry.register(mockSkill)
    })

    it('should remove skill by name', () => {
      const removed = registry.remove('test-skill')
      expect(removed).toBe(true)
      
      const skills = registry.getAll()
      expect(skills).toHaveLength(0)
    })

    it('should return false for non-existent skill', () => {
      const removed = registry.remove('non-existent')
      expect(removed).toBe(false)
    })
  })

  describe('Hash Generation', () => {
    it('should generate consistent hash for same content', async () => {
      vi.clearAllMocks()
      vi.mocked(skillStorage.getAllSkills).mockResolvedValue([])
      await registry.load()
      
      const skill1 = registry.get('test-skill')
      const skill2 = registry.get('test-skill')
      
      // Both should be undefined initially
      expect(skill1).toBeUndefined()
      expect(skill2).toBeUndefined()
      
      // Register skill
      registry.register(mockSkill)
      
      // Get the hash generation method
      const hash1 = (registry as any).generateHash(mockSkill.content)
      const hash2 = (registry as any).generateHash(mockSkill.content)
      
      expect(hash1).toBe(hash2)
    })

    it('should generate different hash for different content', async () => {
      vi.clearAllMocks()
      vi.mocked(skillStorage.getAllSkills).mockResolvedValue([])
      await registry.load()
      
      registry.register(mockSkill)
      
      const modifiedSkill = {
        ...mockSkill,
        content: mockSkill.content.replace('Test content', 'Modified content')
      }
      
      registry.register(modifiedSkill)
      
      const skill = registry.get('test-skill')
      expect(skill).toBeDefined()
      const originalHash = skill!.version
      
      // Hash should be different
      const newHash = (registry as any).generateHash(modifiedSkill.content)
      expect(newHash).not.toBe(originalHash)
    })
  })
})
