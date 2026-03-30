// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TOOLS } from './tools'

describe('Tools Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Tool Definitions', () => {
    it('should have all required tools defined', () => {
      expect(TOOLS).toHaveProperty('vfs_write')
      expect(TOOLS).toHaveProperty('vfs_read')
      expect(TOOLS).toHaveProperty('vfs_ls')
      expect(TOOLS).toHaveProperty('delegate')
    })

    it('should have proper tool structure', () => {
      Object.values(TOOLS).forEach(tool => {
        expect(tool).toHaveProperty('name')
        expect(tool).toHaveProperty('description')
        expect(tool).toHaveProperty('parameters')
        expect(tool.parameters).toHaveProperty('type', 'object')
        expect(tool.parameters).toHaveProperty('properties')
        expect(tool.parameters).toHaveProperty('required')
      })
    })

    it('should validate vfs_write tool parameters', () => {
      const vfsWrite = TOOLS.vfs_write
      expect(vfsWrite.parameters.required).toEqual(['path', 'content'])
      expect(vfsWrite.parameters.properties.path.type).toBe('string')
      expect(vfsWrite.parameters.properties.content.type).toBe('string')
    })

    it('should validate vfs_read tool parameters', () => {
      const vfsRead = TOOLS.vfs_read
      expect(vfsRead.parameters.required).toEqual(['path'])
      expect(vfsRead.parameters.properties.level.enum).toEqual(['L0', 'L1', 'L2'])
    })

    it('should validate delegate tool parameters', () => {
      const delegate = TOOLS.delegate
      expect(delegate.parameters.required).toEqual(['agent', 'instruction'])
      expect(delegate.parameters.properties.agent.type).toBe('string')
      expect(delegate.parameters.properties.instruction.type).toBe('string')
    })
  })
})
