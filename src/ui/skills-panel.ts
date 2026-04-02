import { logger } from "../logger";
import { skillsEngine } from "../skills/engine";
import { SkillsDownloader } from "../skills/downloader";
import { skillStorage } from "../storage/skills";
import { ParsedSkill } from "../skills/parser";

export class SkillsPanel {
  private skillsList: HTMLElement;
  private skillSearchInput: HTMLInputElement;
  private installSkillBtn: HTMLButtonElement;
  private refreshSkillsBtn: HTMLButtonElement;
  private skillDetails: HTMLElement;
  private skillName: HTMLElement;
  private skillDescription: HTMLElement;
  private skillContent: HTMLElement;

  constructor() {
    this.skillsList = document.getElementById('skillsList')!;
    this.skillSearchInput = document.getElementById('skillSearchInput')! as HTMLInputElement;
    this.installSkillBtn = document.getElementById('installSkillBtn')! as HTMLButtonElement;
    this.refreshSkillsBtn = document.getElementById('refreshSkillsBtn')! as HTMLButtonElement;
    this.skillDetails = document.getElementById('skillDetails')!;
    this.skillName = document.getElementById('skillName')!;
    this.skillDescription = document.getElementById('skillDescription')!;
    this.skillContent = document.getElementById('skillContent')!;

    this.init();
  }

  private init() {
    this.installSkillBtn.onclick = () => this.installSkill();
    this.refreshSkillsBtn.onclick = () => this.refresh();
    this.skillSearchInput.oninput = () => this.filter();
  }

  async refresh() {
    const allSkills = skillsEngine.getAllSkillsMetadata();
    
    if (allSkills.length === 0) {
      this.skillsList.innerHTML = '<div class="output-log">No skills installed. Click "Install Skill" to add skills from GitHub.</div>';
      return;
    }
    
    this.skillsList.innerHTML = '';
    
    for (const skill of allSkills) {
      const skillDiv = document.createElement('div');
      const isActive = skillsEngine.isSkillActive(skill.name);
      skillDiv.className = `skill-item ${!isActive ? 'inactive' : ''}`;
      skillDiv.innerHTML = `
        <div class="skill-header">
          <h4>${skill.name}</h4>
          <button class="skill-toggle-btn" data-skill="${skill.name}" data-active="${isActive}">
            ${isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>
        <p>${skill.description}</p>
        ${skill.tags ? `<div class="skill-tags">${skill.tags.map((tag: string) => `<span class="skill-tag">${tag}</span>`).join('')}</div>` : ''}
      `;
      
      skillDiv.onclick = async (e) => {
        if (!(e.target as HTMLElement).classList.contains('skill-toggle-btn')) {
          const fullSkill = await skillsEngine.getFullSkill(skill.name);
          if (fullSkill) {
            this.showSkillDetails(fullSkill);
          }
        }
      };
      
      this.skillsList.appendChild(skillDiv);
    }
    
    this.skillsList.querySelectorAll<HTMLButtonElement>('.skill-toggle-btn').forEach(btn => {
      btn.onclick = async (e: MouseEvent) => {
        e.stopPropagation();
        const skillName = (btn as HTMLButtonElement).dataset.skill!;
        try {
          const isActive = skillsEngine.toggleSkill(skillName);
          btn.textContent = isActive ? 'Deactivate' : 'Activate';
          btn.dataset.active = String(isActive);
          
          // Update the parent item's class
          const skillItem = btn.closest('.skill-item');
          if (skillItem) {
            if (isActive) {
              skillItem.classList.remove('inactive');
            } else {
              skillItem.classList.add('inactive');
            }
          }
        } catch (error) {
          console.error('Failed to toggle skill:', error);
          alert(`Failed to toggle skill "${skillName}": ${error}`);
        }
      };
    });
  }

  private showSkillDetails(skill: ParsedSkill) {
    this.skillName.textContent = skill.name;
    this.skillDescription.textContent = skill.description;
    
    const container = document.createElement('div');
    
    const instructionsDiv = document.createElement('div');
    instructionsDiv.className = 'skill-instructions';
    const instructionsHeader = document.createElement('h5');
    instructionsHeader.textContent = 'Instructions:';
    instructionsDiv.appendChild(instructionsHeader);
    const instructionsPre = document.createElement('pre');
    instructionsPre.textContent = skill.instructions;
    instructionsDiv.appendChild(instructionsPre);
    container.appendChild(instructionsDiv);
    
    if (skill.codeBlocks.length > 0) {
      const codeDiv = document.createElement('div');
      codeDiv.className = 'skill-code';
      const codeHeader = document.createElement('h5');
      codeHeader.textContent = 'Code:';
      codeDiv.appendChild(codeHeader);
      
      for (const block of skill.codeBlocks) {
        const blockDiv = document.createElement('div');
        blockDiv.className = 'code-block';
        
        const langSpan = document.createElement('span');
        langSpan.className = 'code-language';
        langSpan.textContent = block.language;
        blockDiv.appendChild(langSpan);
        
        const codePre = document.createElement('pre');
        const codeEl = document.createElement('code');
        codeEl.textContent = block.code;
        codePre.appendChild(codeEl);
        blockDiv.appendChild(codePre);
        
        codeDiv.appendChild(blockDiv);
      }
      
      container.appendChild(codeDiv);
    }
    
    this.skillContent.innerHTML = '';
    this.skillContent.appendChild(container);
    this.skillDetails.style.display = 'block';
  }

  async installSkill() {
    const input = prompt('Enter GitHub repository (owner/repo or full URL):');
    if (!input) return;
    
    const repo = SkillsDownloader.parseRepoUrl(input);
    if (!repo) {
      alert('Invalid repository format. Use "owner/repo" or full GitHub URL.');
      return;
    }
    
    try {
      this.installSkillBtn.disabled = true;
      this.installSkillBtn.textContent = 'Listing...';
      
      const availableSkills = await SkillsDownloader.listSkills(repo);
      
      if (availableSkills.length === 0) {
        alert('No skills found in this repository. Ensure it has a "skills" directory with SKILL.md files.');
        return;
      }
      
      const skillNamesStr = prompt(
        `Found ${availableSkills.length} skills in ${repo.owner}/${repo.repo}:\n` +
        availableSkills.map(s => `- ${s.name}`).join('\n') +
        `\n\nEnter skill names to install (comma-separated, or leave empty for all):`
      );
      
      const selectedNames = skillNamesStr 
        ? skillNamesStr.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;

      this.installSkillBtn.textContent = 'Installing...';
      
      const downloaded = await SkillsDownloader.downloadSkills(repo, (progress) => {
        logger.info('skills', `Download progress for ${progress.skillName}`, { 
          status: progress.status, 
          progress: progress.progress 
        });
      }, selectedNames);
      
      for (const skill of downloaded) {
        await skillStorage.saveSkill(skill);
        await skillsEngine.installSkill(skill.name);
      }
      
      await this.refresh();
      alert(`Successfully installed ${downloaded.length} skill(s)`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Failed to install skills: ${errorMessage}`);
    } finally {
      this.installSkillBtn.disabled = false;
      this.installSkillBtn.textContent = 'Install Skill';
    }
  }

  filter() {
    const query = this.skillSearchInput.value.toLowerCase();
    const skillItems = this.skillsList.querySelectorAll('.skill-item');
    
    skillItems.forEach(item => {
      const text = item.textContent!.toLowerCase();
      (item as HTMLElement).style.display = text.includes(query) ? 'block' : 'none';
    });
  }
}
