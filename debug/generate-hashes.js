// Run this in the browser console after a model is downloaded
// to generate the actual SHA-256 hash

async function generateModelHash(modelId) {
  console.log(`Generating hash for ${modelId}...`);
  
  try {
    const cacheKey = `web-llm-${modelId}`;
    const cache = await caches.open(cacheKey);
    const keys = await cache.keys();
    
    if (keys.length === 0) {
      console.error('No cached model found');
      return;
    }
    
    // Combine all chunks
    const chunks = [];
    let totalSize = 0;
    
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const chunk = await response.arrayBuffer();
        chunks.push(chunk);
        totalSize += chunk.byteLength;
      }
    }
    
    // Create combined buffer
    const combinedBuffer = new ArrayBuffer(totalSize);
    const combinedView = new Uint8Array(combinedBuffer);
    let offset = 0;
    
    for (const chunk of chunks) {
      combinedView.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    
    // Calculate hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', combinedBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log(`Model: ${modelId}`);
    console.log(`Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`SHA-256: sha256-${hashHex}`);
    console.log('\nCopy this into models.manifest.json:');
    console.log(JSON.stringify({
      sha256: `sha256-${hashHex}`,
      size: totalSize
    }, null, 2));
    
    return {
      modelId,
      size: totalSize,
      sha256: `sha256-${hashHex}`
    };
  } catch (error) {
    console.error('Error generating hash:', error);
  }
}

// Usage examples:
// generateModelHash('TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC');
// generateModelHash('Llama-3.2-1B-Instruct-q4f16_1-MLC');
// generateModelHash('gemma-2-2b-it-q4f16_1-MLC');

// Generate all hashes
async function generateAllHashes() {
  const models = [
    'TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC',
    'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    'gemma-2-2b-it-q4f16_1-MLC'
  ];
  
  const results = {};
  
  for (const modelId of models) {
    try {
      const result = await generateModelHash(modelId);
      if (result) {
        results[modelId] = result;
      }
    } catch (error) {
      console.error(`Failed to generate hash for ${modelId}:`, error);
    }
  }
  
  console.log('\n=== Complete Manifest ===');
  console.log(JSON.stringify({
    version: "1.0.0",
    models: results
  }, null, 2));
}

console.log('Hash generation utilities loaded. Use generateModelHash(modelId) or generateAllHashes()');
