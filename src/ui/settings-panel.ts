import { logger } from "../logger";
import { getSortedModelList } from "../llm/models";
import { LocalLLMEngine } from "../llm";
import { onDownloadComplete } from "../llm/cache";
import { clearCachedModel } from "../llm/cache";
import { storage } from "../storage";

export class SettingsPanel {
  private modelSelect: HTMLSelectElement;
  private storageUsage: HTMLElement;
  private modelsList: HTMLElement;
  private refreshModelsBtn: HTMLButtonElement;
  private clearAllModelsBtn: HTMLButtonElement;
  private artifactsList: HTMLElement;
  private refreshArtifactsBtn: HTMLButtonElement;
  private clearAllArtifactsBtn: HTMLButtonElement;

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
    this.artifactsList = document.getElementById('artifactsList')!;
    this.refreshArtifactsBtn = document.getElementById('refreshArtifactsBtn')! as HTMLButtonElement;
    this.clearAllArtifactsBtn = document.getElementById('clearAllArtifactsBtn')! as HTMLButtonElement;

    console.log("🔍 SettingsPanel constructor - DOM elements found:", {
      modelSelect: !!this.modelSelect,
      storageUsage: !!this.storageUsage,
      modelsList: !!this.modelsList,
      refreshModelsBtn: !!this.refreshModelsBtn,
      clearAllModelsBtn: !!this.clearAllModelsBtn,
      artifactsList: !!this.artifactsList,
      refreshArtifactsBtn: !!this.refreshArtifactsBtn,
      clearAllArtifactsBtn: !!this.clearAllArtifactsBtn
    });

    this.init();
  }

  private async init() {
    this.refreshModelsBtn.onclick = () => {
      console.log("🔄 Refresh button clicked");
      this.updateModelsDisplay();
    };
    this.clearAllModelsBtn.onclick = () => this.clearAllModels();
    
    // Artifacts management event listeners
    this.refreshArtifactsBtn.onclick = () => {
      console.log("🔄 Refresh artifacts button clicked");
      this.updateArtifactsDisplay();
    };
    this.clearAllArtifactsBtn.onclick = () => this.clearAllArtifacts();
    
    // Also listen for change on the hidden/original select
    this.modelSelect.onchange = () => {
      const modelId = this.modelSelect.value;
      if (modelId) {
        console.log(`📞 Model changed: ${modelId}`);
        this.selectModel(modelId);
      }
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
    // Load saved model selection with validation
    const savedModelId = localStorage.getItem('selectedModelId');
    
    if (savedModelId) {
      try {
        // Check if saved model is actually available in cached models
        const cachedModels = await LocalLLMEngine.getAllCachedModels();
        const availableModelIds = new Set(cachedModels.filter(m => !m.isCorrupted && !m.isEmpty).map(m => m.modelId));
        
        if (availableModelIds.has(savedModelId)) {
          this.modelSelect.value = savedModelId;
          logger.info('main', `Using saved model: ${savedModelId}`);
        } else {
          // Saved model is not available, clear it and use a fallback
          logger.warn('main', `Saved model ${savedModelId} is not available, clearing selection`);
          localStorage.removeItem('selectedModelId');
          
          // Set to the smallest available cached model as fallback
          const availableModels = cachedModels.filter(m => !m.isCorrupted && !m.isEmpty);
          if (availableModels.length > 0) {
            const fallbackModel = availableModels.sort((a, b) => (a.size || 0) - (b.size || 0))[0];
            localStorage.setItem('selectedModelId', fallbackModel.modelId);
            this.modelSelect.value = fallbackModel.modelId;
            logger.info('main', `Set fallback model: ${fallbackModel.modelId}`);
          }
        }
      } catch (error) {
        logger.error('main', 'Failed to validate saved model', { error: error instanceof Error ? error.message : String(error) });
        localStorage.removeItem('selectedModelId');
      }
    }
    
    await this.updateModelSelectWithCacheStatus();
  }

  async updateModelSelectWithCacheStatus() {
    try {
      const cachedModels = await LocalLLMEngine.getAllCachedModels();
      const cachedModelIds = new Set(cachedModels.filter(m => !m.isCorrupted).map(m => m.modelId));
      
      const supportedModels = await getSortedModelList();
      const options = supportedModels.map(m => {
        const isCached = cachedModelIds.has(m.modelId);
        const cachedLabel = isCached ? ' [cached]' : '';
        return `<option value="${m.modelId}">${m.displayName}${cachedLabel} (~${m.vramRequiredMB}MB)</option>`;
      });
      
      const currentVal = this.modelSelect.value;
      this.modelSelect.innerHTML = '<option value="">Select model...</option>' + options.join('');
      // Preserve selection if possible, otherwise use first available or default
      if (currentVal && supportedModels.some(m => m.modelId === currentVal)) {
        this.modelSelect.value = currentVal;
      }
    } catch (error) {
      console.error('Failed to update model select with cache status:', error);
    }
  }

  async updateModelsDisplay() {
    console.log("🔍 updateModelsDisplay called");
    try {
      const cachedModels = await LocalLLMEngine.getAllCachedModels();
      console.log("📊 Got cached models:", cachedModels);
      console.log("📊 Models count:", cachedModels.length);
      
      // Check if we have the DOM elements
      console.log("🔍 DOM elements check:");
      console.log("  - this.storageUsage:", this.storageUsage);
      console.log("  - this.modelsList:", this.modelsList);
      
      if (!this.storageUsage || !this.modelsList) {
        console.error("❌ DOM elements not found!");
        return;
      }
      
      logger.info('main', 'Updating models display', { 
        count: cachedModels.length,
        models: cachedModels.map(m => ({ 
          modelId: m.modelId, 
          sizeMB: (m.size / 1024 / 1024).toFixed(2),
          isCorrupted: m.isCorrupted,
          isEmpty: m.isEmpty,
          isDownloading: (m as any).isDownloading 
        }))
      });
      
      const totalModelsSize = cachedModels.reduce((sum: number, model: any) => sum + (model.size > 0 ? model.size : 0), 0);
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

      const corruptedCount = cachedModels.filter((m: any) => m.isCorrupted).length;
      const currentModelId = this.modelSelect.value;
      
      this.storageUsage.innerHTML = `
        <div class="storage-summary">
          <strong>Model Cache Size:</strong> ${totalModelsSizeMB} MB
          <br><strong>Cached Models:</strong> ${cachedModels.length}
          ${corruptedCount > 0 ? `<br><span style="color: #ff6b6b;"><strong>⚠️ Corrupted:</strong> ${corruptedCount}</span>` : ''}
          ${storageEstimateHtml}
        </div>
      `;
      
      console.log("📝 Storage usage HTML set");
      
      const addModelHtml = `
        <div class="add-model-section" style="margin-top: 1rem; padding: 1rem; border: 1px solid #333; border-radius: 4px; background: #111;">
          <h4 style="margin-top: 0; margin-bottom: 0.75rem;">Download New Model</h4>
          <p class="settings-hint" style="margin-bottom: 0.75rem;">Select a model to download and add it to your local cache.</p>
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <select id="addModelSelect" style="padding: 0.5rem; flex: 1; min-width: 200px; background: #000; color: #fff; border: 1px solid #444; border-radius: 4px;">
              ${(await getSortedModelList()).map(m => `<option value="${m.modelId}">${m.displayName} (~${m.vramRequiredMB}MB)</option>`).join('')}
            </select>
            <button id="addModelBtn" class="button" style="padding: 0.5rem 1rem;">Download</button>
          </div>
        </div>
      `;
      
      console.log("📝 Add model HTML created");
      
      if (cachedModels.length === 0) {
        console.log("📝 No models found, showing empty state");
        this.modelsList.innerHTML = `
          <div class="output-log" style="margin-bottom: 1rem;">No cached models found.</div>
          ${addModelHtml}
        `;
      } else {
        console.log("📝 Found models, creating model items");
        const modelsHtml = cachedModels.map((model: any) => {
          const sizeMB = model.size > 0 ? (model.size / 1024 / 1024).toFixed(1) : "Unknown";
          const isActive = model.modelId === currentModelId;
          const isDownloading = (model as any).isDownloading;
          
          console.log(`📝 Creating model item: ${model.modelId} (${sizeMB}MB)`);
          
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
                    ${(!isDownloading) ? `<button class="button small-button danger-button delete-model-btn" data-model-id="${model.modelId}" style="margin-left: 0.5rem;">Delete</button>` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('');
        
        console.log("📝 Models HTML created:", modelsHtml.substring(0, 200) + "...");
        
        this.modelsList.innerHTML = addModelHtml + '<h4 style="margin-top: 1.5rem; margin-bottom: 0.75rem;">Cached Models</h4>' + `
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                ${modelsHtml}
            </div>
        `;
        
        console.log("📝 Models list HTML set");
      }

      // Manage refresh interval for downloads
      const hasActiveDownloads = cachedModels.some((m: any) => m.isDownloading);
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

      document.querySelectorAll('.delete-model-btn').forEach(btn => {
          (btn as HTMLButtonElement).onclick = (e) => {
              e.stopPropagation();
              const modelId = (btn as HTMLElement).dataset.modelId;
              if (modelId) this.deleteModel(modelId);
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
      console.log(`🎯 Selecting model: ${modelId}`);
      localStorage.setItem('selectedModelId', modelId);
      this.modelSelect.value = modelId;
      
      // Update UI immediately to show loading state
      await this.updateModelsDisplay();
      await this.updateModelSelectWithCacheStatus();
      
      if (this.onModelSelected) {
          console.log(`📞 Calling onModelSelected for: ${modelId}`);
          this.onModelSelected(modelId);
      }
      
      logger.info('main', `Model selected: ${modelId}`);
  }

  private async clearAllModels() {
    if (confirm('Are you sure you want to clear all cached models? This will delete all downloaded model files.')) {
      try {
        await LocalLLMEngine.clearAllCachedModels();
        logger.info('main', 'All cached models cleared');
        this.updateModelsDisplay();
      } catch (error) {
        logger.error('main', 'Failed to clear all models', { error });
        alert('Failed to clear models: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  }

  private async deleteModel(modelId: string) {
    if (confirm(`Are you sure you want to delete the model "${modelId}"? This will remove the downloaded model file.`)) {
      try {
        // Remove from WebLLM cache and IndexedDB storage
        await clearCachedModel(modelId);
        
        logger.info('main', `Model deleted: ${modelId}`);
        this.updateModelsDisplay();
      } catch (error) {
        logger.error('main', `Failed to delete model: ${modelId}`, { error });
        alert('Failed to delete model: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  }

  private async updateArtifactsDisplay() {
    try {
      if (!this.artifactsList) {
        console.error("❌ Artifacts list element not found!");
        return;
      }

      console.log("📝 Updating artifacts display");
      
      const artifacts = await storage.getArtifacts();
      
      if (artifacts.length === 0) {
        console.log("📝 No artifacts found, showing empty state");
        this.artifactsList.innerHTML = `
          <div class="output-log" style="margin-bottom: 1rem;">No artifacts found.</div>
        `;
      } else {
        console.log("📝 Found artifacts, creating artifact items");
        const artifactsHtml = artifacts.map((artifact: any) => {
          const fileName = artifact.path.replace('keel://artifacts/', '').replace('.py', '');
          const lastUpdated = new Date(artifact.updatedAt).toLocaleString();
          const fileSize = new Blob([artifact.content]).size;
          const sizeKB = fileSize > 0 ? (fileSize / 1024).toFixed(1) : "Unknown";
          
          console.log(`📝 Creating artifact item: ${fileName} (${sizeKB}KB)`);
          
          return `
            <div class="artifact-item" data-artifact-path="${artifact.path}" style="cursor: pointer; transition: all 0.2s; border: 1px solid #333; margin-bottom: 0.5rem;">
              <div class="artifact-info" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 0.75rem;">
                <div style="display: flex; flex-direction: column; flex: 1;">
                    <strong>${fileName}</strong>
                    <span class="artifact-size" style="font-size: 0.8rem; color: #888;">Size: ${sizeKB}${sizeKB !== 'Unknown' ? ' KB' : ''} • Updated: ${lastUpdated}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <button class="button small-button danger-button delete-artifact-btn" data-artifact-path="${artifact.path}">Delete</button>
                </div>
              </div>
            </div>
          `;
        }).join('');
        
        console.log("📝 Artifacts HTML created:", artifactsHtml.substring(0, 200) + "...");
        
        this.artifactsList.innerHTML = `
          <h4 style="margin-bottom: 0.75rem;">Artifacts (${artifacts.length})</h4>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              ${artifactsHtml}
          </div>
        `;
        
        console.log("📝 Artifacts list HTML set");
        
        // Setup delete artifact button handlers
        document.querySelectorAll('.delete-artifact-btn').forEach(btn => {
          (btn as HTMLButtonElement).onclick = (e) => {
            e.stopPropagation();
            const artifactPath = (btn as HTMLElement).dataset.artifactPath;
            if (artifactPath) this.deleteArtifact(artifactPath);
          };
        });
      }
    } catch (error) {
      logger.error('main', 'Failed to update artifacts display', { error });
      if (this.artifactsList) {
        this.artifactsList.innerHTML = `<div class="output-log">Error loading artifacts: ${error instanceof Error ? error.message : 'Unknown error'}</div>`;
      }
    }
  }

  private async deleteArtifact(artifactPath: string) {
    const fileName = artifactPath.replace('keel://artifacts/', '').replace('.py', '');
    if (confirm(`Are you sure you want to delete the artifact "${fileName}"? This will remove the artifact file.`)) {
      try {
        await storage.deleteArtifact(artifactPath);
        
        logger.info('main', `Artifact deleted: ${artifactPath}`);
        this.updateArtifactsDisplay();
      } catch (error) {
        logger.error('main', `Failed to delete artifact: ${artifactPath}`, { error });
        alert('Failed to delete artifact: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  }

  private async clearAllArtifacts() {
    if (confirm('Are you sure you want to clear all artifacts? This will delete all artifact files.')) {
      try {
        const deletedCount = await storage.deleteAllArtifacts();
        logger.info('main', `All artifacts cleared: ${deletedCount} deleted`);
        this.updateArtifactsDisplay();
      } catch (error) {
        logger.error('main', 'Failed to clear all artifacts', { error });
        alert('Failed to clear artifacts: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  }
}
