import './style.css'
import { LLMEngine, SUPPORTED_MODELS, detectBestModel } from './llm'
import { PythonRuntime, type PythonOutput } from './python-runtime'
import embed from 'vega-embed'

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <div>
    <h1>Keel 🛰️</h1>
    <div class="status-bar" id="status">Ready</div>

    <div class="main-layout">
      <div class="chat-container">
        <div class="messages" id="messages">
          <div class="message assistant-message">Hello! I am Keel, your local iPad agent. Select a model and press "Initialize" to start.</div>
        </div>
        <div class="input-area">
          <input type="text" id="userInput" placeholder="Type a message..." disabled />
          <button id="sendBtn" disabled>Send</button>
        </div>
      </div>

      <div class="output-panel">
        <div class="output-header">
          <span>Python Output</span>
          <span id="pythonStatus">Idle</span>
        </div>
        <div class="output-content" id="pythonOutput">
          <div class="output-log">Python runtime not initialized.</div>
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

let engine: LLMEngine | null = null
let python: PythonRuntime | null = null
let chatHistory: any[] = []

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
  div.innerText = text
  messagesEl.appendChild(div)
  messagesEl.scrollTop = messagesEl.scrollHeight
  return div
}

function clearPythonOutput() {
  pythonOutputEl.innerHTML = '';
}

function handlePythonOutput(output: PythonOutput) {
  if (output.type === 'ready') {
    pythonStatusEl.innerText = 'Ready';
    pythonOutputEl.innerHTML = '<div class="output-log">Python runtime ready.</div>';
    return;
  }

  if (output.type === 'log') {
    const logDiv = document.createElement('div');
    logDiv.className = 'output-log';
    logDiv.innerText = output.message || '';
    pythonOutputEl.appendChild(logDiv);
  } else if (output.type === 'error') {
    const errDiv = document.createElement('div');
    errDiv.className = 'output-error';
    errDiv.innerText = output.message || '';
    pythonOutputEl.appendChild(errDiv);
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
        th.innerText = key;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      output.data.forEach(row => {
        const tr = document.createElement('tr');
        keys.forEach(key => {
          const td = document.createElement('td');
          td.innerText = row[key];
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
    }
    container.appendChild(table);
    pythonOutputEl.appendChild(container);
  } else if (output.type === 'chart' && output.spec) {
    const chartDiv = document.createElement('div');
    chartDiv.className = 'chart-container';
    pythonOutputEl.appendChild(chartDiv);
    embed(chartDiv, output.spec, { actions: false });
  } else if (output.type === 'download' && output.filename && output.content) {
    const link = document.createElement('a');
    link.className = 'download-link';
    const blob = new Blob([output.content], { type: 'text/plain' });
    link.href = URL.createObjectURL(blob);
    link.download = output.filename;
    link.innerText = `Download ${output.filename}`;
    pythonOutputEl.appendChild(link);
  }

  pythonOutputEl.scrollTop = pythonOutputEl.scrollHeight;
}

initBtn.onclick = async () => {
  initBtn.disabled = true
  modelSelect.disabled = true
  statusEl.innerText = "Initializing LLM..."
  pythonStatusEl.innerText = "Initializing..."

  const selectedModelId = modelSelect.value;
  localStorage.setItem('selectedModelId', selectedModelId);

  try {
    // Init Python first or in parallel
    python = new PythonRuntime(handlePythonOutput);
    const pythonPromise = python.init();

    engine = new LLMEngine(selectedModelId, (msg) => {
      statusEl.innerText = msg
    })
    const enginePromise = engine.init();

    await Promise.all([pythonPromise, enginePromise]);

    statusEl.innerText = "Keel Ready (WebGPU + Python)"
    userInput.disabled = false
    sendBtn.disabled = false
    initBtn.style.display = 'none'
    modelSelectContainer.style.display = 'none'
  } catch (err: any) {
    statusEl.innerText = `Error: ${err.message}`
    initBtn.disabled = false
    modelSelect.disabled = false
  }
}

async function handleSend() {
  const text = userInput.value.trim()
  if (!text || !engine || !python) return

  userInput.value = ''
  addMessage(text, 'user')
  chatHistory.push({ role: 'user', content: text });

  const assistantDiv = addMessage('...', 'assistant')

  try {
    let fullText = "";
    await engine.generate(text, (updatedText) => {
      fullText = updatedText;
      assistantDiv.innerText = fullText
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
      for (const code of codeBlocks) {
        pythonStatusEl.innerText = 'Running...';
        try {
          await python.execute(code);
          pythonStatusEl.innerText = 'Ready';
        } catch (err: any) {
          pythonStatusEl.innerText = 'Error';
          // Errors are already handled via handlePythonOutput
        }
      }
    }

    const stats = await engine.getStats()
    if (stats) statsEl.innerText = stats
  } catch (err: any) {
    assistantDiv.innerText = `Error: ${err.message}`
  }
}

sendBtn.onclick = handleSend
userInput.onkeypress = (e) => {
  if (e.key === 'Enter') handleSend()
}
