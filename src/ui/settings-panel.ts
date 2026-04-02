import { logger } from "../logger";
import { SUPPORTED_MODELS } from "../llm";
import { LocalLLMEngine } from "../llm";
import { onDownloadComplete } from "../llm/cache";

export class SettingsPanel {
  private modelSelect: HTMLSelectElement;
  private storageUsage: HTMLElement;
  private modelsList: HTMLElement;
  private refreshModelsBtn: HTMLButtonElement;
  private clearAllModelsBtn: HTMLButtonElement;

  private onModelSelected?: (modelId: string) => void;
  private refreshInterval: any = null;

  constructor(
    onModelSelected?: (modelId: string) => void
  ) {
    this.onModelSelected = onModelSelected;
    
    this.modelSelect = document.getElementById('modelSelect')! as HTMLSelectElement;
    this.storageUsage = document.getElementById('storageUsage')!;
    this.modelsList = document.getElementById('modelsList')!;
    this.refreshModelsBtn = document.getElementById('refreshModelsBtn')! as HTMLButtonElement;
    this.clearAllModelsBtn = document.getElementById('clearAllModelsBtn')! as HTMLButtonElement;

    this.init();
  }

  private async init() {
    this.refreshModelsBtn.onclick = () => this.updateModelsDisplay();
    this.clearAllModelsBtn.onclick = () => this.clearAllModels();
    
    // Also listen for change on the hidden/original select
    this.modelSelect.onchange = () => {
      localStorage.setItem('selectedModelId', this.modelSelect.value);
      if (this.onModelSelected) this.onModelSelected(this.modelSelect.value);
      void this.updateModelsDisplay();
    };
    
    // Register callback for when downloads complete
    onDownloadComplete(() => {
      void this.updateModelsDisplay();
      void this.updateModelSelectWithCacheStatus();
    });

    await this.loadSettings();
    await this.updateModelsDisplay();
  }

  private async loadSettings() {
    // Load saved model selection
    const savedModelId = localStorage.getItem('selectedModelId');
    if (savedModelId) {
      this.modelSelect.value = savedModelId;
    }
    
    await this.updateModelSelectWithCacheStatus();
  }

  async updateModelSelectWithCacheStatus() {
    try {
      const cachedModels = await LocalLLMEngine.getAllCachedModels();
      const cachedModelIds = new Set(cachedModels.filter(m => !m.isCorrupted).map(m => m.modelId));
      
      const options = SUPPORTED_MODELS.map(m => {
        const isCached = cachedModelIds.has(m.modelId);
        const cachedLabel = isCached ? ' [cached]' : '';
        return `<option value="${m.modelId}">${m.displayName}${cachedLabel} (~${m.vramRequiredMB}MB)</option>`;
      });
      
      const currentVal = this.modelSelect.value;
      this.modelSelect.innerHTML = '<option value="">Select model...</option>' + options.join('');
      // Preserve selection if possible, otherwise use first available or default
      if (currentVal && SUPPORTED_MODELS.some(m => m.modelId === currentVal)) {
        this.modelSelect.value = currentVal;
      }
    } catch (error) {
      console.error('Failed to update model select with cache status:', error);
    }
  }

  async updateModelsDisplay() {
    console.log("🔄 updateModelsDisplay called");
    try {
      const models = await LocalLLMEngine.getAllCachedModels();
      console.log("📊 Got models:", models.length, models);
      logger.debug("main", "Received models from engine", { 
        count: models.length,
        models: models.map(m => ({ 
          modelId: m.modelId, 
          sizeMB: (m.size / 1024 / 1024).toFixed(2),
          isCorrupted: m.isCorrupted,
          isEmpty: m.isEmpty,
          isDownloading: (m as any).isDownloading 
        }))
      });
      
      const totalModelsSize = models.reduce((sum, model) => sum + (model.size > 0 ? model.size : 0), 0);
      const totalModelsSizeMB = (totalModelsSize / 1024 / 1024).toFixed(1);
      
      // Get browser-wide storage estimate
      let storageEstimateHtml = '';
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage !== undefined && estimate.quota !== undefined) {
          const usageMB = (estimate.usage / 1024 / 1024).toFixed(1);
          const quotaGB = (estimate.quota / 1024 / 1024 / 1024).toFixed(1);
          const percent = ((estimate.usage / estimate.quota) * 100).toFixed(1);
          
          storageEstimateHtml = `
            <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #333;">
              <strong>Browser Storage (All Sites):</strong><br>
              Usage: ${usageMB} MB / ${quotaGB} GB (${percent}%)
              <div style="width: 100%; height: 4px; background: #333; border-radius: 2px; margin-top: 4px;">
                <div style="width: ${percent}%; height: 100%; background: #007AFF; border-radius: 2px;"></div>
              </div>
            </div>
          `;
        }
      }

      const corruptedCount = models.filter(m => m.isCorrupted).length;
      const currentModelId = this.modelSelect.value;
      
      this.storageUsage.innerHTML = `
        <div class="storage-summary">
          <strong>Model Cache Size:</strong> ${totalModelsSizeMB} MB
          <br><strong>Cached Models:</strong> ${models.length}
          ${corruptedCount > 0 ? `<br><span style="color: #ff6b6b;"><strong>⚠️ Corrupted:</strong> ${corruptedCount}</span>` : ''}
          ${storageEstimateHtml}
        </div>
      `;
      
      const addModelHtml = `
        <div class="add-model-section" style="margin-top: 1rem; padding: 1rem; border: 1px solid #333; border-radius: 4px; background: #111;">
          <h4 style="margin-top: 0; margin-bottom: 0.75rem;">Download New Model</h4>
          <p class="settings-hint" style="margin-bottom: 0.75rem;">Select a model to download and add it to your local cache.</p>
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <select id="addModelSelect" style="padding: 0.5rem; flex: 1; min-width: 200px; background: #000; color: #fff; border: 1px solid #444; border-radius: 4px;">
              ${SUPPORTED_MODELS.map(m => `<option value="${m.modelId}">${m.displayName} (~${m.vramRequiredMB}MB)</option>`).join('')}
            </select>
            <button id="addModelBtn" class="button" style="padding: 0.5rem 1rem;">Download</button>
          </div>
        </div>
      `;
      
      if (models.length === 0) {
        this.modelsList.innerHTML = `
          <div class="output-log" style="margin-bottom: 1rem;">No cached models found.</div>
          ${addModelHtml}
        `;
      } else {
        const modelsHtml = models.map(model => {
          const sizeMB = model.size > 0 ? (model.size / 1024 / 1024).toFixed(1) : "Unknown";
          const isActive = model.modelId === currentModelId;
          const isDownloading = (model as any).isDownloading;
          
          let statusLabel = '<span style="color: #51cf66;">✅ Cached</span>';
          if (model.isCorrupted) statusLabel = '<span style="color: #ff6b6b;">❌ Corrupted</span>';
          if (model.isEmpty) statusLabel = '<span style="color: #ffa500;">⚠️ Empty</span>';
          if (isDownloading) {
              const statusText = (model as any).status || "Downloading...";
              statusLabel = `
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                    <span style="color: #007AFF; font-weight: bold; animation: pulse 1.5s infinite;">⏳ Initializing...</span>
                    <span style="font-size: 0.7rem; color: #888; max-width: 200px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${statusText}</span>
                </div>
              `;
          } else if (isActive) {
              statusLabel = '<span style="color: #007AFF;">🎯 ACTIVE</span>';
          }
          
          return `
            <div class="model-item ${isActive ? 'active' : ''} ${isDownloading ? 'downloading' : ''}" data-model-id="${model.modelId}" style="cursor: pointer; transition: all 0.2s; ${isActive ? 'border: 2px solid #007AFF; background: rgba(0, 122, 255, 0.1);' : 'border: 1px solid #333;'}">
              <div class="model-info" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <div style="display: flex; flex-direction: column;">
                    <strong>${model.modelId}</strong>
                    <span class="model-size" style="font-size: 0.8rem; color: #888;">${isDownloading ? 'Size: --' : `Size: ${sizeMB}${sizeMB !== 'Unknown' ? ' MB' : ''}`}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div class="model-status">${statusLabel}</div>
                    ${(!isActive && !isDownloading) ? `<button class="button small-button select-model-btn" data-model-id="${model.modelId}">Select</button>` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('');
        
        this.modelsList.innerHTML = addModelHtml + '<h4 style="margin-top: 1.5rem; margin-bottom: 0.75rem;">Cached Models</h4>' + `
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                ${modelsHtml}
            </div>
        `;
      }

      // Manage refresh interval for downloads
      const hasActiveDownloads = models.some(m => (m as any).isDownloading);
      if (hasActiveDownloads && !this.refreshInterval) {
        this.refreshInterval = setInterval(() => {
          void this.updateModelsDisplay();
          void this.updateModelSelectWithCacheStatus();
        }, 1000);
      } else if (!hasActiveDownloads && this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }
      
      // Setup model item click handlers
      document.querySelectorAll('.model-item').forEach(item => {
          (item as HTMLElement).onclick = (e) => {
              // Don't trigger if clicking the select button (handled separately)
              if ((e.target as HTMLElement).classList.contains('select-model-btn')) return;
              
              const modelId = (item as HTMLElement).dataset.modelId;
              if (modelId) this.selectModel(modelId);
          };
      });

      document.querySelectorAll('.select-model-btn').forEach(btn => {
          (btn as HTMLButtonElement).onclick = (e) => {
              e.stopPropagation();
              const modelId = (btn as HTMLElement).dataset.modelId;
              if (modelId) this.selectModel(modelId);
          };
      });

      // Setup add model button handler
      const addModelBtn = document.getElementById('addModelBtn') as HTMLButtonElement;
      const addModelSelect = document.getElementById('addModelSelect') as HTMLSelectElement;
      if (addModelBtn && addModelSelect) {
        addModelBtn.onclick = async () => {
          const modelId = addModelSelect.value;
          addModelBtn.disabled = true;
          addModelBtn.textContent = 'Adding...';
          try {
            await this.selectModel(modelId);
          } finally {
            addModelBtn.disabled = false;
            addModelBtn.textContent = 'Download';
          }
        };
      }
    } catch (error) {
      logger.error('main', 'Failed to update models display', { error });
    }
  }

  private async selectModel(modelId: string) {
      localStorage.setItem('selectedModelId', modelId);
      this.modelSelect.value = modelId;
      
      if (this.onModelSelected) {
          this.onModelSelected(modelId);
      }
      
      await this.updateModelsDisplay();
      await this.updateModelSelectWithCacheStatus();
      logger.info('main', `Model selected: ${modelId}`);
  }

  private async clearAllModels() {
    if (confirm('Are you sure you want to clear all cached models? This will delete all downloaded model files.')) {
      try {
        await LocalLLMEngine.clearAllCachedModels();
        await this.updateModelsDisplay();
        await this.updateModelSelectWithCacheStatus();
        logger.info('main', 'All cached models cleared by user');
      } catch (error) {
        logger.error('main', 'Failed to clear cached models', { error });
      }
    }
  }

  getSelectedModel(): string {
    return this.modelSelect.value;
  }
}
