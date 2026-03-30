import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SkillsDownloader } from './downloader'

// Mock fetch
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

describe('SkillsDownloader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should parse owner/repo format', () => {
    const repo = SkillsDownloader.parseRepoUrl('owner/repo')
    
    expect(repo).toEqual({
      owner: 'owner',
      repo: 'repo',
      branch: undefined
    })
  })

  it('should parse full GitHub URL', () => {
    const repo = SkillsDownloader.parseRepoUrl('https://github.com/owner/repo')
    
    expect(repo).toEqual({
      owner: 'owner',
      repo: 'repo',
      branch: 'main'
    })
  })

  it('should parse GitHub URL with branch', () => {
    const repo = SkillsDownloader.parseRepoUrl('https://github.com/owner/repo/tree/develop')
    
    expect(repo).toEqual({
      owner: 'owner',
      repo: 'repo',
      branch: 'develop'
    })
  })

  it('should return null for invalid format', () => {
    const repo = SkillsDownloader.parseRepoUrl('invalid-url')
    
    expect(repo).toBeNull()
  })

  it('should handle missing skills directory', async () => {
    const mockRepoContents = [
      { name: 'src', type: 'dir' },
      { name: 'README.md', type: 'file' }
    ]
    
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRepoContents)
    } as Response)
    
    await expect(
      SkillsDownloader.downloadSkills({ owner: 'owner', repo: 'repo' })
    ).rejects.toThrow('No skills directory found')
  })

  it('should handle API errors', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      statusText: 'Not Found'
    } as Response)
    
    await expect(
      SkillsDownloader.downloadSkills({ owner: 'owner', repo: 'repo' })
    ).rejects.toThrow('Failed to fetch repository')
  })

  it('should search popular skills', async () => {
    const skills = await SkillsDownloader.searchSkills()
    
    expect(skills).toContainEqual({
      name: 'vercel-react-best-practices',
      description: 'React and Next.js performance optimization guidelines',
      repo: 'vercel-labs/agent-skills',
      tags: ['react', 'nextjs', 'performance', 'vercel']
    })
  })

  it('should filter skills by search query', async () => {
    const skills = await SkillsDownloader.searchSkills('react')
    
    expect(skills).toHaveLength(2)
    const skillNames = skills.map(s => s.name)
    expect(skillNames).toContain('vercel-react-best-practices')
    expect(skillNames).toContain('react-native-guidelines')
  })

  it('should get default branch', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ default_branch: 'develop' })
    } as Response)
    
    const branch = await (SkillsDownloader as any).getDefaultBranch({
      owner: 'owner',
      repo: 'repo'
    })
    
    expect(branch).toBe('develop')
  })
})
