import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SkillsDownloader, GitHubRepo } from './downloader'

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
      name: 'agent-skills',
      description: 'Official collection of skills from Vercel Labs (React, UI, etc.)',
      repo: 'vercel-labs/agent-skills',
      tags: ['official', 'react', 'nextjs', 'ui', 'vercel']
    })
  })

  it('should filter skills by search query', async () => {
    const skills = await SkillsDownloader.searchSkills('react')
    
    expect(skills).toHaveLength(1)
    const skillNames = skills.map(s => s.name)
    expect(skillNames).toContain('agent-skills')
  })

  it('should parse GitHub Enterprise URL', () => {
    const repo = SkillsDownloader.parseRepoUrl('https://github.internal.company.com/owner/repo')
    
    expect(repo).toEqual({
      owner: 'owner',
      repo: 'repo',
      branch: 'main'
    })
  })

  it('should parse git protocol URL', () => {
    const repo = SkillsDownloader.parseRepoUrl('git://github.com/owner/repo.git')
    
    expect(repo).toEqual({
      owner: 'owner',
      repo: 'repo',
      branch: 'main'
    })
  })

  it('should parse SSH protocol URL', () => {
    const repo = SkillsDownloader.parseRepoUrl('ssh://git@github.com/owner/repo.git')
    
    expect(repo).toEqual({
      owner: 'owner',
      repo: 'repo',
      branch: 'main'
    })
  })

  it('should handle proxy failover during download', async () => {
    const repo: GitHubRepo = { owner: 'owner', repo: 'repo', branch: 'main' }
    
    // Mock first proxy failing, second proxy succeeding
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response) // Direct fail
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response) // allorigins fail
      .mockResolvedValueOnce({ 
        ok: true, 
        json: () => Promise.resolve({ default_branch: 'main' }) 
      } as Response) // corsproxy success
      
    const branch = await (SkillsDownloader as any).getDefaultBranch(repo)
    expect(branch).toBe('main')
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('should handle all proxies failing', async () => {
    const repo: GitHubRepo = { owner: 'owner', repo: 'repo' }
    
    mockFetch.mockResolvedValue({ ok: false, status: 404 } as Response)
    
    // Should fallback to 'main' if everything fails in getDefaultBranch
    const branch = await (SkillsDownloader as any).getDefaultBranch(repo)
    expect(branch).toBe('main')
  })

  it('should handle malformed allorigins response', async () => {
    const repo: GitHubRepo = { owner: 'owner', repo: 'repo' }
    
    // allorigins proxy is at index 0 in CORS_PROXIES (after direct attempt)
    // Actually direct is tried first, then proxies
    mockFetch
      .mockResolvedValueOnce({ ok: false } as Response) // Direct
      .mockResolvedValueOnce({ 
        ok: true, 
        json: () => Promise.resolve({ contents: 'not-json' }) 
      } as Response) // allorigins returns bad data
      
    // Should fallback to next proxy or return 'main'
    const branch = await (SkillsDownloader as any).getDefaultBranch(repo)
    expect(branch).toBe('main')
  })
})
