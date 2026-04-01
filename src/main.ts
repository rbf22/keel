import './style.css'
import { HybridLLMEngine, LocalLLMEngine, SUPPORTED_MODELS, detectBestModel } from './llm'
import { PythonRuntime } from './python-runtime'
import { PythonOutput, AgentResponse } from './types'
import { ParsedSkill } from './skills/parser'
import { logger, type LogEntry } from './logger'
import { storage } from './storage'
import { AgentOrchestrator } from './orchestrator'
import { skillsEngine } from './skills/engine'
import { SkillsDownloader } from './skills/downloader'
import { skillStorage } from './storage/skills'
import { modelStorage } from './storage/models'
import { IndexedDBWrapper } from './storage/indexeddb-wrapper'
import { 
  SW_ACTIVATION_TIMEOUT, 
  SW_CONTROLLER_CLAIM_TIMEOUT, 
  PYTHON_CLEANUP_DELAY, 
  VFS_PAGE_SIZE, 
  LOG_MAX_ENTRIES, 
  UI_BUTTON_RESET_DELAY 
} from './constants'

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <div>
    <h1>Keel 🛰️</h1>
    <div class="status-bar" id="status">Ready</div>

    <div class="main-layout">
      <div class="output-panel">
        <div class="output-tabs">
          <button class="tab-btn active" data-tab="chat">Chat</button>
          <button class="tab-btn" data-tab="context">Context</button>
          <button class="tab-btn" data-tab="python">Python <span id="pythonStatus">(Idle)</span></button>
          <button class="tab-btn" data-tab="skills">Skills</button>
          <button class="tab-btn" data-tab="settings">Settings</button>
          <button class="tab-btn" data-tab="logs">Logs <span id="logNotification" class="notification-dot" style="display: none;"></span></button>
        </div>

        <div class="output-content active" id="chatTab" data-tab-content="chat">
          <div class="chat-container">
            <div class="messages" id="messages">
              <div class="message assistant-message">Hello! I am Keel, your local agentic workstation. Select a model and press "Initialize" to start.</div>
            </div>
            <div class="input-area">
              <input type="text" id="userInput" placeholder="Type a message..." disabled />
              <button id="sendBtn" disabled>Send</button>
              <button id="stopBtn" style="display: none; background-color: #ff3b30;">Stop</button>
            </div>
          </div>
        </div>

        <div class="output-content" id="contextTab" data-tab-content="context" style="display: none;">
          <div class="context-header">
            <span>Keel Virtual Filesystem (keel://)</span>
            <button id="refreshContextBtn">Refresh</button>
          </div>
          <div id="vfsContainer" class="context-container">
            <div class="output-log">Context not initialized.</div>
          </div>
        </div>

        <div class="output-content" id="pythonOutput" data-tab-content="python" style="display: none;">
          <div class="output-log">Python runtime not initialized.</div>
        </div>

        <div class="output-content" id="skillsTab" data-tab-content="skills" style="display: none;">
          <div class="skills-header">
            <h3>Skills</h3>
            <div class="skills-controls">
              <input type="text" id="skillSearchInput" placeholder="Search skills..." />
              <button id="installSkillBtn">Install Skill</button>
              <button id="refreshSkillsBtn">Refresh</button>
            </div>
          </div>
          <div class="skills-content">
            <div class="skills-list" id="skillsList">
              <div class="output-log">Loading skills...</div>
            </div>
            <div class="skill-details" id="skillDetails" style="display: none;">
              <h4 id="skillName"></h4>
              <p id="skillDescription"></p>
              <div id="skillContent"></div>
            </div>
          </div>
        </div>

        <div class="output-content" id="settingsTab" data-tab-content="settings" style="display: none;">
          <div class="settings-container">
            <h3>Settings</h3>
            <div class="settings-subtabs">
              <button class="subtab-btn active" data-subtab="general">General</button>
              <button class="subtab-btn" data-subtab="models">Models</button>
            </div>
            <div class="subtab-content active" id="generalSubtab">
              <div class="settings-group">
                <label for="geminiApiKey">Google Gemini API Key</label>
                <input type="password" id="geminiApiKey" placeholder="Enter your API key...">
                <p class="settings-hint">Your API key is stored locally in your browser.</p>
              </div>
              <div class="settings-group">
                <label class="switch-label">
                  <input type="checkbox" id="onlineModeToggle"> Enable Online Mode (Gemini 1.5 Flash)
                </label>
                <p class="settings-hint">When enabled, Keel will use Google Gemini. If it fails or you're offline, it will automatically fall back to the local LLM.</p>
              </div>
              <button id="saveSettingsBtn">Save Settings</button>
            </div>
            <div class="subtab-content" id="modelsSubtab" style="display: none;">
              <div class="settings-group">
                <h4>Model Storage</h4>
                <div id="storageUsage">Loading...</div>
                <div id="modelsList" class="models-list"></div>
                <div class="model-controls">
                  <button id="refreshModelsBtn">Refresh List</button>
                  <button id="clearAllModelsBtn" class="danger-btn">Clear All Models</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="output-content" id="debugLogs" data-tab-content="logs" style="display: none;">
          <div class="logs-header">
            <button id="copyLogsBtn">Copy Logs</button>
          </div>
          <div id="logsContainer" class="logs-container">
            <div class="output-log">Debug logs will appear here.</div>
          </div>
        </div>
      </div>
    </div>

    <div class="stats" id="stats"></div>
    <div class="controls" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; align-items: center;">
      <div id="setupControls" style="display: flex; flex-direction: column; gap: 0.5rem; align-items: center;">
        <div id="modelSelectContainer">
          <label for="modelSelect">Model:</label>
          <select id="modelSelect">
            ${SUPPORTED_MODELS.map(m => `<option value="${m.modelId}">${m.displayName} (~${m.vramRequiredMB}MB)</option>`).join('')}
          </select>
        </div>
        <button id="initBtn">Initialize Local LLM & Python</button>
      </div>
          </div>
  </div>
`

const statusEl = document.getElementById('status')!
const pythonStatusEl = document.getElementById('pythonStatus')!
const pythonOutputEl = document.getElementById('pythonOutput')!
const modelSelect = document.getElementById('modelSelect')! as HTMLSelectElement
const messagesEl = document.getElementById('messages')!
const userInput = document.getElementById('userInput')! as HTMLInputElement
const sendBtn = document.getElementById('sendBtn')! as HTMLButtonElement
const stopBtn = document.getElementById('stopBtn')! as HTMLButtonElement
const initBtn = document.getElementById('initBtn')! as HTMLButtonElement
const debugLogsEl = document.getElementById('logsContainer')!
const vfsContainer = document.getElementById('vfsContainer')!
const refreshContextBtn = document.getElementById('refreshContextBtn')! as HTMLButtonElement
const copyLogsBtn = document.getElementById('copyLogsBtn')! as HTMLButtonElement
const logNotificationEl = document.getElementById('logNotification')!
const setupControls = document.getElementById('setupControls')!

// Skills elements
const skillsList = document.getElementById('skillsList')!
const skillDetails = document.getElementById('skillDetails')!
const skillName = document.getElementById('skillName')!
const skillDescription = document.getElementById('skillDescription')!
const skillContent = document.getElementById('skillContent')!
const skillSearchInput = document.getElementById('skillSearchInput')! as HTMLInputElement
const installSkillBtn = document.getElementById('installSkillBtn')! as HTMLButtonElement
const refreshSkillsBtn = document.getElementById('refreshSkillsBtn')! as HTMLButtonElement

// Settings elements
const geminiApiKeyInput = document.getElementById('geminiApiKey')! as HTMLInputElement
const onlineModeToggle = document.getElementById('onlineModeToggle')! as HTMLInputElement
const saveSettingsBtn = document.getElementById('saveSettingsBtn')! as HTMLButtonElement

// Model storage elements
const storageUsage = document.getElementById('storageUsage')!
const modelsList = document.getElementById('modelsList')!
const refreshModelsBtn = document.getElementById('refreshModelsBtn')! as HTMLButtonElement
const clearAllModelsBtn = document.getElementById('clearAllModelsBtn')! as HTMLButtonElement


// Tab switching logic
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

    // Special logic for context refresh
    if (tab === 'context') {
        void refreshVFSDisplay();
    }
    
    // Update model select cache status when settings is shown
    if (tab === 'settings') {
        void updateModelSelectWithCacheStatus();
    }

    // Hide notification dot if logs tab is clicked
    if (tab === 'logs') {
      logNotificationEl.style.display = 'none';
    }
  });
});

let engine: HybridLLMEngine | null = null
let python: PythonRuntime | null = null
let chatHistory: { role: 'user' | 'assistant' | 'system'; content: string }[] = []
let isTaskRunning = false;
let currentAbortController: AbortController | null = null;
let currentTaskId = 0;

function setTaskRunning(running: boolean) {
  isTaskRunning = running;
  stopBtn.style.display = running ? 'block' : 'none';
  sendBtn.style.display = running ? 'none' : 'block';
  userInput.disabled = running;
  
  if (isTaskRunning) {
    logger.info('system', 'Task execution started');
  } else {
    currentAbortController = null;
  }
}

stopBtn.onclick = async () => {
  logger.info('main', 'Stop button clicked by user', { 
    currentTaskId, 
    isTaskRunning,
    hasAbortController: !!currentAbortController 
  });
  
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  
  if (python) {
    try {
      python.terminate();
      logger.info('system', 'Python runtime terminated');
      
      // Wait a moment for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, PYTHON_CLEANUP_DELAY));
      
      // Re-initialize python since it was terminated
      python = new PythonRuntime(handlePythonOutput);
      await python.init();
      logger.info('system', 'Python runtime reinitialized successfully');
    } catch (err) {
      logger.error('system', 'Failed to reinitialize Python runtime', { error: err });
      // Don't leave python in a bad state
      python = null;
    }
  }
  setTaskRunning(false);
  addMessage("Task stopped by user.", "system");
};

// Subscribe to logs
let logsInitialized = false;
logger.subscribe((entry: LogEntry) => {
  if (!debugLogsEl) return;
  if (!logsInitialized) {
    debugLogsEl.textContent = '';
    logsInitialized = true;
  }

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

  debugLogsEl.appendChild(logDiv);
  
  // Limit DOM elements to prevent performance degradation (keep last 200)
  if (debugLogsEl.children.length > LOG_MAX_ENTRIES) {
    const toRemove = debugLogsEl.children.length - LOG_MAX_ENTRIES;
    for (let i = 0; i < toRemove; i++) {
      debugLogsEl.removeChild(debugLogsEl.children[0]);
    }
  }
  
  debugLogsEl.scrollTop = debugLogsEl.scrollHeight;

  // Show notification dot on error
  if (entry.level === 'error') {
    const activeTab = document.querySelector('.tab-btn.active') as HTMLButtonElement;
    if (activeTab && activeTab.dataset.tab !== 'logs') {
      logNotificationEl.style.display = 'block';
    }
  }
});

async function refreshVFSDisplay() {
    if (!storage) return;
    vfsContainer.textContent = 'Loading...';
    
    try {
        // Access db property using type assertion for private property
        const storageWithDb = storage as unknown as { db?: IDBDatabase };
        
        if (!storageWithDb.db) {
            vfsContainer.textContent = 'Storage not initialized. Please initialize Keel first.';
            return;
        }
        
        const isHealthy = await IndexedDBWrapper.checkDatabaseHealth(storageWithDb.db);
        if (!isHealthy) {
            vfsContainer.textContent = 'Storage database is not accessible. Please refresh the page.';
            logger.error('vfs', 'Database health check failed');
            return;
        }
        
        const files = await storage.listFiles();
        vfsContainer.textContent = '';
        
        if (files.length === 0) {
            vfsContainer.textContent = 'No files in keel://';
            return;
        }

        // Pagination settings
        const PAGE_SIZE = VFS_PAGE_SIZE;
        let currentPage = 1;
        const totalPages = Math.ceil(files.length / PAGE_SIZE);

        // Create pagination controls
        const paginationDiv = document.createElement('div');
        paginationDiv.className = 'vfs-pagination';
        paginationDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding: 0.5rem; border-bottom: 1px solid #333;';

        const pageInfo = document.createElement('span');
        pageInfo.style.cssText = 'color: #888; font-size: 0.9rem;';
        
        const controlsDiv = document.createElement('div');
        controlsDiv.style.cssText = 'display: flex; gap: 0.5rem;';

        const prevBtn = document.createElement('button');
        prevBtn.textContent = '← Previous';
        prevBtn.style.cssText = 'padding: 0.25rem 0.5rem; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer;';
        prevBtn.disabled = true;

        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next →';
        nextBtn.style.cssText = 'padding: 0.25rem 0.5rem; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer;';
        if (totalPages <= 1) nextBtn.disabled = true;

        controlsDiv.appendChild(prevBtn);
        controlsDiv.appendChild(nextBtn);
        paginationDiv.appendChild(pageInfo);
        paginationDiv.appendChild(controlsDiv);
        vfsContainer.appendChild(paginationDiv);

        // Create content container
        const contentDiv = document.createElement('div');
        contentDiv.className = 'vfs-content';
        vfsContainer.appendChild(contentDiv);

        // Function to display a specific page
        const displayPage = async (page: number) => {
            const startIndex = (page - 1) * PAGE_SIZE;
            const endIndex = startIndex + PAGE_SIZE;
            const pageFiles = files.slice(startIndex, endIndex);
            
            contentDiv.textContent = '';
            
            // Process files for this page in parallel
            const results = await IndexedDBWrapper.getMultipleFiles(storageWithDb.db!, pageFiles);
            
            // Display files in original order
            results.forEach(({ path, file }) => {
                if (file) {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'vfs-item';
                    itemDiv.style.cssText = 'margin-bottom: 1rem; padding: 0.5rem; border: 1px solid #333; border-radius: 4px;';
                    itemDiv.innerHTML = `
                        <div class="vfs-path" style="font-weight: bold; color: #007AFF;">${file.path}</div>
                        <div class="vfs-meta" style="color: #888; font-size: 0.8rem; margin-top: 0.25rem;">Type: ${file.mimeType} | Updated: ${new Date(file.updatedAt).toLocaleString()}</div>
                        <div class="vfs-content" style="margin-top: 0.5rem; color: #ccc; font-size: 0.9rem;">${file.content.substring(0, 500)}${file.content.length > 500 ? '...' : ''}</div>
                    `;
                    contentDiv.appendChild(itemDiv);
                } else {
                    // Show files that couldn't be loaded
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'vfs-item';
                    errorDiv.style.cssText = 'margin-bottom: 1rem; padding: 0.5rem; border: 1px solid #ff453a; border-radius: 4px;';
                    errorDiv.innerHTML = `
                        <div class="vfs-path" style="font-weight: bold; color: #ff453a;">${path}</div>
                        <div class="vfs-meta" style="color: #ff453a; font-size: 0.8rem; margin-top: 0.25rem;">Error: Could not load file details</div>
                    `;
                    contentDiv.appendChild(errorDiv);
                }
            });

            // Update pagination controls
            pageInfo.textContent = `Page ${page} of ${totalPages} (${files.length} files total)`;
            prevBtn.disabled = page === 1;
            nextBtn.disabled = page === totalPages;
            
            logger.info('vfs', `Displayed page ${page} of ${totalPages} (${results.filter(r => r.file).length}/${pageFiles.length} files loaded)`);
        };

        // Add event listeners for pagination
        prevBtn.onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                void displayPage(currentPage);
            }
        };

        nextBtn.onclick = () => {
            if (currentPage < totalPages) {
                currentPage++;
                void displayPage(currentPage);
            }
        };

        // Display first page
        await displayPage(1);
        
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error('vfs', 'Failed to refresh VFS display', { error: err });
        vfsContainer.textContent = `Error: ${errorMessage}`;
    }
}

refreshContextBtn.onclick = refreshVFSDisplay;

copyLogsBtn.onclick = async () => {
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

  // Fallback method for copying
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

  // Check if we're in an iframe
  const inIframe = window.parent !== window;

  try {
    // If in iframe or clipboard might be blocked, use fallback directly
    if (inIframe) {
      logger.info('main', 'Using fallback copy method due to iframe environment');
      const success = fallbackCopy();
      if (success) {
        const originalText = copyLogsBtn.textContent;
        copyLogsBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyLogsBtn.textContent = originalText;
        }, UI_BUTTON_RESET_DELAY);
      } else {
        throw new Error('Fallback copy method failed');
      }
    } else {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(logText);
        const originalText = copyLogsBtn.textContent;
        copyLogsBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyLogsBtn.textContent = originalText;
        }, UI_BUTTON_RESET_DELAY);
      } else {
        // Fallback for older browsers
        const success = fallbackCopy();
        if (success) {
          const originalText = copyLogsBtn.textContent;
          copyLogsBtn.textContent = 'Copied!';
          setTimeout(() => {
            copyLogsBtn.textContent = originalText;
          }, UI_BUTTON_RESET_DELAY);
        } else {
          throw new Error('Fallback copy method failed');
        }
      }
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('main', 'Failed to copy logs', { error: err, inIframe });
    
    // Show error and offer alternative
    const originalText = copyLogsBtn.textContent;
    copyLogsBtn.textContent = 'Copy Failed!';
    copyLogsBtn.style.backgroundColor = '#d32f2f';
    setTimeout(() => {
      copyLogsBtn.textContent = originalText;
      copyLogsBtn.style.backgroundColor = '';
    }, 3000);
    
    // Also log to console for manual copying
    console.error('Failed to copy logs to clipboard. Error:', errorMessage);
    console.log('--- LOGS START ---');
    console.log(logText);
    console.log('--- LOGS END ---');
    
    // Show user-friendly message
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #d32f2f;
      color: white;
      padding: 1rem;
      border-radius: 8px;
      max-width: 400px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    errorDiv.innerHTML = `
      <strong>Failed to copy logs!</strong><br>
      Check browser console (F12) for logs.<br>
      <small>Error: ${errorMessage}</small>
    `;
    document.body.appendChild(errorDiv);
    setTimeout(() => document.body.removeChild(errorDiv), 5000);
  }
};

// Update model select with cache status
async function updateModelSelectWithCacheStatus() {
  try {
    const cachedModels = await LocalLLMEngine.getAllCachedModels();
    const cachedModelIds = new Set(cachedModels.filter(m => !m.isCorrupted).map(m => m.modelId));
    
    // Update select options
    const options = SUPPORTED_MODELS.map(m => {
      const isCached = cachedModelIds.has(m.modelId);
      const cachedClass = isCached ? ' cached-model' : '';
      return `<option value="${m.modelId}" class="${cachedClass}">${m.displayName} (~${m.vramRequiredMB}MB)</option>`;
    });
    
    modelSelect.innerHTML = options.join('');
    
    // Restore selected value if it exists
    const savedModelId = localStorage.getItem('selectedModelId');
    if (savedModelId && SUPPORTED_MODELS.some(m => m.modelId === savedModelId)) {
      modelSelect.value = savedModelId;
    }
  } catch (error) {
    console.error('Failed to update model select with cache status:', error);
  }
}

async function initSettings() {
  const savedModelId = localStorage.getItem('selectedModelId');
  if (savedModelId && SUPPORTED_MODELS.some(m => m.modelId === savedModelId)) {
    modelSelect.value = savedModelId;
  } else {
    const recommendedModelId = await detectBestModel();
    modelSelect.value = recommendedModelId;
  }
  
  // Update model select with cache status
  await updateModelSelectWithCacheStatus();

  const savedApiKey = localStorage.getItem('geminiApiKey');
  if (savedApiKey) geminiApiKeyInput.value = savedApiKey;

  const savedOnlineMode = localStorage.getItem('onlineModeEnabled') === 'true';
  onlineModeToggle.checked = savedOnlineMode;
}

initSettings();

saveSettingsBtn.onclick = () => {
  const apiKey = geminiApiKeyInput.value.trim();
  const enabled = onlineModeToggle.checked;

  logger.info('main', 'Settings saved by user', { 
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey.length,
    onlineModeEnabled: enabled,
    engineExists: !!engine
  });

  localStorage.setItem('geminiApiKey', apiKey);
  localStorage.setItem('onlineModeEnabled', String(enabled));

  if (engine) {
    engine.setOnlineConfig(apiKey, enabled);
    logger.info('main', 'Engine online config updated', { enabled });
  }

  const originalText = saveSettingsBtn.textContent;
  saveSettingsBtn.textContent = 'Saved!';
  setTimeout(() => {
    saveSettingsBtn.textContent = originalText;
  }, UI_BUTTON_RESET_DELAY);
};

// Model cache management functions
async function updateModelsDisplay() {
  try {
    const models = await LocalLLMEngine.getAllCachedModels();
    const totalSize = models.reduce((sum, model) => sum + model.size, 0);
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(1);
    const corruptedCount = models.filter(m => m.isCorrupted).length;
    
    storageUsage.innerHTML = `
      <div class="storage-summary">
        <strong>Total Storage:</strong> ${totalSizeMB} MB
        <br><strong>Cached Models:</strong> ${models.length}
        ${corruptedCount > 0 ? `<br><span style="color: #ff6b6b;"><strong>⚠️ Corrupted:</strong> ${corruptedCount}</span>` : ''}
      </div>
    `;
    
    if (models.length === 0) {
      modelsList.innerHTML = '<div class="output-log">No cached models found.</div>';
    } else {
      modelsList.innerHTML = models.map(model => {
        const sizeMB = (model.size / 1024 / 1024).toFixed(1);
        let corruptedText = '';
        let usableText = '';
        let statusClass = '';
        
        if (model.isEmpty) {
          corruptedText = ' <span style="color: #ffa500;">(EMPTY CACHE)</span>';
          usableText = '<span style="color: #ffa500;">⚠️ Cache Empty</span>';
          statusClass = 'empty-cache';
        } else if (model.isCorrupted) {
          corruptedText = ' <span style="color: #ff6b6b;">(CORRUPTED)</span>';
          usableText = '<span style="color: #ff6b6b;">❌ Not usable</span>';
          statusClass = 'corrupted';
        } else {
          usableText = '<span style="color: #51cf66;">✅ Ready to use</span>';
          statusClass = 'ready';
        }
        
        return `
          <div class="model-item ${statusClass}">
            <div class="model-info">
              <strong>${model.modelId}</strong>${corruptedText}
              <span class="model-size">${sizeMB} MB</span>
            </div>
            <div class="model-status">
              ${usableText}
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (error) {
    console.error('Failed to update models display:', error);
    storageUsage.innerHTML = '<div class="output-log">Error loading model info.</div>';
    modelsList.innerHTML = '';
  }
}

refreshModelsBtn.onclick = async () => {
  refreshModelsBtn.textContent = 'Refreshing...';
  refreshModelsBtn.disabled = true;
  
  try {
    await updateModelsDisplay();
  } finally {
    refreshModelsBtn.textContent = 'Refresh List';
    refreshModelsBtn.disabled = false;
  }
};

// Add button to clear corrupted models
const clearCorruptedBtn = document.createElement('button');
clearCorruptedBtn.className = 'button';
clearCorruptedBtn.textContent = 'Clear Problematic';
clearCorruptedBtn.style.marginLeft = '10px';
clearCorruptedBtn.title = 'Clear corrupted and empty model caches';
clearCorruptedBtn.onclick = async () => {
  const models = await LocalLLMEngine.getAllCachedModels();
  const corruptedModels = models.filter(m => m.isCorrupted);
  const emptyModels = models.filter(m => m.isEmpty);
  
  if (corruptedModels.length === 0 && emptyModels.length === 0) {
    clearCorruptedBtn.textContent = 'None Found';
    setTimeout(() => {
      clearCorruptedBtn.textContent = 'Clear Problematic';
    }, 2000);
    return;
  }
  
  const totalToClear = corruptedModels.length + emptyModels.length;
  const message = `Clear ${totalToClear} problematic model(s)?\n` +
    `${corruptedModels.length > 0 ? `• ${corruptedModels.length} corrupted\n` : ''}` +
    `${emptyModels.length > 0 ? `• ${emptyModels.length} empty caches\n` : ''}` +
    `\nThis will remove the broken cache entries.`;
  
  if (!confirm(message)) {
    return;
  }
  
  clearCorruptedBtn.textContent = 'Clearing...';
  clearCorruptedBtn.disabled = true;
  
  try {
    // Clear each corrupted and empty model cache
    const allToClear = [...corruptedModels, ...emptyModels];
    for (const model of allToClear) {
      const cacheKey = `web-llm-${model.modelId}`;
      await caches.delete(cacheKey);
      logger.info('main', `Cleared problematic cache: ${model.modelId}`, {
        reason: model.isEmpty ? 'empty' : 'corrupted'
      });
    }
    
    await updateModelsDisplay();
    await updateModelSelectWithCacheStatus(); // Update model select after clearing
    
    clearCorruptedBtn.textContent = 'Cleared!';
    setTimeout(() => {
      clearCorruptedBtn.textContent = 'Clear Problematic';
    }, 2000);
  } catch (error) {
    console.error('Failed to clear corrupted models:', error);
    clearCorruptedBtn.textContent = 'Error';
    setTimeout(() => {
      clearCorruptedBtn.textContent = 'Clear Problematic';
    }, 2000);
  } finally {
    clearCorruptedBtn.disabled = false;
  }
};

// Insert the new button after refresh button
if (refreshModelsBtn.parentNode) {
  refreshModelsBtn.parentNode.insertBefore(clearCorruptedBtn, refreshModelsBtn.nextSibling);
}

clearAllModelsBtn.onclick = async () => {
  if (!confirm('Are you sure you want to clear all cached models? This will force re-downloading models next time you use them.')) {
    return;
  }
  
  clearAllModelsBtn.textContent = 'Clearing...';
  clearAllModelsBtn.disabled = true;
  
  try {
    await LocalLLMEngine.clearAllCachedModels();
    await updateModelsDisplay();
    await updateModelSelectWithCacheStatus(); // Update model select after clearing
    
    const originalText = clearAllModelsBtn.textContent;
    clearAllModelsBtn.textContent = 'Cleared!';
    setTimeout(() => {
      clearAllModelsBtn.textContent = originalText;
    }, 2000);
  } catch (error) {
    console.error('Failed to clear models:', error);
    clearAllModelsBtn.textContent = 'Error';
    setTimeout(() => {
      clearAllModelsBtn.textContent = 'Clear All Models';
    }, 2000);
  } finally {
    clearAllModelsBtn.disabled = false;
  }
};

function addMessage(text: string, role: 'user' | 'assistant' | 'system') {
  // Log all messages added to chat for complete debugging visibility
  logger.info('main', `Chat message added: ${role}`, { role, content: text });
  
  const div = document.createElement('div')
  div.className = `message ${role}-message`
  div.textContent = text
  messagesEl.appendChild(div)
  messagesEl.scrollTop = messagesEl.scrollHeight
}

function handlePythonOutput(output: PythonOutput, targetEl: HTMLElement = pythonOutputEl) {
  if (output.type === 'ready') {
    pythonStatusEl.textContent = 'Ready';
    targetEl.textContent = '';
    const readyDiv = document.createElement('div');
    readyDiv.className = 'output-log';
    readyDiv.textContent = 'Python runtime ready.';
    targetEl.appendChild(readyDiv);
    return;
  }

  if (output.type === 'log') {
    const logDiv = document.createElement('div');
    logDiv.className = 'output-log';
    logDiv.textContent = output.message || '';
    targetEl.appendChild(logDiv);
  } else if (output.type === 'error') {
    const errDiv = document.createElement('div');
    errDiv.className = 'output-error';
    errDiv.textContent = output.message || '';
    targetEl.appendChild(errDiv);
  } else if (output.type === 'download' && output.filename && output.content) {
    const link = document.createElement('a');
    link.className = 'download-link';
    const blob = new Blob([output.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = output.filename;
    link.textContent = `Download ${output.filename}`;
    
    // Revoke URL after download is triggered
    link.addEventListener('click', () => {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    
    targetEl.appendChild(link);
  }

  targetEl.scrollTop = targetEl.scrollHeight;
  if (targetEl === pythonOutputEl) {
    pythonOutputEl.scrollTop = pythonOutputEl.scrollHeight;
  } else {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

initBtn.onclick = async () => {
  console.log('🚀 Initialize button clicked');
  logger.info('main', 'Initialize button clicked by user', { 
    selectedModelId: modelSelect.value,
    onlineModeEnabled: onlineModeToggle.checked
  });
  
  console.log('📦 Selected model:', modelSelect.value);
  console.log('🌐 Online mode:', onlineModeToggle.checked);
  
  initBtn.disabled = true
  modelSelect.disabled = true
  statusEl.textContent = "Initializing..."
  pythonStatusEl.textContent = "Initializing..."
  
  console.log('🔧 UI updated - buttons disabled, status set');

  const selectedModelId = modelSelect.value;
  localStorage.setItem('selectedModelId', selectedModelId);

  try {
    console.log('📡 Starting initialization...');
    logger.info('system', `Initializing storage, python, and engine...`);
    
    // Start all major initializations
    console.log('💾 Initializing storage...');
    const storagePromise = storage.init();
    
    // Explicitly register and wait for service worker BEFORE engine initialization
    // Web-LLM's ServiceWorkerMLCEngine requires an active service worker to exist
    if ('serviceWorker' in navigator) {
      console.log('🔧 Checking service worker support...');
      try {
        // Use a more robust path resolution that accounts for Vite's base path
        const baseUrl = (import.meta as any).env.BASE_URL || '/';
        const swPath = `${baseUrl}sw.js`;
          
        console.log(`📡 Registering Service Worker from: ${swPath}`);
        logger.info('system', `Registering Service Worker from: ${swPath}`);
        
        const registration = await navigator.serviceWorker.register(swPath, { 
          type: 'module',
          scope: baseUrl 
        });
        console.log('✅ Service Worker registered:', registration.scope);
        logger.info('system', 'Service Worker registered successfully', { scope: registration.scope });
        
        // Wait for the service worker to be active
        let worker = registration.installing || registration.waiting || registration.active;
        
        console.log('🔄 Service Worker states:', {
          installing: !!registration.installing,
          waiting: !!registration.waiting,
          active: !!registration.active
        });
        logger.info('system', `Service Worker - installing: ${!!registration.installing}, waiting: ${!!registration.waiting}, active: ${!!registration.active}`);
        
        if (worker) {
          console.log('⚙️ Service Worker current state:', worker.state);
          logger.info('system', 'Service Worker state:', { state: worker.state });
          if (worker.state !== 'activated') {
            console.log('⏳ Waiting for Service Worker activation...');
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                console.error('❌ Service Worker activation timed out (30s)');
                logger.error('system', 'Service Worker activation timed out (30s)');
                reject(new Error('Service Worker activation timed out (30s)'));
              }, SW_ACTIVATION_TIMEOUT);

              const stateChangeHandler = (e: Event) => {
                const target = e.target as ServiceWorker;
                logger.info('system', `Service Worker state changed: ${target.state}`);
                if (target.state === 'activated') {
                  clearTimeout(timeout);
                  worker?.removeEventListener('statechange', stateChangeHandler);
                  resolve();
                } else if (target.state === 'redundant') {
                  clearTimeout(timeout);
                  worker?.removeEventListener('statechange', stateChangeHandler);
                  logger.error('system', 'Service Worker became redundant');
                  reject(new Error('Service Worker became redundant'));
                }
              };
              worker?.addEventListener('statechange', stateChangeHandler);
            });
          }
        } else {
          logger.error('system', 'No service worker found after registration');
        }
        
        // Ensure the service worker is controlling the page
        if (!navigator.serviceWorker.controller) {
          logger.info('system', 'Waiting for Service Worker controller claim...');
          let controllerClaimed = false;
          
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              if (!controllerClaimed) {
                logger.warn('system', 'Service Worker controller claim timed out after 5 seconds');
                // Don't reject - proceed without controller and let LocalLLMEngine handle fallback
                resolve();
              }
            }, SW_CONTROLLER_CLAIM_TIMEOUT);

            navigator.serviceWorker.addEventListener('controllerchange', () => {
              controllerClaimed = true;
              clearTimeout(timeout);
              logger.info('system', 'Service Worker controller claimed');
              resolve();
            }, { once: true });
          });

          // Verify controller status after the wait
          if (navigator.serviceWorker.controller) {
            logger.info('system', 'Service Worker is active and controlling the page');
          } else {
            logger.warn('system', 'Service Worker failed to claim controller - LocalLLMEngine will use WebWorker fallback');
          }
        } else {
          logger.info('system', 'Service Worker is active and controlling the page');
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('❌ Service Worker registration failed:', errorMsg);
        logger.warn('system', `Service Worker registration/activation failed: ${errorMsg}. Falling back to WebWorker for LLM.`, { error: err });
        // Don't throw, let LocalLLMEngine handle the fallback to WebWorker
      }
    } else {
      console.warn('⚠️ Service Workers not supported - using WebWorker fallback');
      logger.warn('system', 'Service Workers are not supported in this browser. Falling back to WebWorker for LLM.');
    }
    
    console.log('🐍 Initializing Python runtime...');
    python = new PythonRuntime(handlePythonOutput);
    const pythonPromise = python.init();
    console.log('🤖 Creating LocalLLMEngine...');
    const localEngine = new LocalLLMEngine(selectedModelId, (msg) => {
      console.log('📊 LLM Status:', msg);
      statusEl.textContent = msg
    });

    console.log('🔀 Creating HybridLLMEngine...');
    engine = new HybridLLMEngine(localEngine);

    // Apply current settings
    const apiKey = geminiApiKeyInput.value.trim();
    const onlineEnabled = onlineModeToggle.checked;
    console.log('🌐 Online LLM config:', { apiKey: apiKey ? 'set' : 'not set', onlineEnabled });
    engine.setOnlineConfig(apiKey, onlineEnabled);

    console.log('🚀 Starting LLM engine initialization...');
    const enginePromise = engine.init();

    // Wait for core systems to be ready
    try {
      console.log('⏳ Waiting for all systems to be ready...');
      await Promise.all([storagePromise, pythonPromise, enginePromise]);
    } catch (err: unknown) {
      // If any of the core systems fail to initialize, clean up and re-throw
      if (python) {
        python.terminate();
        python = null;
      }
      if (engine) {
        void engine.unload();
        engine = null;
      }
      throw err;
    }
    
    console.log('✅ Core systems ready, initializing skills...');
    logger.info('system', 'Core systems ready, initializing skills...');

    // Initialize skills engine
    console.log('🧠 Initializing skills engine...');
    await skillsEngine.init();
    console.log('📚 Registering built-in skills...');
    await skillsEngine.registerBuiltInSkills();
    console.log(`🎯 Skills loaded: ${skillsEngine.count()} skills available`);
    logger.info('system', 'Skills engine initialized');
    
    // Load skills display
    console.log('🔄 Refreshing skills display...');
    void refreshSkillsDisplay();
    void updateStorageUsage();

    console.log('🎉 Initialization successful!');
    logger.info('system', 'Initialization successful');
    statusEl.textContent = "Keel Ready"
    userInput.disabled = false
    sendBtn.disabled = false
    setupControls.style.display = 'none'
    // Agent controls are now integrated into the main UI
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('❌ Initialization failed:', errorMessage);
    console.error('🔍 Full error:', err);
    logger.error('system', `Initialization failed: ${errorMessage}`, { error: err });
    statusEl.textContent = `Error: ${errorMessage}`
    initBtn.disabled = false
    modelSelect.disabled = false
  }
}

export async function handleSend(overrideText?: string, retryCount = 0) {
  const text = overrideText || userInput.value.trim()
  if (!text || !engine || !python) return

  // Prevent deep recursion
  if (retryCount > 2) {
    addMessage("I'm stuck and couldn't fix the Python error after multiple attempts.", 'assistant');
    userInput.disabled = false;
    sendBtn.disabled = false;
    return;
  }

  const taskId = ++currentTaskId;
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

  // Log user input processing for debugging
  logger.info('main', 'Processing user input', { 
    taskId, 
    inputLength: text.length, 
    isOverride: !!overrideText,
    // Always using skill-based orchestration 
  });

  userInput.disabled = true;
  sendBtn.disabled = true;

  if (overrideText) {
    logger.info('main', 'Adding override text to chat history', { content: text });
    chatHistory.push({ role: 'user', content: text });
  } else {
    userInput.value = ''
    addMessage(text, 'user')
    chatHistory.push({ role: 'user', content: text });
  }

  setTaskRunning(true);

  // Always use skill-based orchestration
  logger.info('main', 'Starting skill-based task execution', { taskId });
  const orchestrator = new AgentOrchestrator(engine, python);
  const agentDivs: Record<string, HTMLDivElement> = {};

  try {
    await orchestrator.runTask(text, (update: AgentResponse) => {
        if (taskId !== currentTaskId || signal.aborted) return;
        
        // Log all agent updates to main category for complete debugging visibility
        logger.info('main', `Agent update: ${update.personaId}`, { 
          personaId: update.personaId, 
          type: update.type, 
          content: update.content 
        });
        
        if (!agentDivs[update.personaId]) {
          const div = document.createElement('div');
          div.className = `message assistant-message agent-${update.personaId}`;
          const label = document.createElement('div');
          label.className = 'agent-label';
          label.textContent = update.personaId.toUpperCase();
          div.appendChild(label);
          const content = document.createElement('div');
          content.className = 'agent-content';
          div.appendChild(content);
          messagesEl.appendChild(div);
          agentDivs[update.personaId] = div;
        }
        const contentDiv = agentDivs[update.personaId].querySelector('.agent-content')!;

        if (update.type === 'error') {
          logger.error('main', `Agent error: ${update.personaId}`, { 
            personaId: update.personaId, 
            content: update.content 
          });
          const errDiv = document.createElement('div');
          errDiv.className = 'output-error';
          errDiv.textContent = update.content;
          contentDiv.appendChild(errDiv);
        } else if (update.type === 'observation') {
            logger.debug('main', `Agent observation: ${update.personaId}`, { 
              personaId: update.personaId, 
              content: update.content 
            });
            const obsDiv = document.createElement('div');
            obsDiv.className = 'output-log';
            obsDiv.style.borderLeft = '2px solid #ff2d55';
            obsDiv.style.paddingLeft = '5px';
            obsDiv.style.fontSize = '0.75rem';
            obsDiv.textContent = update.content;
            contentDiv.appendChild(obsDiv);
        } else {
          logger.info('main', `Agent response: ${update.personaId}`, { 
            personaId: update.personaId, 
            content: update.content 
          });
          contentDiv.textContent = update.content;
        }

        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
  } catch (err: unknown) {
    if (taskId !== currentTaskId) return;
    if (signal.aborted) {
      logger.info('main', 'Task execution aborted');
      return;
    }
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('main', 'Orchestrator task execution failed', { 
      taskId, 
      error: errorMessage, 
      errorType: err instanceof Error ? err.constructor.name : 'Unknown'
    });
    addMessage(`Orchestrator Error: ${errorMessage}`, 'assistant');
  } finally {
    if (taskId === currentTaskId) {
      logger.info('main', 'Skill-based task completed', { taskId });
      setTaskRunning(false);
    }
  }
}

  

sendBtn.onclick = () => handleSend()
userInput.onkeypress = (e) => {
  if (e.key === 'Enter') handleSend()
}

// Skills functionality
async function refreshSkillsDisplay() {
  const skills = skillsEngine.getAvailableSkillsMetadata()
  
  if (skills.length === 0) {
    skillsList.innerHTML = '<div class="output-log">No skills installed. Click "Install Skill" to add skills from GitHub.</div>'
    return
  }
  
  skillsList.innerHTML = ''
  
  for (const skill of skills) {
    const skillDiv = document.createElement('div')
    skillDiv.className = 'skill-item'
    skillDiv.innerHTML = `
      <div class="skill-header">
        <h4>${skill.name}</h4>
        <button class="skill-uninstall-btn" data-skill="${skill.name}">Uninstall</button>
      </div>
      <p>${skill.description}</p>
      ${skill.tags ? `<div class="skill-tags">${skill.tags.map((tag: string) => `<span class="skill-tag">${tag}</span>`).join('')}</div>` : ''}
    `
    
    skillDiv.addEventListener('click', async (e) => {
      if (!(e.target as HTMLElement).classList.contains('skill-uninstall-btn')) {
        const fullSkill = await skillsEngine.getFullSkill(skill.name)
        if (fullSkill) {
          showSkillDetails(fullSkill)
        } else {
          alert(`Failed to load details for skill: ${skill.name}`)
        }
      }
    })
    
    skillsList.appendChild(skillDiv)
  }
  
  // Add uninstall handlers
  document.querySelectorAll('.skill-uninstall-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const skillName = (btn as HTMLButtonElement).dataset.skill!
      if (confirm(`Uninstall skill "${skillName}"?`)) {
        await skillsEngine.uninstallSkill(skillName)
        refreshSkillsDisplay()
      }
    })
  })
}

function showSkillDetails(skill: ParsedSkill) {
  skillName.textContent = skill.name
  skillDescription.textContent = skill.description
  
  // Build content safely using DOM methods instead of innerHTML
  const container = document.createElement('div')
  
  // Instructions section
  const instructionsDiv = document.createElement('div')
  instructionsDiv.className = 'skill-instructions'
  const instructionsHeader = document.createElement('h5')
  instructionsHeader.textContent = 'Instructions:'
  instructionsDiv.appendChild(instructionsHeader)
  const instructionsPre = document.createElement('pre')
  instructionsPre.textContent = skill.instructions
  instructionsDiv.appendChild(instructionsPre)
  container.appendChild(instructionsDiv)
  
  // Code blocks section
  if (skill.codeBlocks.length > 0) {
    const codeDiv = document.createElement('div')
    codeDiv.className = 'skill-code'
    const codeHeader = document.createElement('h5')
    codeHeader.textContent = 'Code:'
    codeDiv.appendChild(codeHeader)
    
    for (const block of skill.codeBlocks) {
      const blockDiv = document.createElement('div')
      blockDiv.className = 'code-block'
      
      const langSpan = document.createElement('span')
      langSpan.className = 'code-language'
      langSpan.textContent = block.language
      blockDiv.appendChild(langSpan)
      
      const codePre = document.createElement('pre')
      const codeEl = document.createElement('code')
      codeEl.textContent = block.code
      codePre.appendChild(codeEl)
      blockDiv.appendChild(codePre)
      
      codeDiv.appendChild(blockDiv)
    }
    
    container.appendChild(codeDiv)
  }
  
  skillContent.innerHTML = ''
  skillContent.appendChild(container)
  skillDetails.style.display = 'block'
}

// Install skill handler
installSkillBtn.onclick = async () => {
  const input = prompt('Enter GitHub repository (owner/repo or full URL):')
  if (!input) return
  
  const repo = SkillsDownloader.parseRepoUrl(input)
  if (!repo) {
    alert('Invalid repository format. Use "owner/repo" or full GitHub URL.')
    return
  }
  
  try {
    installSkillBtn.disabled = true
    installSkillBtn.textContent = 'Listing...'
    
    const availableSkills = await SkillsDownloader.listSkills(repo)
    
    if (availableSkills.length === 0) {
      alert('No skills found in this repository. Ensure it has a "skills" directory with SKILL.md files.')
      return
    }
    
    // Simple prompt-based selection for now
    const skillNamesStr = prompt(
      `Found ${availableSkills.length} skills in ${repo.owner}/${repo.repo}:\n` +
      availableSkills.map(s => `- ${s.name}`).join('\n') +
      `\n\nEnter skill names to install (comma-separated, or leave empty for all):`
    )
    
    const selectedNames = skillNamesStr 
      ? skillNamesStr.split(',').map(s => s.trim()).filter(Boolean)
      : undefined

    installSkillBtn.textContent = 'Installing...'
    
    const skills = await SkillsDownloader.downloadSkills(repo, (progress) => {
      logger.info('skills', `Download progress for ${progress.skillName}`, { 
        status: progress.status, 
        progress: progress.progress 
      });
    }, selectedNames)
    
    // Save skills to storage
    for (const skill of skills) {
      await skillStorage.saveSkill(skill)
      await skillsEngine.installSkill(skill.name)
    }
    
    refreshSkillsDisplay()
    alert(`Successfully installed ${skills.length} skill(s)`)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    alert(`Failed to install skills: ${errorMessage}`)
  } finally {
    installSkillBtn.disabled = false
    installSkillBtn.textContent = 'Install Skill'
  }
}

// Refresh skills handler
refreshSkillsBtn.onclick = () => {
  refreshSkillsDisplay()
}

// Search skills handler
skillSearchInput.oninput = () => {
  const query = skillSearchInput.value.toLowerCase()
  const skillItems = document.querySelectorAll('.skill-item')
  
  skillItems.forEach(item => {
    const text = item.textContent!.toLowerCase()
    ;(item as HTMLElement).style.display = text.includes(query) ? 'block' : 'none'
  })
}

// Storage usage display
async function updateStorageUsage() {
  const usage = await modelStorage.getStorageUsage()
  const usedMB = (usage.used / 1024 / 1024).toFixed(2)
  const availableMB = (usage.available / 1024 / 1024).toFixed(2)
  
  storageUsage.innerHTML = `
    <p>Used: ${usedMB} MB / ${availableMB} MB</p>
    <div class="storage-bar">
      <div class="storage-used" style="width: ${(usage.used / usage.available) * 100}%"></div>
    </div>
  `
  
  // Update models display with cache info
  await updateModelsDisplay();
  
  // List models (legacy model storage)
  const models = await modelStorage.getAllModels()
  modelsList.innerHTML = ''
  
  for (const model of models) {
    const modelDiv = document.createElement('div')
    modelDiv.className = 'model-item'
    modelDiv.innerHTML = `
      <div class="model-info">
        <span class="model-name">${model.modelId}</span>
        <span class="model-size">${(model.size / 1024 / 1024).toFixed(2)} MB</span>
        <span class="model-status status-${model.status}">${model.status}</span>
      </div>
      ${model.status === 'ready' ? `<button class="model-delete-btn" data-model="${model.modelId}">Delete</button>` : ''}
    `
    modelsList.appendChild(modelDiv)
  }
  
  // Add delete handlers
  document.querySelectorAll('.model-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const modelId = (e.target as HTMLButtonElement).dataset.model!
      if (confirm(`Delete model "${modelId}"?`)) {
        await modelStorage.deleteModel(modelId)
        updateStorageUsage()
      }
    })
  })
}

// Settings subtabs
document.querySelectorAll('.subtab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const subtab = (btn as HTMLButtonElement).dataset.subtab!
    
    // Update buttons
    document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    
    // Update content
    document.querySelectorAll('.subtab-content').forEach(c => {
      (c as HTMLElement).style.display = 'none'
    })
    const activeContent = document.getElementById(`${subtab}Subtab`) as HTMLElement
    if (activeContent) {
      activeContent.style.display = 'block'
    }
    
    // Update storage usage when models tab is shown
    if (subtab === 'models') {
      void updateModelsDisplay();
      void updateModelSelectWithCacheStatus();
    }
  })
})
