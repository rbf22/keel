import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SkillStorage, type StoredSkill } from './skills';
import { logger } from '../logger';

describe('SkillStorage - Transaction Safety', () => {
  let storage: SkillStorage;

  beforeEach(() => {
    storage = new SkillStorage();
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockSkill = (name: string): StoredSkill => ({
    name,
    description: `Test skill ${name}`,
    source: 'test://source',
    content: `---\nname: ${name}\ndescription: Test skill\n---\n\nThis is a test skill.`,
    converted: false,
    downloadDate: new Date(),
    tags: ['test']
  });

  it('should validate JSON before importing', async () => {
    const invalidJSON = '{ invalid json }';
    
    await expect(storage.importSkills(invalidJSON)).rejects.toThrow('Invalid JSON data');
  });

  it('should validate array structure', async () => {
    const notAnArray = JSON.stringify({ skill: 'not an array' });
    
    await expect(storage.importSkills(notAnArray)).rejects.toThrow('Import data must be an array of skills');
  });

  it('should validate each skill before starting import', async () => {
    const skills = [
      createMockSkill('valid-skill'),
      { name: '', description: 'missing content', content: '', source: '', downloadDate: new Date() }, // Invalid
      createMockSkill('another-valid')
    ];
    
    // Mock saveSkill to track calls
    storage.saveSkill = vi.fn().mockResolvedValue(undefined);
    
    await expect(storage.importSkills(JSON.stringify(skills))).rejects.toThrow('Invalid skill: missing required fields');
    
    // No skills should be saved
    expect(storage.saveSkill).not.toHaveBeenCalled();
  });

  it('should rollback on partial failure', async () => {
    const skills = [
      createMockSkill('skill1'),
      createMockSkill('skill2'),
      createMockSkill('skill3')
    ];
    
    // Mock saveSkill to succeed for first two, fail for third
    let callCount = 0;
    storage.saveSkill = vi.fn().mockImplementation(async (skill) => {
      callCount++;
      if (callCount <= 2) {
        return; // Success
      }
      throw new Error('Storage full');
    });
    
    // Mock deleteSkill for rollback
    storage.deleteSkill = vi.fn().mockResolvedValue(undefined);
    
    await expect(storage.importSkills(JSON.stringify(skills))).rejects.toThrow('Import failed after 2 skills. Changes have been rolled back.');
    
    // Should attempt to delete the first two skills
    expect(storage.deleteSkill).toHaveBeenCalledWith('skill1');
    expect(storage.deleteSkill).toHaveBeenCalledWith('skill2');
    expect(storage.deleteSkill).not.toHaveBeenCalledWith('skill3');
  });

  it('should import all skills successfully', async () => {
    const skills = [
      createMockSkill('skill1'),
      createMockSkill('skill2'),
      createMockSkill('skill3')
    ];
    
    // Mock saveSkill to succeed
    storage.saveSkill = vi.fn().mockResolvedValue(undefined);
    
    const result = await storage.importSkills(JSON.stringify(skills));
    
    expect(result).toBe(3);
    expect(storage.saveSkill).toHaveBeenCalledTimes(3);
    // Check that saveSkill was called (the objects are modified by JSON.parse)
    expect(storage.saveSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'skill1',
        description: 'Test skill skill1',
        source: 'test://source',
        tags: ['test']
      })
    );
    expect(storage.saveSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'skill2',
        description: 'Test skill skill2',
        source: 'test://source',
        tags: ['test']
      })
    );
    expect(storage.saveSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'skill3',
        description: 'Test skill skill3',
        source: 'test://source',
        tags: ['test']
      })
    );
  });

  it('should handle rollback errors gracefully', async () => {
    const skills = [createMockSkill('skill1'), createMockSkill('skill2')];
    
    // Mock saveSkill to succeed first, then fail
    let callCount = 0;
    storage.saveSkill = vi.fn().mockImplementation(async (skill) => {
      callCount++;
      if (callCount === 1) {
        return; // Success for first skill
      }
      throw new Error('Save failed on second skill');
    });
    
    // Mock deleteSkill to fail during rollback
    storage.deleteSkill = vi.fn().mockRejectedValue(new Error('Delete failed'));
    
    await expect(storage.importSkills(JSON.stringify(skills))).rejects.toThrow('Import failed after 1 skills. Changes have been rolled back.');
    
    // Should attempt rollback despite error
    expect(storage.deleteSkill).toHaveBeenCalledWith('skill1');
    
    // Should log rollback error
    expect(logger.error).toHaveBeenCalledWith('skills', `Failed to rollback skill skill1`, expect.any(Object));
  });

  it('should preserve skill data during successful import', async () => {
    const skills = [
      createMockSkill('skill1'),
      createMockSkill('skill2')
    ];
    
    // Mock saveSkill to capture the data
    const savedSkills: StoredSkill[] = [];
    storage.saveSkill = vi.fn().mockImplementation(async (skill) => {
      savedSkills.push(skill);
    });
    
    await storage.importSkills(JSON.stringify(skills));
    
    // Verify all skills were saved with correct data
    expect(savedSkills).toHaveLength(2);
    
    // Check each skill has the right properties (dates become strings after JSON.parse)
    expect(savedSkills[0]).toMatchObject({
      name: 'skill1',
      description: 'Test skill skill1',
      source: 'test://source',
      tags: ['test'],
      converted: false
    });
    expect(savedSkills[1]).toMatchObject({
      name: 'skill2',
      description: 'Test skill skill2',
      source: 'test://source',
      tags: ['test'],
      converted: false
    });
    
    // Verify content is preserved
    expect(savedSkills[0].content).toContain('name: skill1');
    expect(savedSkills[1].content).toContain('name: skill2');
  });

  it('should handle large number of skills efficiently', async () => {
    // Create 100 skills
    const skills = Array.from({ length: 100 }, (_, i) => 
      createMockSkill(`skill-${i}`)
    );
    
    // Mock saveSkill to track performance
    const saveTimes: number[] = [];
    storage.saveSkill = vi.fn().mockImplementation(async (skill) => {
      const start = Date.now();
      await new Promise(resolve => setTimeout(resolve, 0)); // Simulate async work
      saveTimes.push(Date.now() - start);
    });
    
    const startTime = Date.now();
    const result = await storage.importSkills(JSON.stringify(skills));
    const endTime = Date.now();
    
    expect(result).toBe(100);
    expect(storage.saveSkill).toHaveBeenCalledTimes(100);
    
    // Should complete in reasonable time (less than 5 seconds for 100 skills)
    expect(endTime - startTime).toBeLessThan(5000);
    
    // Each save should be relatively fast (less than 100ms average)
    const avgSaveTime = saveTimes.reduce((a, b) => a + b, 0) / saveTimes.length;
    expect(avgSaveTime).toBeLessThan(100);
  });

  it('should validate required fields individually', async () => {
    const testCases = [
      { skill: { ...createMockSkill('test'), name: undefined }, expectedError: 'missing required fields' },
      { skill: { ...createMockSkill('test'), name: '' }, expectedError: 'missing required fields' },
      { skill: { ...createMockSkill('test'), description: undefined }, expectedError: 'missing required fields' },
      { skill: { ...createMockSkill('test'), description: '' }, expectedError: 'missing required fields' },
      { skill: { ...createMockSkill('test'), content: undefined }, expectedError: 'missing required fields' },
      { skill: { ...createMockSkill('test'), content: '' }, expectedError: 'missing required fields' }
    ];
    
    for (const testCase of testCases) {
      await expect(storage.importSkills(JSON.stringify([testCase.skill])))
        .rejects.toThrow(testCase.expectedError);
    }
  });
});
