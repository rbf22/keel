// This script generates SHA-256 hashes for WebLLM models
// Run with: node scripts/generate-model-manifest.js

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');

const models = [
  {
    id: 'TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC',
    baseUrl: 'https://huggingface.co/mlc-ai/TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC/resolve/main/'
  },
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    baseUrl: 'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/'
  },
  {
    id: 'gemma-2-2b-it-q4f16_1-MLC',
    baseUrl: 'https://huggingface.co/mlc-ai/gemma-2-2b-it-q4f16_1-MLC/resolve/main/'
  }
];

async function getFileHash(url) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    let totalSize = 0;
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to fetch ${url}: ${response.statusCode}`));
        return;
      }
      
      response.on('data', (chunk) => {
        hash.update(chunk);
        totalSize += chunk.length;
      });
      
      response.on('end', () => {
        resolve({
          hash: 'sha256-' + hash.digest('hex'),
          size: totalSize
        });
      });
    }).on('error', reject);
  });
}

async function generateManifest() {
  console.log('Generating model manifest with SHA-256 hashes...\n');
  
  const manifest = {
    version: '1.0.0',
    models: {}
  };
  
  for (const model of models) {
    console.log(`Processing ${model.id}...`);
    
    try {
      // Get the main model files
      const files = [
        'model-00000-of-00001.safetensors',
        'mlc-chat-config.json',
        'tokenizer.json',
        'tokenizer_config.json'
      ];
      
      let totalSize = 0;
      const fileHashes = {};
      
      for (const file of files) {
        try {
          const url = model.baseUrl + file;
          console.log(`  Fetching ${file}...`);
          const result = await getFileHash(url);
          fileHashes[file] = result.hash;
          totalSize += result.size;
          console.log(`    ✓ ${file} (${(result.size / 1024 / 1024).toFixed(1)}MB)`);
        } catch (error) {
          console.log(`    ⚠ ${file}: ${error.message}`);
        }
      }
      
      manifest.models[model.id] = {
        sha256: fileHashes['model-00000-of-00001.safetensors'] || 'sha256-unknown',
        size: totalSize,
        urls: [model.baseUrl]
      };
      
      console.log(`✓ ${model.id}: Total ${(totalSize / 1024 / 1024).toFixed(1)}MB\n`);
    } catch (error) {
      console.error(`✗ Failed to process ${model.id}:`, error.message);
    }
  }
  
  // Write manifest
  const manifestPath = './public/models.manifest.json';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Manifest written to ${manifestPath}`);
}

// Note: This script won't work from the browser due to CORS
// The hashes need to be generated server-side or manually
console.log(`
Note: This script needs to be run in a Node.js environment with internet access.
For now, we'll use placeholder hashes in the manifest.

To get real hashes:
1. Run this script with Node.js: node scripts/generate-model-manifest.js
2. Or manually download files and use: sha256sum filename
3. Update public/models.manifest.json with the real hashes
`);
