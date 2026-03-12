import './style.css'
import { LLMEngine, SUPPORTED_MODELS, detectBestModel } from './llm'

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <div>
    <h1>Keel 🛰️</h1>
    <div class="status-bar" id="status">Ready</div>
    <div class="chat-container">
      <div class="messages" id="messages">
        <div class="message assistant-message">Hello! I am your local iPad agent. Select a model and press "Initialize" to start my brain.</div>
      </div>
      <div class="input-area">
        <input type="text" id="userInput" placeholder="Type a message..." disabled />
        <button id="sendBtn" disabled>Send</button>
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
      <button id="initBtn">Initialize Local LLM</button>
    </div>
  </div>
`

const statusEl = document.getElementById('status')!
const modelSelect = document.getElementById('modelSelect')! as HTMLSelectElement
const modelSelectContainer = document.getElementById('modelSelectContainer')!
const messagesEl = document.getElementById('messages')!
const userInput = document.getElementById('userInput')! as HTMLInputElement
const sendBtn = document.getElementById('sendBtn')! as HTMLButtonElement
const initBtn = document.getElementById('initBtn')! as HTMLButtonElement
const statsEl = document.getElementById('stats')!

let engine: LLMEngine | null = null

// Initialize model selection
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

initBtn.onclick = async () => {
  initBtn.disabled = true
  modelSelect.disabled = true
  statusEl.innerText = "Initializing..."

  const selectedModelId = modelSelect.value;
  localStorage.setItem('selectedModelId', selectedModelId);

  try {
    engine = new LLMEngine(selectedModelId, (msg) => {
      statusEl.innerText = msg
    })
    await engine.init()

    statusEl.innerText = "Local LLM Ready (WebGPU)"
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
  if (!text || !engine) return

  userInput.value = ''
  addMessage(text, 'user')

  const assistantDiv = addMessage('...', 'assistant')

  try {
    await engine.generate(text, (fullText) => {
      assistantDiv.innerText = fullText
      messagesEl.scrollTop = messagesEl.scrollHeight
    })

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
