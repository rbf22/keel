import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { skillStorage, type StoredSkill } from './skills'

describe('SkillStorage', () => {
  beforeEach(async () => {
    await skillStorage.init()
  })

  afterEach(async () => {
    // Clean up database
    if (skillStorage['db']) {
      skillStorage['db'].close()
      await indexedDB.deleteDatabase('KeelSkills')
    }
  })

  it('should save and retrieve a skill', async () => {
    const skill: StoredSkill = {
      name: 'test-skill',
      description: 'A test skill',
      source: 'https://github.com/test/repo',
      content: 'Skill content',
      converted: false,
      downloadDate: new Date(),
      tags: ['test', 'demo']
    }

    await skillStorage.saveSkill(skill)
    const retrieved = await skillStorage.getSkill('test-skill')

    expect(retrieved).toEqual(skill)
  })

  it('should update an existing skill', async () => {
    const skill: StoredSkill = {
      name: 'test-skill',
      description: 'Original description',
      source: 'https://github.com/test/repo',
      content: 'Original content',
      converted: false,
      downloadDate: new Date()
    }

    await skillStorage.saveSkill(skill)
    
    const updatedSkill = { ...skill, description: 'Updated description' }
    await skillStorage.saveSkill(updatedSkill)
    
    const retrieved = await skillStorage.getSkill('test-skill')
    expect(retrieved?.description).toBe('Updated description')
  })

  it('should get all skills', async () => {
    const skills: StoredSkill[] = [
      {
        name: 'skill1',
        description: 'First skill',
        source: 'repo1',
        content: 'content1',
        converted: false,
        downloadDate: new Date()
      },
      {
        name: 'skill2',
        description: 'Second skill',
        source: 'repo2',
        content: 'content2',
        converted: true,
        downloadDate: new Date()
      }
    ]

    for (const skill of skills) {
      await skillStorage.saveSkill(skill)
    }

    const allSkills = await skillStorage.getAllSkills()
    expect(allSkills).toHaveLength(2)
    expect(allSkills).toEqual(expect.arrayContaining(skills))
  })

  it('should delete a skill', async () => {
    const skill: StoredSkill = {
      name: 'test-skill',
      description: 'A test skill',
      source: 'repo',
      content: 'content',
      converted: false,
      downloadDate: new Date()
    }

    await skillStorage.saveSkill(skill)
    expect(await skillStorage.getSkill('test-skill')).toBeTruthy()

    await skillStorage.deleteSkill('test-skill')
    expect(await skillStorage.getSkill('test-skill')).toBeFalsy()
  })

  it('should search skills by name', async () => {
    const skills: StoredSkill[] = [
      {
        name: 'calculator',
        description: 'Math calculations',
        source: 'repo1',
        content: 'content1',
        converted: false,
        downloadDate: new Date()
      },
      {
        name: 'analyzer',
        description: 'Data analysis',
        source: 'repo2',
        content: 'content2',
        converted: false,
        downloadDate: new Date()
      }
    ]

    for (const skill of skills) {
      await skillStorage.saveSkill(skill)
    }

    const results = await skillStorage.searchSkills('calc')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('calculator')
  })

  it('should search skills by description', async () => {
    const skills: StoredSkill[] = [
      {
        name: 'skill1',
        description: 'Math calculations',
        source: 'repo1',
        content: 'content1',
        converted: false,
        downloadDate: new Date()
      },
      {
        name: 'skill2',
        description: 'Data visualization',
        source: 'repo2',
        content: 'content2',
        converted: false,
        downloadDate: new Date()
      }
    ]

    for (const skill of skills) {
      await skillStorage.saveSkill(skill)
    }

    const results = await skillStorage.searchSkills('visualization')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('skill2')
  })

  it('should search skills by tags', async () => {
    const skills: StoredSkill[] = [
      {
        name: 'skill1',
        description: 'Description 1',
        source: 'repo1',
        content: 'content1',
        converted: false,
        downloadDate: new Date(),
        tags: ['math', 'calculator']
      },
      {
        name: 'skill2',
        description: 'Description 2',
        source: 'repo2',
        content: 'content2',
        converted: false,
        downloadDate: new Date(),
        tags: ['data', 'analysis']
      }
    ]

    for (const skill of skills) {
      await skillStorage.saveSkill(skill)
    }

    const results = await skillStorage.searchSkills('math')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('skill1')
  })

  it('should get skills by source', async () => {
    const skills: StoredSkill[] = [
      {
        name: 'skill1',
        description: 'Description 1',
        source: 'https://github.com/repo1',
        content: 'content1',
        converted: false,
        downloadDate: new Date()
      },
      {
        name: 'skill2',
        description: 'Description 2',
        source: 'https://github.com/repo2',
        content: 'content2',
        converted: false,
        downloadDate: new Date()
      },
      {
        name: 'skill3',
        description: 'Description 3',
        source: 'https://github.com/repo1',
        content: 'content3',
        converted: false,
        downloadDate: new Date()
      }
    ]

    for (const skill of skills) {
      await skillStorage.saveSkill(skill)
    }

    const repo1Skills = await skillStorage.getSkillsBySource('https://github.com/repo1')
    expect(repo1Skills).toHaveLength(2)
    expect(repo1Skills.map(s => s.name)).toEqual(['skill1', 'skill3'])
  })

  it('should export and import skills', async () => {
    const skills: StoredSkill[] = [
      {
        name: 'skill1',
        description: 'Description 1',
        source: 'repo1',
        content: 'content1',
        converted: false,
        downloadDate: new Date()
      },
      {
        name: 'skill2',
        description: 'Description 2',
        source: 'repo2',
        content: 'content2',
        converted: true,
        downloadDate: new Date()
      }
    ]

    for (const skill of skills) {
      await skillStorage.saveSkill(skill)
    }

    const exported = await skillStorage.exportSkills()
    const parsed = JSON.parse(exported)
    
    // Check that we have the right number of skills
    expect(parsed).toHaveLength(2)
    expect(parsed[0].name).toBe('skill1')
    expect(parsed[1].name).toBe('skill2')

    // Clear and import
    await skillStorage.deleteSkill('skill1')
    await skillStorage.deleteSkill('skill2')
    expect(await skillStorage.getAllSkills()).toHaveLength(0)

    const count = await skillStorage.importSkills(exported)
    expect(count).toBe(2)
    expect(await skillStorage.getAllSkills()).toHaveLength(2)
  })
})
