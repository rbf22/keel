import { getSortedModelList } from "../llm/models";

export class ChatPanel {
  private messagesEl: HTMLElement;
  private userInput: HTMLInputElement;
  private sendBtn: HTMLButtonElement;
  private stopBtn: HTMLButtonElement;
  private modelSelect: HTMLSelectElement;
  private initBtn: HTMLButtonElement;

  private onSendMessage: (text: string) => void;
  private onStopTask: () => void;
  private onInitRequested: (modelId: string) => void;

  constructor(
    onSendMessage: (text: string) => void, 
    onStopTask: () => void,
    onInitRequested: (modelId: string) => void
  ) {
    this.messagesEl = document.getElementById('messages')!;
    this.userInput = document.getElementById('userInput')! as HTMLInputElement;
    this.sendBtn = document.getElementById('sendBtn')! as HTMLButtonElement;
    this.stopBtn = document.getElementById('stopBtn')! as HTMLButtonElement;
    this.modelSelect = document.getElementById('modelSelect')! as HTMLSelectElement;
    this.initBtn = document.getElementById('initBtn')! as HTMLButtonElement;

    this.onSendMessage = onSendMessage;
    this.onStopTask = onStopTask;
    this.onInitRequested = onInitRequested;

    this.init();
  }

  private init() {
    this.sendBtn.onclick = () => this.handleSendMessage();
    this.stopBtn.onclick = () => this.onStopTask();
    this.initBtn.onclick = () => this.onInitRequested(this.modelSelect.value);

    this.userInput.onkeydown = (e) => {
      if (e.key === 'Enter' && !this.userInput.disabled) {
        this.handleSendMessage();
      }
    };

    this.modelSelect.onchange = () => {
      if (this.modelSelect.value) {
        this.onInitRequested(this.modelSelect.value);
      }
    };
  }

  private handleSendMessage() {
    const text = this.userInput.value.trim();
    if (text) {
      this.onSendMessage(text);
      this.userInput.value = '';
    }
  }

  async updateCachedModels(cachedModelIds: string[]) {
    const currentVal = this.modelSelect.value;
    
    if (cachedModelIds.length === 0) {
      this.modelSelect.innerHTML = '<option value="">No cached models...</option>';
      this.modelSelect.style.display = 'block';
      this.setInputDisabled(true);
      return;
    }

    const supportedModels = await getSortedModelList();
    const options = cachedModelIds.map(id => {
      const model = supportedModels.find(m => m.modelId === id);
      return `<option value="${id}">${model?.displayName || id}</option>`;
    });

    this.modelSelect.innerHTML = '<option value="">Select model...</option>' + options.join('');
    this.modelSelect.style.display = 'block';
    
    if (cachedModelIds.includes(currentVal)) {
      this.modelSelect.value = currentVal;
    }
  }

  addMessage(text: string, role: 'user' | 'assistant' | 'system') {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}-message`;
    msgDiv.textContent = text;
    this.messagesEl.appendChild(msgDiv);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return msgDiv;
  }

  updateAssistantMessage(msgDiv: HTMLElement, text: string) {
    msgDiv.textContent = text;
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  setTaskRunning(running: boolean) {
    this.stopBtn.style.display = running ? 'block' : 'none';
    this.sendBtn.style.display = running ? 'none' : 'block';
    this.userInput.disabled = running;
    
    if (running) {
       this.userInput.placeholder = "Agent is thinking...";
    } else {
       this.userInput.placeholder = "Type a message...";
       this.userInput.focus();
    }
  }

  setInputDisabled(disabled: boolean) {
    this.userInput.disabled = disabled;
    this.sendBtn.disabled = disabled;
    this.modelSelect.disabled = disabled;
  }

  setInitializing(initializing: boolean) {
    this.modelSelect.disabled = initializing;
    this.initBtn.disabled = initializing;
    this.initBtn.textContent = initializing ? "Initializing..." : "Initialize";
    this.initBtn.style.display = initializing ? "block" : "none";
  }
}
