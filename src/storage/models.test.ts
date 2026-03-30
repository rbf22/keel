import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { modelStorage, type StoredModel } from './models'

describe('ModelStorage', () => {
  beforeEach(async () => {
    await modelStorage.init()
  })

  afterEach(async () => {
    // Clean up database
    if (modelStorage['db']) {
      modelStorage['db'].close()
      await indexedDB.deleteDatabase('KeelModels')
    }
  })

  it('should save and retrieve a model', async () => {
    const model: StoredModel = {
      modelId: 'test-model',
      size: 1000000,
      downloadDate: new Date(),
      status: 'ready'
    }

    await modelStorage.saveModel(model)
    const retrieved = await modelStorage.getModel('test-model')

    expect(retrieved).toEqual(model)
  })

  it('should update an existing model', async () => {
    const model: StoredModel = {
      modelId: 'test-model',
      size: 1000000,
      downloadDate: new Date(),
      status: 'downloading'
    }

    await modelStorage.saveModel(model)
    
    const updatedModel = { ...model, status: 'ready' as const, progress: 100 }
    await modelStorage.saveModel(updatedModel)
    
    const retrieved = await modelStorage.getModel('test-model')
    expect(retrieved?.status).toBe('ready')
    expect(retrieved?.progress).toBe(100)
  })

  it('should get all models', async () => {
    const models: StoredModel[] = [
      {
        modelId: 'model1',
        size: 1000000,
        downloadDate: new Date(),
        status: 'ready'
      },
      {
        modelId: 'model2',
        size: 2000000,
        downloadDate: new Date(),
        status: 'downloading',
        progress: 50
      }
    ]

    for (const model of models) {
      await modelStorage.saveModel(model)
    }

    const allModels = await modelStorage.getAllModels()
    expect(allModels).toHaveLength(2)
    expect(allModels).toEqual(expect.arrayContaining(models))
  })

  it('should delete a model', async () => {
    const model: StoredModel = {
      modelId: 'test-model',
      size: 1000000,
      downloadDate: new Date(),
      status: 'ready'
    }

    await modelStorage.saveModel(model)
    expect(await modelStorage.getModel('test-model')).toBeTruthy()

    await modelStorage.deleteModel('test-model')
    expect(await modelStorage.getModel('test-model')).toBeFalsy()
  })

  it('should get storage usage estimate', async () => {
    // Mock navigator.storage if not available
    if (!navigator.storage) {
      (navigator as any).storage = {
        estimate: vi.fn().mockResolvedValue({
          usage: 5000000000, // 5GB
          quota: 10000000000 // 10GB
        })
      }
    }

    const usage = await modelStorage.getStorageUsage()
    
    expect(usage.used).toBe(5000000000)
    expect(usage.available).toBe(10000000000)
  })

  it('should handle missing storage API gracefully', async () => {
    // Temporarily remove storage API
    const originalStorage = (navigator as any).storage
    delete (navigator as any).storage

    const usage = await modelStorage.getStorageUsage()
    
    // Simple assertions
    if (usage.used !== 0) {
      throw new Error(`Expected used to be 0, got ${usage.used}`)
    }
    if (usage.available !== 0) {
      throw new Error(`Expected available to be 0, got ${usage.available}`)
    }

    // Restore
    (navigator as any).storage = originalStorage
  })
})
