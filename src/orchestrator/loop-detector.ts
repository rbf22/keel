import { logger } from "../logger";

export class LoopDetector {
  private skillExecutionHistory: string[] = [];
  private readonly maxSkillHistoryLength = 10;

  /**
   * Detect if we're in a repeating skill cycle
   */
  detectSkillCycle(): boolean {
    if (this.skillExecutionHistory.length < 6) return false;
    
    const legitimatePatterns = [
      ['research', 'data-analysis', 'python-coding', 'quality-review'],
      ['task-planning', 'research', 'data-analysis', 'python-coding'],
      ['python-coding', 'quality-review', 'python-coding'],
      ['research', 'python-coding', 'quality-review'],
      ['python-coding', 'quality-review']
    ];
    
    for (let cycleLength = 2; cycleLength <= 4; cycleLength++) {
      if (this.skillExecutionHistory.length < cycleLength * 2) continue;
      
      const recentSkills = this.skillExecutionHistory.slice(-cycleLength);
      
      const isLegitimatePattern = legitimatePatterns.some(pattern => 
        pattern.length === cycleLength && 
        pattern.every((skill, index) => skill === recentSkills[index])
      );
      
      if (isLegitimatePattern) continue;
      
      let consecutiveRepetitions = 0;
      let maxConsecutiveRepetitions = 0;
      
      for (let i = this.skillExecutionHistory.length - cycleLength; i >= cycleLength - 1; i -= cycleLength) {
        const candidateSequence = this.skillExecutionHistory.slice(i - cycleLength + 1, i + 1);
        
        if (candidateSequence.length === recentSkills.length &&
            candidateSequence.every((skill, index) => skill === recentSkills[index])) {
          consecutiveRepetitions++;
          maxConsecutiveRepetitions = Math.max(maxConsecutiveRepetitions, consecutiveRepetitions);
        } else {
          consecutiveRepetitions = 0;
        }
      }
      
      if (maxConsecutiveRepetitions >= 4) {
        logger.warn('orchestrator', 'Detected repeating skill cycle', {
          cycleLength,
          pattern: recentSkills.join(' -> '),
          repetitions: maxConsecutiveRepetitions
        });
        return true;
      }
    }
    
    return false;
  }

  addSkillToHistory(skillName: string): void {
    this.skillExecutionHistory.push(skillName);
    if (this.skillExecutionHistory.length > this.maxSkillHistoryLength) {
      this.skillExecutionHistory.shift();
    }
  }

  reset(): void {
    this.skillExecutionHistory = [];
  }

  getHistory(): string[] {
    return [...this.skillExecutionHistory];
  }
}
