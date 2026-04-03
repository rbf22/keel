import { ChatPanel } from "./chat-panel";
import { LogPanel } from "./log-panel";
import { StatusBar } from "./status-bar";
import { VFSPanel } from "./vfs-panel";
import { SettingsPanel } from "./settings-panel";
import { SkillsPanel } from "./skills-panel";

export class UI {
  public chat: ChatPanel;
  public logs: LogPanel;
  public status: StatusBar;
  public vfs: VFSPanel;
  public settings: SettingsPanel;
  public skills: SkillsPanel;

  constructor(
    onSendMessage: (text: string) => void,
    onStopTask: () => void,
    onInitRequested: (modelId: string) => void
  ) {
    this.chat = new ChatPanel(onSendMessage, onStopTask, onInitRequested);
    this.logs = new LogPanel();
    this.status = new StatusBar();
    this.vfs = new VFSPanel();
    this.settings = new SettingsPanel((modelId: string) => {
      // Sync model selection to chat panel when changed in settings
      if (this.chat) {
        // Update the model select in chat panel
        const chatModelSelect = document.getElementById('modelSelect') as HTMLSelectElement;
        if (chatModelSelect) {
          chatModelSelect.value = modelId;
        }
        
        // Trigger initialization
        onInitRequested(modelId);
      }
    });
    this.skills = new SkillsPanel();

    this.initTabs();
  }

  private initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = (btn as HTMLButtonElement).dataset.tab;

        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update content
        document.querySelectorAll('.output-content').forEach(c => {
          (c as HTMLElement).style.display = 'none';
          c.classList.remove('active');
        });
        const activeContent = document.querySelector(`.output-content[data-tab-content="${tab}"]`) as HTMLElement;
        if (activeContent) {
          activeContent.style.display = 'flex';
          activeContent.classList.add('active');
        }

        // Tab-specific refreshes
        if (tab === 'context') {
          void this.vfs.refresh();
        }
        
        if (tab === 'models') {
          void this.settings.updateModelSelectWithCacheStatus();
          void this.settings.updateModelsDisplay();
        }

        if (tab === 'logs') {
          this.logs.clearNotification();
        }
      });
    });
  }

  public setTab(tab: string) {
    const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`) as HTMLButtonElement;
    if (btn) {
      btn.click();
    }
  }
}
