import './style.css'
import { HybridLLMEngine, LocalLLMEngine } from './llm'
import { PythonRuntime } from './python-runtime'
import { PythonOutput, AgentResponse } from './types'
import { logger } from './logger'
import { storage } from './storage'
import { AgentOrchestrator } from './orchestrator'
import { skillsEngine } from './skills/engine'
import { SW_ACTIVATION_TIMEOUT } from './constants'
import { HTML_TEMPLATE } from './ui/html-template'
import { UI } from './ui'

// Global state
let python: PythonRuntime | null = null;
let engine: HybridLLMEngine | null = null;
let currentTaskId = 0;
let currentAbortController: AbortController | null = null;
let environmentInitialized = false;
let environmentInitializing = false;

// Initialize UI
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = HTML_TEMPLATE;

const ui = new UI(
  (text) => handleSend(text),
  () => stopTask(),
  (modelId) => handleInitModel(modelId),
  (apiKey, enabled) => {
    if (engine) engine.setOnlineConfig(apiKey, enabled);
  }
);

// Python output handler
function handlePythonOutput(output: PythonOutput) {
  logger.info('python', `Output: ${output.type}`, { output });
  
  const pythonLogContainer = document.getElementById('pythonLogContainer')!;
  
  if (output.type === 'ready') {
    ui.status.setPythonStatus('Ready');
    pythonLogContainer.textContent = '';
    const readyDiv = document.createElement('div');
    readyDiv.className = 'output-log';
    readyDiv.textContent = 'Python runtime ready.';
    pythonLogContainer.appendChild(readyDiv);
    return;
  }

  if (output.type === 'log') {
    const logDiv = document.createElement('div');
    logDiv.className = 'output-log';
    logDiv.textContent = output.message || '';
    pythonLogContainer.appendChild(logDiv);
  } else if (output.type === 'error') {
    const errDiv = document.createElement('div');
    errDiv.className = 'output-error';
    errDiv.textContent = output.message || '';
    pythonLogContainer.appendChild(errDiv);
  } else if (output.type === 'code') {
    const codeContainer = document.createElement('div');
    codeContainer.className = 'output-code-block';
    // ... (rest remains same but appending to pythonLogContainer)
    codeContainer.style.margin = '10px 0';
    codeContainer.style.padding = '10px';
    codeContainer.style.background = '#1e1e1e';
    codeContainer.style.borderRadius = '4px';
    codeContainer.style.borderLeft = '4px solid #007AFF';
    
    const codeHeader = document.createElement('div');
    codeHeader.style.fontSize = '0.7rem';
    codeHeader.style.color = '#888';
    codeHeader.style.marginBottom = '5px';
    codeHeader.textContent = 'EXECUTING PYTHON:';
    codeContainer.appendChild(codeHeader);

    const pre = document.createElement('pre');
    pre.style.margin = '0';
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.wordBreak = 'break-all';
    pre.style.fontSize = '0.85rem';
    pre.style.color = '#d4d4d4';
    pre.textContent = output.content || '';
    codeContainer.appendChild(pre);
    
    pythonLogContainer.appendChild(codeContainer);
  } else if (output.type === 'vfs_write' && output.path && output.content) {
    void storage.writeFile(output.path, output.content).then(() => {
      logger.info('python', `File saved to VFS: ${output.path}`);
      void ui.vfs.refresh();
    });
  } else if (output.type === 'download' && output.filename && output.content) {
    const link = document.createElement('a');
    link.className = 'download-link';
    const blob = new Blob([output.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = output.filename;
    link.textContent = `Download ${output.filename}`;
    link.onclick = () => setTimeout(() => URL.revokeObjectURL(url), 1000);
    pythonLogContainer.appendChild(link);
  }

  pythonLogContainer.scrollTop = pythonLogContainer.scrollHeight;
}

// Environment initialization
async function initEnvironment(): Promise<void> {
  if (environmentInitialized || environmentInitializing) return;
  
  environmentInitializing = true;
  logger.info('system', 'Initializing environment...');
  ui.status.setStatus("Setting up environment...");
  ui.status.setPythonStatus("Initializing...");
  
  try {
    await storage.init();
    python = new PythonRuntime(handlePythonOutput);
    await python.init();
    await skillsEngine.init();
    await skillsEngine.registerBuiltInSkills();
    
    void ui.skills.refresh();
    void ui.vfs.refresh();
    
    environmentInitialized = true;
    logger.info('system', 'Environment initialized');
    ui.status.setStatus("Environment ready - select model");
    ui.status.setPythonStatus("Ready");

    // Zero-cache redirect: check if any models are cached
    const cachedModels = await LocalLLMEngine.getAllCachedModels();
    const cachedIds = cachedModels.filter(m => !m.isCorrupted).map(m => m.modelId);
    ui.chat.updateCachedModels(cachedIds);

    if (cachedIds.length === 0) {
      logger.info('system', 'No cached models found, redirecting to Models tab');
      ui.setTab('models');
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('system', `Environment init failed: ${errorMessage}`, { error: err });
    ui.status.setStatus(`Environment Error: ${errorMessage}`);
    throw err;
  } finally {
    environmentInitializing = false;
  }
}

// Model initialization
async function handleInitModel(modelId: string) {
  if (!modelId) return;
  
  if (engine) {
    ui.status.setStatus("Unloading current model...");
    await engine.unload();
  }

  logger.info('main', 'Initializing model', { modelId });
  ui.chat.setInitializing(true);
  ui.status.setStatus("Initializing model...");
  
  try {
    if (!environmentInitialized) await initEnvironment();
    
    // Service Worker check/registration
    if ('serviceWorker' in navigator && !navigator.serviceWorker.controller) {
      const baseUrl = (import.meta as any).env.BASE_URL || '/';
      const registration = await navigator.serviceWorker.register(`${baseUrl}sw.js`, { 
        type: 'module',
        scope: baseUrl 
      });
      
      let worker = registration.installing || registration.waiting || registration.active;
      if (worker && worker.state !== 'activated') {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('SW timeout')), SW_ACTIVATION_TIMEOUT);
          worker?.addEventListener('statechange', (e) => {
            if ((e.target as ServiceWorker).state === 'activated') {
              clearTimeout(timeout);
              resolve();
            }
          });
        });
      }
    }
    
    const localEngine = new LocalLLMEngine(modelId, (msg) => ui.status.setStatus(msg));
    engine = new HybridLLMEngine(localEngine);
    
    // Apply current settings
    const apiKey = (document.getElementById('geminiApiKey') as HTMLInputElement).value.trim();
    const onlineEnabled = (document.getElementById('onlineModeToggle') as HTMLInputElement).checked;
    engine.setOnlineConfig(apiKey, onlineEnabled);

    await engine.init();
    logger.info('system', 'Model initialized');
    ui.status.setStatus("Keel Ready");
    ui.chat.setInputDisabled(false);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('system', `Init failed: ${errorMessage}`, { error: err });
    ui.status.setStatus(`Error: ${errorMessage}`);
  } finally {
    ui.chat.setInitializing(false);
  }
}

// Clear Python Output handler
const clearPythonBtn = document.getElementById('clearPythonBtn') as HTMLButtonElement;
clearPythonBtn.onclick = () => {
  const container = document.getElementById('pythonLogContainer')!;
  container.innerHTML = '<div class="output-log">Output cleared.</div>';
};

// Send message handler
async function handleSend(text: string) {
  if (!text || !engine || !python) return;

  const taskId = ++currentTaskId;
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

  logger.info('main', 'Processing task', { taskId, inputLength: text.length });
  ui.chat.setTaskRunning(true);

  const orchestrator = new AgentOrchestrator(engine, python);
  const agentDivs: Record<string, HTMLDivElement> = {};

  try {
    await orchestrator.runTask(text, (update: AgentResponse) => {
      if (taskId !== currentTaskId || signal.aborted) return;
      
      if (!agentDivs[update.personaId]) {
        const div = document.createElement('div');
        div.className = `message assistant-message agent-${update.personaId}`;
        div.innerHTML = `<div class="agent-label">${update.personaId.toUpperCase()}</div><div class="agent-content"></div>`;
        document.getElementById('messages')!.appendChild(div);
        agentDivs[update.personaId] = div;
      }
      
      const contentDiv = agentDivs[update.personaId].querySelector('.agent-content')!;

      if (update.type === 'error') {
        const errDiv = document.createElement('div');
        errDiv.className = 'output-error';
        errDiv.textContent = update.content;
        contentDiv.appendChild(errDiv);
      } else if (update.type === 'observation') {
        const obsDiv = document.createElement('div');
        obsDiv.className = 'output-log';
        obsDiv.style.borderLeft = '2px solid #ff2d55';
        obsDiv.style.paddingLeft = '5px';
        obsDiv.style.fontSize = '0.75rem';
        obsDiv.textContent = update.content;
        contentDiv.appendChild(obsDiv);
      } else {
        contentDiv.textContent = update.content;
      }

      const messagesEl = document.getElementById('messages')!;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  } catch (err) {
    if (taskId !== currentTaskId || signal.aborted) return;
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('main', 'Task failed', { taskId, error: errorMessage });
    ui.chat.addMessage(`Error: ${errorMessage}`, 'assistant');
  } finally {
    if (taskId === currentTaskId) {
      ui.chat.setTaskRunning(false);
    }
  }
}

function stopTask() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
    logger.info('main', 'Task stopped by user');
  }
}

// Initial environment setup
void initEnvironment();
