export const HTML_TEMPLATE = `
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
          <button class="tab-btn" data-tab="models">Models</button>
          <button class="tab-btn" data-tab="logs">Logs <span id="logNotification" class="notification-dot" style="display: none;"></span></button>
        </div>

        <div class="output-content active" id="chatTab" data-tab-content="chat">
          <div class="chat-container">
            <div class="messages" id="messages">
              <div class="message assistant-message">Hello! I am Keel, your local agentic workstation. Select a model and press "Initialize" to start.</div>
            </div>
            <div class="input-area">
              <select id="modelSelect" style="display: none;">
                <option value="">Select cached model...</option>
              </select>
              <input type="text" id="userInput" placeholder="Type a message..." disabled />
              <button id="sendBtn" disabled>Send</button>
              <button id="stopBtn" style="display: none; background-color: #ff3b30;">Stop</button>
              <button id="initBtn" class="button primary-button" style="display: none;">Initialize</button>
            </div>
          </div>
        </div>

        <div class="output-content" id="contextTab" data-tab-content="context" style="display: none;">
          <div class="context-header">
            <h3>Keel Virtual Filesystem (keel://)</h3>
            <button id="refreshContextBtn" class="header-button">Refresh List</button>
          </div>
          <div id="vfsContainer" class="context-container">
            <div class="output-log">Context not initialized.</div>
          </div>
        </div>

        <div class="output-content" id="pythonOutputTab" data-tab-content="python" style="display: none;">
          <div class="python-header">
            <h3>Python Output</h3>
            <button id="clearPythonBtn" class="header-button">Clear</button>
          </div>
          <div id="pythonLogContainer" class="python-log-container">
            <div class="output-log">Python runtime not initialized.</div>
          </div>
        </div>

        <div class="output-content" id="skillsTab" data-tab-content="skills" style="display: none;">
          <div class="skills-header">
            <h3>Skills</h3>
            <div class="skills-controls">
              <input type="text" id="skillSearchInput" placeholder="Search skills..." />
              <button id="installSkillBtn" class="header-button">Install Skill</button>
              <button id="refreshSkillsBtn" class="header-button">Refresh</button>
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

        <div class="output-content" id="settingsTab" data-tab-content="models" style="display: none;">
          <div class="settings-container">
            <div class="python-header">
              <h3>Model Configuration & Cache</h3>
              <div class="skills-controls">
                <button id="refreshModelsBtn" class="header-button">Refresh List</button>
                <button id="clearAllModelsBtn" class="header-button danger-button">Clear All Models</button>
              </div>
            </div>
            <div id="modelsUnifiedContent" class="models-unified-content">

              <hr style="border: 0; border-top: 1px solid #333; margin: 1.5rem 0;">

              <!-- Cache Management Section -->
              <div class="settings-section">
                <div class="settings-group">
                  <label>Storage Usage</label>
                  <div id="storageUsage" class="storage-usage-panel">
                    <div class="output-log">Calculating storage...</div>
                  </div>
                </div>

                <div id="modelsList" class="models-list">
                  <div class="output-log">Loading cached models...</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="output-content" id="logsTab" data-tab-content="logs" style="display: none;">
          <div class="logs-header">
            <h3>System Logs</h3>
            <button id="copyLogsBtn" class="header-button">Copy Logs</button>
          </div>
          <div id="logsContainer" class="logs-container">
            <div class="output-log">No logs yet.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
`;
