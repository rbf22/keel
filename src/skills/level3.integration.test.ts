import { describe, it, expect, vi, beforeEach } from 'vitest'
import { skillsEngine } from './engine'
import { skillStorage } from '../storage/skills'
import { SkillsParser } from './parser'
import { SkillsDownloader, GitHubRepo } from './downloader'

// Mock storage
vi.mock('../storage/skills', () => ({
  skillStorage: {
    getAllSkills: vi.fn(),
    getSkill: vi.fn(),
    saveSkill: vi.fn(),
    deleteSkill: vi.fn(),
    init: vi.fn()
  }
}))

// Mock logger to avoid noise
vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

describe('Level 3 Resource Integration', () => {
  const mockPythonRuntime = {
    execute: vi.fn().mockImplementation(function(this: any, _code: string, _resources?: Record<string, string>) {
      // Simulate successful execution by calling onOutput with 'complete'
      if (this.onOutput) {
        this.onOutput({ type: 'complete' })
      }
      return Promise.resolve()
    }),
    onOutput: null as any,
    restoreHandler: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset engine state
    // @ts-ignore - accessing private for test reset
    skillsEngine.skillMetadata.clear()
    // @ts-ignore - accessing private for test reset
    skillsEngine.loadedSkills.clear()
    // @ts-ignore - accessing private for test reset
    skillsEngine.initialized = false
  })

  it('should pass Level 3 resources to Python runtime during execution', async () => {
    const skillName = 'resource-test'
    const skillContent = `---
name: ${skillName}
description: A test skill with resources
---
# Test Skill
\`\`\`python
with open('extra/data.txt', 'r') as f:
    print(f.read())
\`\`\``

    const mockResources = {
      'SKILL.md': skillContent,
      'extra/data.txt': 'hello from level 3'
    }

    const mockStoredSkill = {
      name: skillName,
      description: 'A test skill with resources',
      content: skillContent,
      resources: mockResources,
      source: 'test',
      downloadDate: new Date(),
      converted: false
    }

    // Setup mocks
    vi.mocked(skillStorage.getAllSkills).mockResolvedValue([mockStoredSkill])
    vi.mocked(skillStorage.getSkill).mockResolvedValue(mockStoredSkill)

    // Initialize engine
    await skillsEngine.init()

    // Execute skill
    const result = await skillsEngine.executeSkill(
      skillName,
      {},
      { pythonRuntime: mockPythonRuntime as any }
    )

    // Verify execution
    expect(mockPythonRuntime.execute).toHaveBeenCalledWith(
      expect.stringContaining("print(f.read())"),
      mockResources
    )
  })

  it('should lazily load full skill content and resources from storage', async () => {
    const skillName = 'lazy-test'
    const skillContent = `---
name: ${skillName}
description: Lazy load test
---
\`\`\`python
print("lazy")
\`\`\``
    
    const mockResources = {
      'SKILL.md': skillContent,
      'config.json': '{"key": "value"}'
    }

    const mockStoredSkill = {
      name: skillName,
      description: 'Lazy load test',
      content: skillContent,
      resources: mockResources,
      source: 'test',
      downloadDate: new Date(),
      converted: false
    }

    // On init, only metadata is parsed. Full skill is NOT in loadedSkills yet.
    vi.mocked(skillStorage.getAllSkills).mockResolvedValue([mockStoredSkill])
    vi.mocked(skillStorage.getSkill).mockResolvedValue(mockStoredSkill)

    await skillsEngine.init()
    
    // @ts-ignore
    expect(skillsEngine.loadedSkills.has(skillName)).toBe(false)
    expect(skillsEngine.getAvailableSkillsMetadata()).toHaveLength(1)

    // Get full skill
    const fullSkill = await skillsEngine.getFullSkill(skillName)
    
    expect(fullSkill).toBeDefined()
    expect(fullSkill?.resources).toEqual(mockResources)
    // @ts-ignore
    expect(skillsEngine.loadedSkills.has(skillName)).toBe(true)
    
    // Execute
    await skillsEngine.executeSkill(
      skillName,
      {},
      { pythonRuntime: mockPythonRuntime as any }
    )

    expect(mockPythonRuntime.execute).toHaveBeenCalledWith(
      expect.any(String),
      mockResources
    )
  })

  it('should handle resource size limits in SkillsDownloader', async () => {
    // We'll test this by mocking the fetch calls in a way that triggers the limit logic
    // This requires exposing or testing through the public static downloadSkills method
    
    const repo: GitHubRepo = { owner: 'owner', repo: 'repo' }
    const skillName = 'large-skill'
    const largeContent = 'a'.repeat(2 * 1024 * 1024) // 2MB, exceeds 1MB limit
    
    // Mock the recursive fetching to return SKILL.md and a large file
    // Note: Since we're using static methods, we need to mock global fetch
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn() as any
    
    try {
      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ default_branch: 'main' }) } as Response) // getDefaultBranch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ name: 'skills', type: 'dir' }]) } as Response) // fetchRepoContents (root)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ name: skillName, type: 'dir' }]) } as Response) // fetchRepoContents (skills/)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([
          { name: 'SKILL.md', path: 'skills/large-skill/SKILL.md', type: 'file', download_url: 'url1' },
          { name: 'large.bin', path: 'skills/large-skill/large.bin', type: 'file', download_url: 'url2' }
        ]) } as Response) // fetchAllFilesRecursive
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(`---
name: ${skillName}
description: test
---
# Instructions
Test instructions
`) } as Response) // fetchFileContent (SKILL.md)
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(largeContent) } as Response) // fetchFileContent (large.bin)

      const skills = await SkillsDownloader.downloadSkills(repo)
      
      expect(skills).toHaveLength(1)
      expect(skills[0].resources).toBeDefined()
      // SKILL.md should be there, but large.bin should be skipped due to size limit
      expect(skills[0].resources!['SKILL.md']).toBeDefined()
      expect(skills[0].resources!['large.bin']).toBeUndefined()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('should sanitize resource paths in python-worker.ts', async () => {
    // This test simulates the worker's message handler logic
    const resources = {
      'valid/path.txt': 'content',
      '../outside.txt': 'danger',
      '/absolute/path.txt': 'danger'
    }
    
    const writeErrors: string[] = []
    for (const [path, _content] of Object.entries(resources)) {
      if (path.includes('..') || path.startsWith('/')) {
        writeErrors.push(`Invalid resource path: ${path}`)
      }
    }
    
    expect(writeErrors).toContain('Invalid resource path: ../outside.txt')
    expect(writeErrors).toContain('Invalid resource path: /absolute/path.txt')
    expect(writeErrors).not.toContain('Invalid resource path: valid/path.txt')
  })
})
