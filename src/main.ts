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
      <div id="agentControls" style="display: none; flex-direction: column; gap: 0.5rem; align-items: center; background: #222; padding: 0.8rem 1.2rem; border-radius: 20px; max-width: 90%;">
        <div style="display: flex; gap: 1rem; align-items: center;">
          <label style="font-size: 0.8rem; color: #888;">Mode:</label>
          <label class="switch-label"><input type="checkbox" id="multiAgentToggle" checked> Multi-Agent Agency</label>
        </div>
        <div id="personaSelection" style="display: flex; gap: 0.8rem; flex-wrap: wrap; justify-content: center; margin-top: 0.5rem; border-top: 1px solid #333; padding-top: 0.5rem;">
          <label class="switch-label" title="Information Specialist"><input type="checkbox" class="persona-checkbox" value="researcher" checked> Researcher</label>
          <label class="switch-label" title="Quality Controller"><input type="checkbox" class="persona-checkbox" value="reviewer" checked> Reviewer</label>
          <label class="switch-label" title="System Monitor"><input type="checkbox" class="persona-checkbox" value="observer" checked> Observer</label>
        </div>
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
const statsEl = document.getElementById('stats')!
const debugLogsEl = document.getElementById('logsContainer')!
const vfsContainer = document.getElementById('vfsContainer')!
const refreshContextBtn = document.getElementById('refreshContextBtn')! as HTMLButtonElement
const copyLogsBtn = document.getElementById('copyLogsBtn')! as HTMLButtonElement
const logNotificationEl = document.getElementById('logNotification')!
const setupControls = document.getElementById('setupControls')!
const agentControls = document.getElementById('agentControls')!
const multiAgentToggle = document.getElementById('multiAgentToggle')! as HTMLInputElement
const personaSelection = document.getElementById('personaSelection')!

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

multiAgentToggle.onchange = () => {
    personaSelection.style.display = multiAgentToggle.checked ? 'flex' : 'none';
};

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

function setTaskRunning(running: boolean) {
  isTaskRunning = running;
  stopBtn.style.display = running ? 'block' : 'none';
  sendBtn.style.display = running ? 'none' : 'block';
  userInput.disabled = running;
  
  if (isTaskRunning) {
    logger.info('system', 'Task execution started');
  }
}

stopBtn.onclick = () => {
  if (python) {
    python.terminate();
    // Re-initialize python since it was terminated
    python = new PythonRuntime(handlePythonOutput);
    void python.init();
  }
  setTaskRunning(false);
  addMessage("Task stopped by user.", "system" as any);
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
  if (debugLogsEl.children.length > 200) {
    const toRemove = debugLogsEl.children.length - 200;
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

        // Process files in parallel with proper ordering and error handling
        const results = await IndexedDBWrapper.getMultipleFiles(storageWithDb.db, files);
        
        // Display files in original order
        results.forEach(({ path, file }) => {
            if (file) {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'vfs-item';
                itemDiv.innerHTML = `
                    <div class="vfs-path">${file.path}</div>
                    <div class="vfs-meta">Type: ${file.mimeType} | Updated: ${new Date(file.updatedAt).toLocaleString()}</div>
                    <div class="vfs-content">${file.content.substring(0, 500)}${file.content.length > 500 ? '...' : ''}</div>
                `;
                vfsContainer.appendChild(itemDiv);
            } else {
                // Show files that couldn't be loaded
                const errorDiv = document.createElement('div');
                errorDiv.className = 'vfs-item';
                errorDiv.innerHTML = `
                    <div class="vfs-path" style="color: #ff453a;">${path}</div>
                    <div class="vfs-meta" style="color: #ff453a;">Error: Could not load file details</div>
                `;
                vfsContainer.appendChild(errorDiv);
            }
        });
        
        logger.info('vfs', `Successfully displayed ${results.filter(r => r.file).length}/${files.length} files`);
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

  try {
    await navigator.clipboard.writeText(logText);
    const originalText = copyLogsBtn.textContent;
    copyLogsBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyLogsBtn.textContent = originalText;
    }, 2000);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('Failed to copy logs: ', err);
    alert(`Failed to copy logs to clipboard: ${errorMessage}`);
  }
};

async function initSettings() {
  const savedModelId = localStorage.getItem('selectedModelId');
  if (savedModelId && SUPPORTED_MODELS.some(m => m.modelId === savedModelId)) {
    modelSelect.value = savedModelId;
  } else {
    const recommendedModelId = await detectBestModel();
    modelSelect.value = recommendedModelId;
  }

  const savedApiKey = localStorage.getItem('geminiApiKey');
  if (savedApiKey) geminiApiKeyInput.value = savedApiKey;

  const savedOnlineMode = localStorage.getItem('onlineModeEnabled') === 'true';
  onlineModeToggle.checked = savedOnlineMode;
}

initSettings();

saveSettingsBtn.onclick = () => {
  const apiKey = geminiApiKeyInput.value.trim();
  const enabled = onlineModeToggle.checked;

  localStorage.setItem('geminiApiKey', apiKey);
  localStorage.setItem('onlineModeEnabled', String(enabled));

  if (engine) {
    engine.setOnlineConfig(apiKey, enabled);
  }

  const originalText = saveSettingsBtn.textContent;
  saveSettingsBtn.textContent = 'Saved!';
  setTimeout(() => {
    saveSettingsBtn.textContent = originalText;
  }, 2000);
};

function addMessage(text: string, role: 'user' | 'assistant') {
  const div = document.createElement('div')
  div.className = `message ${role}-message`
  div.textContent = text
  messagesEl.appendChild(div)
  messagesEl.scrollTop = messagesEl.scrollHeight
  return div
}

function clearPythonOutput() {
  pythonOutputEl.textContent = '';
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
  initBtn.disabled = true
  modelSelect.disabled = true
  statusEl.textContent = "Initializing..."
  pythonStatusEl.textContent = "Initializing..."

  const selectedModelId = modelSelect.value;
  localStorage.setItem('selectedModelId', selectedModelId);

  try {
    logger.info('system', `Initializing storage, python, and engine...`);
    
    // Start all major initializations in parallel
    const storagePromise = storage.init();
    
    python = new PythonRuntime(handlePythonOutput);
    const pythonPromise = python.init();

    const localEngine = new LocalLLMEngine(selectedModelId, (msg) => {
      statusEl.textContent = msg
    });

    engine = new HybridLLMEngine(localEngine, () => {
      onlineModeToggle.checked = false;
      localStorage.setItem('onlineModeEnabled', 'false');
      addMessage("Online LLM failed. Falling back to local mode.", "assistant");
    });

    // Apply current settings
    const apiKey = geminiApiKeyInput.value.trim();
    const onlineEnabled = onlineModeToggle.checked;
    engine.setOnlineConfig(apiKey, onlineEnabled);

    const enginePromise = engine.init();

    // Wait for core systems to be ready
    await Promise.all([storagePromise, pythonPromise, enginePromise]);
    
    logger.info('system', 'Core systems ready, initializing skills...');
    await SkillsDownloader.setLLMEngine(engine);

    // Initialize skills engine
    await skillsEngine.init();
    skillsEngine.registerBuiltInSkills();
    logger.info('system', 'Skills engine initialized');
    
    // Load skills display
    void refreshSkillsDisplay();
    void updateStorageUsage();

    logger.info('system', 'Initialization successful');
    statusEl.textContent = "Keel Ready"
    userInput.disabled = false
    sendBtn.disabled = false
    setupControls.style.display = 'none'
    agentControls.style.display = 'flex'
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
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

  userInput.disabled = true;
  sendBtn.disabled = true;

  if (overrideText) {
    chatHistory.push({ role: 'user', content: text });
  } else {
    userInput.value = ''
    addMessage(text, 'user')
    chatHistory.push({ role: 'user', content: text });
  }

  setTaskRunning(true);

  if (multiAgentToggle.checked) {
    const orchestrator = new AgentOrchestrator(engine, python);
    const agentDivs: Record<string, HTMLDivElement> = {};

    try {
      await orchestrator.runTask(text, (update: AgentResponse) => {
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

        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      addMessage(`Orchestrator Error: ${errorMessage}`, 'assistant');
    } finally {
      setTaskRunning(false);
    }
    return;
  }

  const assistantDiv = addMessage('...', 'assistant')
  const artifactContainer = document.createElement('div');
  artifactContainer.className = 'artifact-container';
  assistantDiv.after(artifactContainer);

  try {
    let fullText = "";
    
    // Add skills context to system prompt
    const skillsContext = skillsEngine.getSkillsDescription();
    const systemPrompt = `You are Keel, a local-first AI agent with access to Python execution and skills.\n\nAvailable Skills:\n${skillsContext}\n\nWhen you need to use a skill, format it as: <skill name="skillName">{"param": "value"}</skill>\n\nWhen you need to perform calculations or data analysis, write Python code in triple-backtick blocks.`;
    
    await engine.generate(text, {
      onToken: (updatedText) => {
        fullText = updatedText;
        assistantDiv.textContent = fullText
        messagesEl.scrollTop = messagesEl.scrollHeight
      },
      history: chatHistory.slice(0, -1),
      systemOverride: systemPrompt
    });

    chatHistory.push({ role: 'assistant', content: fullText });
    
    // Parse and execute skill calls
    const skillCalls = skillsEngine.parseSkillCalls(fullText);
    if (skillCalls.length > 0 && python) {
      clearPythonOutput();
      
      const dualPythonHandler = (output: PythonOutput) => {
        handlePythonOutput(output, artifactContainer); // Chat
        handlePythonOutput(output, pythonOutputEl);    // Python Tab
      };
      
      // Push the dual handler onto the stack
      python.onOutput = dualPythonHandler;
      
      try {
        for (const skillCall of skillCalls) {
          try {
            pythonStatusEl.textContent = 'Running skill...';
            const result = await skillsEngine.executeSkill(
              skillCall.name, 
              skillCall.params, 
              { pythonRuntime: python }
            );
            
            if (result.success) {
              const resultDiv = document.createElement('div');
              resultDiv.className = 'output-log';
              resultDiv.textContent = `Skill ${skillCall.name} result: ${result.output || 'Success'}`;
              artifactContainer.appendChild(resultDiv);
            } else {
              const errorDiv = document.createElement('div');
              errorDiv.className = 'output-error';
              errorDiv.textContent = `Skill ${skillCall.name} error: ${result.error}`;
              artifactContainer.appendChild(errorDiv);
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'output-error';
            errorDiv.textContent = `Skill execution error: ${errorMessage}`;
            artifactContainer.appendChild(errorDiv);
          }
        }
      } finally {
        // Restore the previous handler
        python.restoreHandler();
        pythonStatusEl.textContent = 'Ready';
      }
    }

    // Extract python code blocks
    const pythonRegex = /```python\n([\s\S]*?)```/g;
    let match;
    const codeBlocks: string[] = [];
    while ((match = pythonRegex.exec(fullText)) !== null) {
      codeBlocks.push(match[1]);
    }

    if (codeBlocks.length > 0) {
      clearPythonOutput();
      
      const dualPythonHandler = (output: PythonOutput) => {
        handlePythonOutput(output, artifactContainer); // Chat
        handlePythonOutput(output, pythonOutputEl);    // Python Tab
      };

      // Push the dual handler onto the stack
      python.onOutput = dualPythonHandler;

      try {
        for (const code of codeBlocks) {
          pythonStatusEl.textContent = 'Running...';
          try {
            await python.execute(code);
            pythonStatusEl.textContent = 'Ready';
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            pythonStatusEl.textContent = 'Error';
            // Errors are already handled via handlePythonOutput (inline)

            // Automatic error recovery with proper async error handling
            const logs = logger.getLogs().slice(-10); // Last 10 logs for context
            const logContext = logs.map(l => `[${l.category}] ${l.message}`).join('\n');
            const recoveryPrompt = `The previous Python code failed with the following error:
\`\`\`
${errorMessage}
\`\`\`

Recent system logs:
\`\`\`
${sanitizeHTML(logContext)}
\`\`\`

Please analyze the error and provide a corrected version of the code.`;

            addMessage(recoveryPrompt, 'user');
            
            // Restore handler before attempting recovery
            python.restoreHandler();
            
            // Use queueMicrotask for safer async scheduling with error boundaries
            queueMicrotask(async () => {
              try {
                await handleSend(recoveryPrompt, retryCount + 1);
              } catch (recoveryError: unknown) {
                const recoveryErrorMessage = recoveryError instanceof Error ? recoveryError.message : String(recoveryError);
                logger.error('main', 'Error recovery failed', { error: recoveryError });
                addMessage(`Recovery failed: ${recoveryErrorMessage}`, 'assistant');
                // Ensure controls are re-enabled on recovery failure
                userInput.disabled = false;
                sendBtn.disabled = false;
                userInput.focus();
              }
            });
            
            return; // Exit current handleSend, recovery will handle the rest
          }
        }
      } finally {
        // Restore the previous handler if not already restored during error recovery
        if (python.handlerCount > 0) {
          python.restoreHandler();
        }
      }
    }

    const stats = await engine.getStats()
    if (stats) statsEl.textContent = stats
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    assistantDiv.textContent = `Error: ${errorMessage}`
  } finally {
    if (retryCount === 0) {
      setTaskRunning(false);
      userInput.focus();
    }
  }
}

function sanitizeHTML(content: string): string {
  // Use HTML entity encoding to prevent XSS - escape all HTML special characters
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

sendBtn.onclick = () => handleSend()
userInput.onkeypress = (e) => {
  if (e.key === 'Enter') handleSend()
}

// Skills functionality
async function refreshSkillsDisplay() {
  const skills = skillsEngine.getAvailableSkills()
  
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
    
    skillDiv.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).classList.contains('skill-uninstall-btn')) {
        showSkillDetails(skill)
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
    installSkillBtn.textContent = 'Installing...'
    
    const skills = await SkillsDownloader.downloadSkills(repo, (progress) => {
      console.log(`Skill ${progress.skillName}: ${progress.status} - ${progress.progress}%`)
    })
    
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
  
  // List models
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
      updateStorageUsage()
    }
  })
})
