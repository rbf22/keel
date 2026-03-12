import './style.css'
import { LLMEngine } from './llm'

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <div>
    <h1>Keel 🛰️</h1>
    <div class="status-bar" id="status">Ready</div>
    <div class="chat-container">
      <div class="messages" id="messages">
        <div class="message assistant-message">Hello! I am your local iPad agent. Press "Initialize" to start my brain.</div>
      </div>
      <div class="input-area">
        <input type="text" id="userInput" placeholder="Type a message..." disabled />
        <button id="sendBtn" disabled>Send</button>
      </div>
    </div>
    <div class="stats" id="stats"></div>
    <div style="margin-top: 1rem;">
      <button id="initBtn">Initialize Local LLM</button>
    </div>
  </div>
`

const statusEl = document.getElementById('status')!
const messagesEl = document.getElementById('messages')!
const userInput = document.getElementById('userInput')! as HTMLInputElement
const sendBtn = document.getElementById('sendBtn')! as HTMLButtonElement
const initBtn = document.getElementById('initBtn')! as HTMLButtonElement
const statsEl = document.getElementById('stats')!

let engine: LLMEngine | null = null

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
  statusEl.innerText = "Initializing..."

  try {
    engine = new LLMEngine((msg) => {
      statusEl.innerText = msg
    })
    await engine.init()

    statusEl.innerText = "Local LLM Ready (WebGPU)"
    userInput.disabled = false
    sendBtn.disabled = false
    initBtn.style.display = 'none'
  } catch (err: any) {
    statusEl.innerText = `Error: ${err.message}`
    initBtn.disabled = false
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
