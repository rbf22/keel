export class StatusBar {
  private statusEl: HTMLElement;
  private pythonStatusEl: HTMLElement;

  constructor() {
    this.statusEl = document.getElementById('status')!;
    this.pythonStatusEl = document.getElementById('pythonStatus')!;
  }

  setStatus(message: string) {
    this.statusEl.textContent = message;
  }

  setPythonStatus(message: string) {
    this.pythonStatusEl.textContent = `(${message})`;
  }
}
