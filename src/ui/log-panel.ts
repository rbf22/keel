import { logger, type LogEntry } from "../logger";
import { LOG_MAX_ENTRIES, UI_BUTTON_RESET_DELAY } from "../constants";

export class LogPanel {
  private logsContainer: HTMLElement;
  private copyLogsBtn: HTMLButtonElement;
  private logNotificationEl: HTMLElement;
  private initialized = false;

  constructor() {
    this.logsContainer = document.getElementById('logsContainer')!;
    this.copyLogsBtn = document.getElementById('copyLogsBtn')! as HTMLButtonElement;
    this.logNotificationEl = document.getElementById('logNotification')!;

    this.init();
  }

  private init() {
    this.copyLogsBtn.onclick = () => this.copyLogs();

    logger.subscribe((entry: LogEntry) => {
      if (!this.logsContainer) return;
      if (!this.initialized) {
        this.logsContainer.textContent = '';
        this.initialized = true;
      }

      this.addLogEntry(entry);
      this.updateNotification(entry);
    });
  }

  private addLogEntry(entry: LogEntry) {
    const logDiv = document.createElement('div');
    logDiv.className = `log-entry ${entry.level}`;

    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const category = entry.category.toUpperCase();

    const metaSpan = document.createElement('span');
    metaSpan.className = 'log-meta';
    metaSpan.textContent = `[${timestamp}] [${category}] `;
    logDiv.appendChild(metaSpan);

    const msgSpan = document.createElement('span');
    msgSpan.className = 'log-msg';
    msgSpan.textContent = entry.message;
    logDiv.appendChild(msgSpan);

    if (entry.data) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'Data';
      details.appendChild(summary);

      const pre = document.createElement('pre');
      pre.textContent = JSON.stringify(entry.data, null, 2);
      details.appendChild(pre);
      logDiv.appendChild(details);
    }

    this.logsContainer.appendChild(logDiv);
    
    if (this.logsContainer.children.length > LOG_MAX_ENTRIES) {
      const toRemove = this.logsContainer.children.length - LOG_MAX_ENTRIES;
      for (let i = 0; i < toRemove; i++) {
        this.logsContainer.removeChild(this.logsContainer.children[0]);
      }
    }
    
    this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
  }

  private updateNotification(entry: LogEntry) {
    if (entry.level === 'error') {
      const activeTab = document.querySelector('.tab-btn.active') as HTMLButtonElement;
      if (activeTab && activeTab.dataset.tab !== 'logs') {
        this.logNotificationEl.style.display = 'block';
      }
    }
  }

  async copyLogs() {
    const logs = logger.getLogs();
    const logText = logs.map(entry => {
      const timestamp = new Date(entry.timestamp).toISOString();
      const category = entry.category.toUpperCase();
      const level = entry.level.toUpperCase();
      let text = `[${timestamp}] [${category}] [${level}] ${entry.message}`;
      if (entry.data) {
        text += `\nData: ${JSON.stringify(entry.data, null, 2)}`;
      }
      return text;
    }).join('\n\n');

    const fallbackCopy = () => {
      const textArea = document.createElement('textarea');
      textArea.value = logText;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      } catch (err) {
        document.body.removeChild(textArea);
        return false;
      }
    };

    const inIframe = window.parent !== window;

    try {
      if (inIframe) {
        const success = fallbackCopy();
        if (success) {
          this.showCopySuccess();
        } else {
          throw new Error('Fallback copy method failed');
        }
      } else {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(logText);
          this.showCopySuccess();
        } else {
          const success = fallbackCopy();
          if (success) {
            this.showCopySuccess();
          } else {
            throw new Error('Fallback copy method failed');
          }
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('main', 'Failed to copy logs', { error: err, inIframe });
      this.showCopyError(errorMessage);
    }
  }

  private showCopySuccess() {
    const originalText = this.copyLogsBtn.textContent;
    this.copyLogsBtn.textContent = 'Copied!';
    setTimeout(() => {
      this.copyLogsBtn.textContent = originalText;
    }, UI_BUTTON_RESET_DELAY);
  }

  private showCopyError(message: string) {
    const originalText = this.copyLogsBtn.textContent;
    this.copyLogsBtn.textContent = 'Copy Failed!';
    this.copyLogsBtn.style.backgroundColor = '#d32f2f';
    setTimeout(() => {
      this.copyLogsBtn.textContent = originalText;
      this.copyLogsBtn.style.backgroundColor = '';
    }, 3000);
    
    console.error('Failed to copy logs to clipboard. Error:', message);
  }

  clearNotification() {
    this.logNotificationEl.style.display = 'none';
  }
}
