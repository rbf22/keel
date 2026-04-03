import './style.css'
import { LocalLLMEngine } from './llm'
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
let engine: LocalLLMEngine | null = null;
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
  (modelId) => handleInitModel(modelId)
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

// Environment initialization (optimized)
async function initEnvironment(): Promise<void> {
  console.log("🚀 initEnvironment() called!");
  
  if (environmentInitialized || environmentInitializing) {
    console.log("⚠️ Environment already initialized or initializing");
    return;
  }
  
  environmentInitializing = true;
  console.log("🔥 Starting environment initialization...");
  logger.info('system', 'Initializing environment...');
  ui.status.setStatus("Setting up environment...");
  ui.status.setPythonStatus("Initializing...");
  
  try {
    // Critical path only - initialize storage first
    await storage.init();
    
    // Initialize Python runtime (non-blocking)
    python = new PythonRuntime(handlePythonOutput);
    void python.init().then(() => {
      console.log("✅ Python runtime ready");
    }).catch(err => {
      console.error("❌ Python runtime failed:", err);
    });
    
    // Initialize skills engine (non-blocking)
    void skillsEngine.init().then(() => {
      console.log("✅ Skills engine ready");
      return skillsEngine.registerBuiltInSkills();
    }).then(() => {
      console.log("✅ Built-in skills registered");
      void ui.skills.refresh();
    }).catch(err => {
      console.error("❌ Skills engine failed:", err);
    });
    
    // Model sizes will be calculated on-demand during discovery
    
    // Initialize UI components (non-blocking)
    void ui.vfs.refresh();
    
    environmentInitialized = true;
    logger.info('system', 'Environment initialized');
    ui.status.setStatus("Environment ready - select model");
    ui.status.setPythonStatus("Loading...");

    // Get cached models quickly (non-blocking)
    void LocalLLMEngine.getAllCachedModels().then(cachedModels => {
      const cachedIds = cachedModels.filter(m => !m.isCorrupted).map(m => m.modelId);
      void ui.chat.updateCachedModels(cachedIds);
      
      if (cachedIds.length === 0) {
        logger.info('system', 'No cached models found, redirecting to Models tab');
        ui.setTab('models');
      }
    }).catch(err => {
      console.error("❌ Failed to get cached models:", err);
    });
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('system', 'Environment initialization failed', { error: errorMessage });
    ui.status.setStatus(`Error: ${errorMessage}`);
  } finally {
    environmentInitializing = false;
  }
}

// Model initialization
async function handleInitModel(modelId: string) {
  if (!modelId) return;
  
  // Validate that the model is available before attempting initialization
  try {
    const cachedModels = await LocalLLMEngine.getAllCachedModels();
    const availableModel = cachedModels.find(m => m.modelId === modelId && !m.isCorrupted && !m.isEmpty);
    
    if (!availableModel) {
      logger.warn('main', `Model ${modelId} is not available, skipping initialization`);
      ui.status.setStatus(`Model ${modelId} not available. Please select a different model.`);
      return;
    }
    
    logger.info('main', `Model ${modelId} is available, proceeding with initialization`);
  } catch (error) {
    logger.error('main', 'Failed to check model availability', { error: error instanceof Error ? error.message : String(error) });
    // Continue anyway and let the engine handle the error
  }
  
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
    engine = localEngine;

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
        // For system messages, append to show all updates
        if (update.personaId === 'system') {
          const msgDiv = document.createElement('div');
          msgDiv.textContent = update.content;
          msgDiv.style.marginBottom = '4px';
          contentDiv.appendChild(msgDiv);
        } else {
          // For other personas, overwrite as before
          contentDiv.textContent = update.content;
        }
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
console.log("🚀 SCRIPT IS RUNNING!");
console.log("🚀 About to call initEnvironment() from script bottom");
void initEnvironment();
