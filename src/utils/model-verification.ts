import { logger } from '../logger';

export interface ModelManifest {
  version: string;
  models: Record<string, {
    sha256: string;
    size: number;
    urls: string[];
  }>;
}

export class ModelVerifier {
  private manifest: ModelManifest | null = null;
  private manifestUrl: string;

  constructor(manifestUrl: string = '/models.manifest.json') {
    this.manifestUrl = manifestUrl;
  }

  async loadManifest(): Promise<void> {
    try {
      const response = await fetch(this.manifestUrl);
      if (!response.ok) {
        throw new Error(`Failed to load manifest: ${response.status}`);
      }
      this.manifest = await response.json();
      logger.info('llm', 'Model manifest loaded successfully');
    } catch (error) {
      logger.error('llm', 'Failed to load model manifest', { error });
      throw error;
    }
  }

  async verifyModel(modelId: string, modelData: ArrayBuffer): Promise<boolean> {
    if (!this.manifest) {
      await this.loadManifest();
    }

    const modelInfo = this.manifest!.models[modelId];
    if (!modelInfo) {
      logger.warn('llm', 'Model not found in manifest', { modelId });
      return true; // Allow unknown models
    }

    // Skip verification if hash is pending
    if (modelInfo.sha256 === 'sha256-PENDING_HASH_GENERATION') {
      logger.warn('llm', 'Skipping verification - hash not generated', { modelId });
      return true;
    }

    // Check size first
    if (modelData.byteLength !== modelInfo.size) {
      const error = `Model size mismatch: expected ${modelInfo.size}, got ${modelData.byteLength}`;
      logger.error('llm', error, { modelId });
      throw new Error(error);
    }

    // Verify SHA-256 hash
    const expectedHash = modelInfo.sha256.replace('sha256-', '');
    const actualHash = await this.calculateSHA256(modelData);

    if (actualHash !== expectedHash) {
      const error = `Model integrity check failed: hash mismatch\nExpected: ${expectedHash}\nActual: ${actualHash}`;
      logger.error('llm', error, { modelId });
      throw new Error(error);
    }

    logger.info('llm', 'Model verified successfully', { 
      modelId, 
      size: modelData.byteLength,
      hash: actualHash.substring(0, 16) + '...' 
    });

    return true;
  }

  private async calculateSHA256(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }
}

// Singleton instance
export const modelVerifier = new ModelVerifier();
