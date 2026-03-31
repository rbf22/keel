import { type StoredSkill } from '../storage/skills'
import { SkillsParser, CodeBlock, JS_to_Python_Converter } from './parser.js'
import { LLMEngine } from '../llm'

export interface GitHubRepo {
  owner: string
  repo: string
  branch?: string
}

export interface SkillDownloadProgress {
  skillName: string
  status: 'downloading' | 'parsing' | 'converting' | 'complete' | 'error'
  progress: number
  error?: string
}

export class SkillsDownloader {
  private static readonly GITHUB_API_BASE = 'https://api.github.com'
  private static readonly CORS_PROXIES = [
    { url: 'https://api.allorigins.win/get?url=', name: 'allorigins', format: 'allorigins' },
    { url: 'https://corsproxy.io/?', name: 'corsproxy', format: 'direct' },
    { url: 'https://cors-anywhere.herokuapp.com/', name: 'cors-anywhere', format: 'direct' }
  ]
  private static llmEngine: LLMEngine | null = null

  static async setLLMEngine(engine: LLMEngine | null) {
    this.llmEngine = engine
    // Update the converter with the new engine
    if (this.llmEngine) {
      const { LLMConverter } = await import('./llm-converter')
      JS_to_Python_Converter.setLLMConverter(new LLMConverter(this.llmEngine))
    } else {
      JS_to_Python_Converter.setLLMConverter(null)
    }
  }
  
  // Parse GitHub URL or owner/repo format
  static parseRepoUrl(input: string): GitHubRepo | null {
    // Trim whitespace and remove trailing slashes
    input = input.trim().replace(/\/+$/, '');
    
    // Handle owner/repo format
    const simpleMatch = input.match(/^([\w-]+)\/([\w-]+)$/);
    if (simpleMatch) {
      return { owner: simpleMatch[1], repo: simpleMatch[2] }
    }
    
    // Handle full GitHub URL (more comprehensive regex)
    const urlMatch = input.match(/^(?:https?:\/\/)?(?:www\.)?(?:github\.com\/|git@github\.com:)?([\w-]+)\/([\w-]+)(?:\.git)?(?:\/(?:tree|blob|commits|issues|pulls)\/([^?#]+))?(?:\?([^#]*))?(?:#(.*))?$/);
    if (urlMatch) {
      let branch = urlMatch[3] || 'main';
      
      // Handle branch paths that might include subdirectories
      if (branch && branch.includes('/')) {
        branch = branch.split('/')[0];
      }
      
      // Handle .git suffix (already removed in regex but keeping for safety)
      const repo = urlMatch[2].replace(/\.git$/, '');
      
      return { 
        owner: urlMatch[1], 
        repo,
        branch
      }
    }
    
    // Handle GitHub Enterprise URLs (basic support)
    const enterpriseMatch = input.match(/^(?:https?:\/\/)?([^\/]+)\/([\w-]+)\/([\w-]+)(?:\.git)?(?:\/(?:tree|blob)\/([^?#]+))?$/);
    if (enterpriseMatch && enterpriseMatch[1] !== 'github.com') {
      let branch = enterpriseMatch[4] || 'main';
      
      if (branch && branch.includes('/')) {
        branch = branch.split('/')[0];
      }
      
      return { 
        owner: enterpriseMatch[2], 
        repo: enterpriseMatch[3].replace(/\.git$/, ''),
        branch
      }
    }
    
    // Handle git protocol URLs
    const gitMatch = input.match(/^git:\/\/github\.com\/([\w-]+)\/([\w-]+)\.git$/);
    if (gitMatch) {
      return { 
        owner: gitMatch[1], 
        repo: gitMatch[2],
        branch: 'main'
      }
    }
    
    // Handle SSH protocol URLs
    const sshMatch = input.match(/^ssh:\/\/git@github\.com\/([\w-]+)\/([\w-]+)\.git$/);
    if (sshMatch) {
      return { 
        owner: sshMatch[1], 
        repo: sshMatch[2],
        branch: 'main'
      }
    }
    
    return null;
  }
  
  // Fetch skills from a GitHub repository
  static async downloadSkills(
    repo: GitHubRepo, 
    onProgress?: (progress: SkillDownloadProgress) => void,
    skillNames?: string[]
  ): Promise<StoredSkill[]> {
    const skills: StoredSkill[] = []
    const branch = repo.branch || await this.getDefaultBranch(repo)
    
    try {
      // Get repository contents
      const contents = await this.fetchRepoContents(repo, branch)
      const skillsDir = contents.find(item => item.name === 'skills' && item.type === 'dir')
      
      if (!skillsDir) {
        throw new Error('No skills directory found in repository')
      }
      
      // Get all skills
      const skillEntries = await this.fetchRepoContents(repo, branch, 'skills')
      let skillDirs = skillEntries.filter(item => item.type === 'dir')
      
      // Filter by skill names if provided
      if (skillNames && skillNames.length > 0) {
        skillDirs = skillDirs.filter(dir => skillNames.includes(dir.name))
        if (skillDirs.length === 0) {
          throw new Error(`None of the specified skills (${skillNames.join(', ')}) were found in the repository`)
        }
      }
      
      for (const skillDir of skillDirs) {
        try {
          onProgress?.({
            skillName: skillDir.name,
            status: 'downloading',
            progress: 0
          })
          
          // Get skill files
          const skillFiles = await this.fetchRepoContents(repo, branch, `skills/${skillDir.name}`)
          const skillFile = skillFiles.find(file => file.name === 'SKILL.md')
          
          if (!skillFile) {
            console.warn(`No SKILL.md found in ${skillDir.name}`)
            continue
          }
          
          // Download skill content
          onProgress?.({
            skillName: skillDir.name,
            status: 'downloading',
            progress: 25
          })
          
          if (!skillFile.download_url) {
            throw new Error('No download URL available for skill file')
          }
          
          const content = await this.fetchFileContent(skillFile.download_url)
          
          // Parse skill
          onProgress?.({
            skillName: skillDir.name,
            status: 'parsing',
            progress: 50
          })
          
          const parsed = SkillsParser.parse(content)
          
          // Convert JavaScript to Python if needed
          onProgress?.({
            skillName: skillDir.name,
            status: 'converting',
            progress: 75
          })
          
          let converted = false
          let conversionMethod: 'simple' | 'llm' = 'simple'
          
          const convertedBlocks = await Promise.all(parsed.codeBlocks.map(async (block: CodeBlock) => {
            if (JS_to_Python_Converter.canConvert(block.language)) {
              converted = true
              // Try to determine if LLM was used by checking if the result differs from simple converter
              const simpleResult = JS_to_Python_Converter.convert(block.code)
              const finalResult = await JS_to_Python_Converter.convertWithFallback(block.code)
              
              if (finalResult !== simpleResult) {
                conversionMethod = 'llm'
              }
              
              return {
                ...block,
                converted: finalResult
              }
            }
            return block
          }))
          
          // Update parsed skill with converted code
          parsed.codeBlocks = convertedBlocks
          
          // Create stored skill
          const storedSkill = SkillsParser.toStoredSkill(
            parsed,
            `https://github.com/${repo.owner}/${repo.repo}`,
            converted,
            conversionMethod
          )
          
          skills.push(storedSkill)
          
          onProgress?.({
            skillName: skillDir.name,
            status: 'complete',
            progress: 100
          })
          
        } catch (error) {
          console.error(`Failed to download skill ${skillDir.name}:`, error)
          onProgress?.({
            skillName: skillDir.name,
            status: 'error',
            progress: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
      
      return skills
      
    } catch (error) {
      console.error('Failed to download skills:', error)
      throw error
    }
  }
  
  // Get default branch for repository with CORS handling
  private static async getDefaultBranch(repo: GitHubRepo): Promise<string> {
    const url = `${this.GITHUB_API_BASE}/repos/${repo.owner}/${repo.repo}`
    
    // Try direct fetch first
    try {
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        return data.default_branch || 'main'
      }
    } catch (error) {
      // Direct fetch failed, try proxies
    }
    
    // Try CORS proxies
    for (const proxy of this.CORS_PROXIES) {
      try {
        const proxyUrl = proxy.url + encodeURIComponent(url)
        const response = await fetch(proxyUrl)
        
        if (response.ok) {
          const data = await response.json()
          // Use explicit format field to determine parsing strategy
          if (proxy.format === 'allorigins') {
            if (data.contents) {
              const repoData = typeof data.contents === 'string' ? JSON.parse(data.contents) : data.contents
              return repoData.default_branch || 'main'
            }
          } else {
            // Direct format - data is the response itself
            if (data.default_branch) {
              return data.default_branch
            }
          }
        }
      } catch (error) {
        continue
      }
    }
    
    // If all else fails, assume 'main'
    return 'main'
  }
  
  // Fetch repository contents with CORS handling
  private static async fetchRepoContents(
    repo: GitHubRepo, 
    branch: string, 
    path: string = ''
  ): Promise<GitHubContent[]> {
    const url = `${this.GITHUB_API_BASE}/repos/${repo.owner}/${repo.repo}/contents/${path}?ref=${branch}`
    
    // Try direct fetch first (might work in some environments)
    try {
      const response = await fetch(url)
      if (response.ok) {
        return response.json()
      }
    } catch (error) {
      // Direct fetch failed, try proxies
    }
    
    // Try CORS proxies
    for (const proxy of this.CORS_PROXIES) {
      try {
        const proxyUrl = proxy.url + encodeURIComponent(url)
        const response = await fetch(proxyUrl)
        
        if (response.ok) {
          const data = await response.json()
          // Use explicit format field to determine parsing strategy
          if (proxy.format === 'allorigins') {
            if (data.contents) {
              return Array.isArray(data.contents) ? data.contents : [data.contents]
            }
          } else {
            // Direct format - data is the response itself
            if (Array.isArray(data)) {
              return data
            }
          }
        }
      } catch (error) {
        continue
      }
    }
    
    throw new Error(`Failed to fetch repository contents. The GitHub API may be blocked by CORS in your browser. Please try using a different browser or environment.`)
  }
  
  // Fetch file content with CORS handling
  private static async fetchFileContent(downloadUrl: string): Promise<string> {
    // Try direct fetch first
    try {
      const response = await fetch(downloadUrl)
      if (response.ok) {
        return response.text()
      }
    } catch (error) {
      // Direct fetch failed, try proxies
    }
    
    // Try CORS proxies
    for (const proxy of this.CORS_PROXIES) {
      try {
        const proxyUrl = proxy.url + encodeURIComponent(downloadUrl)
        const response = await fetch(proxyUrl)
        
        if (response.ok) {
          const data = await response.json()
          // Use explicit format field to determine parsing strategy
          if (proxy.format === 'allorigins') {
            if (data.contents) {
              return typeof data.contents === 'string' ? data.contents : JSON.stringify(data.contents)
            }
          } else {
            // Direct format - data is the content itself
            if (typeof data === 'string') {
              return data
            }
          }
        }
      } catch (error) {
        continue
      }
    }
    
    throw new Error(`Failed to download file. The request may be blocked by CORS in your browser.`)
  }
  
  // List available skills in a repository
  static async listSkills(repo: GitHubRepo): Promise<Array<{ name: string, description?: string }>> {
    const branch = repo.branch || await this.getDefaultBranch(repo)
    
    try {
      const contents = await this.fetchRepoContents(repo, branch)
      const skillsDir = contents.find(item => item.name === 'skills' && item.type === 'dir')
      
      if (!skillsDir) {
        return []
      }
      
      const skillEntries = await this.fetchRepoContents(repo, branch, 'skills')
      return skillEntries
        .filter(item => item.type === 'dir')
        .map(item => ({ name: item.name }))
    } catch (error) {
      console.error('Failed to list skills:', error)
      return []
    }
  }

  // Search skills.sh for popular skills
  static async searchSkills(query?: string): Promise<PopularSkill[]> {
    // These are official and popular skills from the skills.sh ecosystem
    const popularSkills: PopularSkill[] = [
      {
        name: 'agent-skills',
        description: 'Official collection of skills from Vercel Labs (React, UI, etc.)',
        repo: 'vercel-labs/agent-skills',
        tags: ['official', 'react', 'nextjs', 'ui', 'vercel']
      },
      {
        name: 'claude-code-skills',
        description: 'Skills optimized for Claude Code and terminal agents',
        repo: 'anthropics/claude-code',
        tags: ['anthropic', 'terminal', 'coding']
      },
      {
        name: 'web-search',
        description: 'Search the web using various providers',
        repo: 'vercel-labs/agent-skills',
        tags: ['search', 'web', 'tools']
      },
      {
        name: 'github-tools',
        description: 'Interact with GitHub repositories and issues',
        repo: 'vercel-labs/agent-skills',
        tags: ['github', 'git', 'dev-tools']
      },
      {
        name: 'file-management',
        description: 'Advanced file system operations for agents',
        repo: 'vercel-labs/agent-skills',
        tags: ['fs', 'files', 'utils']
      }
    ]
    
    if (query) {
      const lowerQuery = query.toLowerCase()
      return popularSkills.filter(skill => 
        skill.name.toLowerCase().includes(lowerQuery) ||
        skill.description.toLowerCase().includes(lowerQuery) ||
        skill.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
        skill.repo.toLowerCase().includes(lowerQuery)
      )
    }
    
    return popularSkills
  }
}

interface GitHubContent {
  name: string
  type: 'file' | 'dir'
  download_url?: string
}

export interface PopularSkill {
  name: string
  description: string
  repo: string
  tags: string[]
}

// Re-export converter
export { JS_to_Python_Converter }
