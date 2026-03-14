import './style.css'
import { LLMEngine, SUPPORTED_MODELS, detectBestModel } from './llm'
import { PythonRuntime, type PythonOutput } from './python-runtime'
import { logger, type LogEntry } from './logger'
import embed from 'vega-embed'

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <div>
    <h1>Keel 🛰️</h1>
    <div class="status-bar" id="status">Ready</div>

    <div class="main-layout">
      <div class="output-panel">
        <div class="output-tabs">
          <button class="tab-btn active" data-tab="chat">Chat</button>
          <button class="tab-btn" data-tab="python">Python <span id="pythonStatus">(Idle)</span></button>
          <button class="tab-btn" data-tab="logs">Logs <span id="logNotification" class="notification-dot" style="display: none;"></span></button>
        </div>

        <div class="output-content active" id="chatTab" data-tab-content="chat">
          <div class="chat-container">
            <div class="messages" id="messages">
              <div class="message assistant-message">Hello! I am Keel, your local iPad agent. Select a model and press "Initialize" to start.</div>
            </div>
            <div class="input-area">
              <input type="text" id="userInput" placeholder="Type a message..." disabled />
              <button id="sendBtn" disabled>Send</button>
            </div>
          </div>
        </div>

        <div class="output-content" id="pythonOutput" data-tab-content="python" style="display: none;">
          <div class="output-log">Python runtime not initialized.</div>
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
      <div id="modelSelectContainer">
        <label for="modelSelect">Model:</label>
        <select id="modelSelect">
          ${SUPPORTED_MODELS.map(m => `<option value="${m.modelId}">${m.displayName} (~${m.vramRequiredMB}MB)</option>`).join('')}
        </select>
      </div>
      <button id="initBtn">Initialize Local LLM & Python</button>
    </div>
  </div>
`

const statusEl = document.getElementById('status')!
const pythonStatusEl = document.getElementById('pythonStatus')!
const pythonOutputEl = document.getElementById('pythonOutput')!
const modelSelect = document.getElementById('modelSelect')! as HTMLSelectElement
const modelSelectContainer = document.getElementById('modelSelectContainer')!
const messagesEl = document.getElementById('messages')!
const userInput = document.getElementById('userInput')! as HTMLInputElement
const sendBtn = document.getElementById('sendBtn')! as HTMLButtonElement
const initBtn = document.getElementById('initBtn')! as HTMLButtonElement
const statsEl = document.getElementById('stats')!
const debugLogsEl = document.getElementById('logsContainer')!
const copyLogsBtn = document.getElementById('copyLogsBtn')! as HTMLButtonElement
const logNotificationEl = document.getElementById('logNotification')!

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

    // Hide notification dot if logs tab is clicked
    if (tab === 'logs') {
      logNotificationEl.style.display = 'none';
    }
  });
});

let engine: LLMEngine | null = null
let python: PythonRuntime | null = null
let chatHistory: any[] = []

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
  debugLogsEl.scrollTop = debugLogsEl.scrollHeight;

  // Show notification dot on error
  if (entry.level === 'error') {
    const activeTab = document.querySelector('.tab-btn.active') as HTMLButtonElement;
    if (activeTab && activeTab.dataset.tab !== 'logs') {
      logNotificationEl.style.display = 'block';
    }
  }
});

copyLogsBtn.onclick = () => {
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

  navigator.clipboard.writeText(logText).then(() => {
    const originalText = copyLogsBtn.textContent;
    copyLogsBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyLogsBtn.textContent = originalText;
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy logs: ', err);
    alert('Failed to copy logs to clipboard');
  });
};

async function initModelSelection() {
  const savedModelId = localStorage.getItem('selectedModelId');
  if (savedModelId && SUPPORTED_MODELS.some(m => m.modelId === savedModelId)) {
    modelSelect.value = savedModelId;
  } else {
    const recommendedModelId = await detectBestModel();
    modelSelect.value = recommendedModelId;
  }
}

initModelSelection();

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
  } else if (output.type === 'table' && output.data) {
    const container = document.createElement('div');
    container.className = 'data-table-container';
    const table = document.createElement('table');

    if (output.data.length > 0) {
      const keys = Object.keys(output.data[0]);
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      keys.forEach(key => {
        const th = document.createElement('th');
        th.textContent = key;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      output.data.forEach(row => {
        const tr = document.createElement('tr');
        keys.forEach(key => {
          const td = document.createElement('td');
          td.textContent = String(row[key]);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
    }
    container.appendChild(table);
    targetEl.appendChild(container);
  } else if (output.type === 'chart' && output.spec) {
    const chartDiv = document.createElement('div');
    chartDiv.className = 'chart-container';
    targetEl.appendChild(chartDiv);
    embed(chartDiv, output.spec, { actions: false });
  } else if (output.type === 'download' && output.filename && output.content) {
    const link = document.createElement('a');
    link.className = 'download-link';
    const blob = new Blob([output.content], { type: 'text/plain' });
    link.href = URL.createObjectURL(blob);
    link.download = output.filename;
    link.textContent = `Download ${output.filename}`;
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
  statusEl.textContent = "Initializing LLM..."
  pythonStatusEl.textContent = "Initializing..."

  const selectedModelId = modelSelect.value;
  localStorage.setItem('selectedModelId', selectedModelId);

  try {
    logger.info('system', `Initializing with model: ${selectedModelId}`);
    // Init Python first or in parallel
    python = new PythonRuntime(handlePythonOutput);
    const pythonPromise = python.init();

    engine = new LLMEngine(selectedModelId, (msg) => {
      statusEl.textContent = msg
    })
    const enginePromise = engine.init();

    await Promise.all([pythonPromise, enginePromise]);

    logger.info('system', 'Initialization successful');
    statusEl.textContent = "Keel Ready (WebGPU + Python)"
    userInput.disabled = false
    sendBtn.disabled = false
    initBtn.style.display = 'none'
    modelSelectContainer.style.display = 'none'
  } catch (err: any) {
    logger.error('system', `Initialization failed: ${err.message}`, { error: err });
    statusEl.textContent = `Error: ${err.message}`
    initBtn.disabled = false
    modelSelect.disabled = false
  }
}

async function handleSend(overrideText?: string, retryCount = 0) {
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
    // In override/recovery mode, the message is already added to UI by the caller
  } else {
    userInput.value = ''
    addMessage(text, 'user')
    chatHistory.push({ role: 'user', content: text });
  }

  const assistantDiv = addMessage('...', 'assistant')
  const artifactContainer = document.createElement('div');
  artifactContainer.className = 'artifact-container';
  assistantDiv.after(artifactContainer);

  try {
    let fullText = "";
    await engine.generate(text, (updatedText) => {
      fullText = updatedText;
      assistantDiv.textContent = fullText
      messagesEl.scrollTop = messagesEl.scrollHeight
    }, chatHistory.slice(0, -1)); // History without the current message as generate adds it

    chatHistory.push({ role: 'assistant', content: fullText });

    // Extract python code blocks
    const pythonRegex = /```python\n([\s\S]*?)```/g;
    let match;
    const codeBlocks: string[] = [];
    while ((match = pythonRegex.exec(fullText)) !== null) {
      codeBlocks.push(match[1]);
    }

    if (codeBlocks.length > 0) {
      clearPythonOutput();
      const originalHandler = (python as any).onOutput;
      const dualPythonHandler = (output: PythonOutput) => {
        handlePythonOutput(output, artifactContainer); // Chat
        handlePythonOutput(output, pythonOutputEl);    // Python Tab
      };

      for (const code of codeBlocks) {
        pythonStatusEl.textContent = 'Running...';
        try {
          // Temporarily swap handler to capture output inline and in tab
          (python as any).onOutput = dualPythonHandler;

          await python.execute(code);
          pythonStatusEl.textContent = 'Ready';
        } catch (err: any) {
          pythonStatusEl.textContent = 'Error';
          // Errors are already handled via handlePythonOutput (inline)

          // Automatic error recovery
          // Restore handler before potential recursive call
          (python as any).onOutput = originalHandler;

          const logs = logger.getLogs().slice(-10); // Last 10 logs for context
          const logContext = logs.map(l => `[${l.category}] ${l.message}`).join('\n');
          const recoveryPrompt = `The previous Python code failed with the following error:
\`\`\`
${err.message}
\`\`\`

Recent system logs:
\`\`\`
${logContext}
\`\`\`

Please analyze the error and provide a corrected version of the code.`;

          addMessage(recoveryPrompt, 'user');
          // Restore handler before potential recursive call
          (python as any).onOutput = originalHandler;
          // Use setTimeout to avoid synchronous recursion which might cause stack issues or interference with WebLLM state
          setTimeout(() => handleSend(recoveryPrompt, retryCount + 1), 0);
          return; // Exit current handleSend and skip the finally re-enabling logic
        } finally {
          (python as any).onOutput = originalHandler;
        }
      }
    }

    const stats = await engine.getStats()
    if (stats) statsEl.textContent = stats
  } catch (err: any) {
    assistantDiv.textContent = `Error: ${err.message}`
  } finally {
    if (retryCount === 0) {
      // Re-enable input only if it's the top-level call and we are not recovering
      // Wait a bit to ensure all state is updated
      setTimeout(() => {
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
      }, 100);
    }
  }
}

sendBtn.onclick = () => handleSend()
userInput.onkeypress = (e) => {
  if (e.key === 'Enter') handleSend()
}
