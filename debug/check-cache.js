// Run this in browser console to investigate cache issues
// This will show detailed info about what's actually stored

async function investigateCache() {
  console.log('=== Investigating WebLLM Cache ===\n');
  
  const cacheNames = await caches.keys();
  const webLLmCacheNames = cacheNames.filter(name => name.startsWith('web-llm-'));
  
  console.log(`Found ${webLLmCacheNames.length} WebLLM cache(s):`);
  console.log(webLLmCacheNames);
  
  for (const cacheName of webLLmCacheNames) {
    console.log(`\n--- Cache: ${cacheName} ---`);
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    console.log(`Entries: ${keys.length}`);
    
    let totalSize = 0;
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
        
        console.log(`  • ${request.url}`);
        console.log(`    Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`    Type: ${blob.type || 'unknown'}`);
        console.log(`    Status: ${response.status} ${response.statusText}`);
        
        // Check if it's a valid response
        if (blob.size === 0) {
          console.log('    ⚠️ EMPTY FILE!');
        } else if (blob.size < 1024 * 1024) {
          console.log('    ⚠️ Very small - likely corrupted!');
        }
      }
    }
    
    console.log(`\nTotal size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    if (totalSize === 0) {
      console.log('❌ This cache is completely empty!');
    } else if (totalSize < 1024 * 1024) {
      console.log('❌ This cache is corrupted (too small)!');
    } else {
      console.log('✅ This cache looks valid');
    }
  }
  
  // Check IndexedDB as well
  console.log('\n=== Checking IndexedDB ===');
  const databases = await indexedDB.databases();
  const llmDatabases = databases.filter(db => db.name && db.name.includes('mlc'));
  
  console.log(`Found ${llmDatabases.length} LLM databases:`);
  for (const db of llmDatabases) {
    console.log(`  • ${db.name} (version ${db.version})`);
  }
}

// Function to clear a specific corrupted cache
async function clearCorruptedCache(modelId) {
  const cacheKey = `web-llm-${modelId}`;
  const deleted = await caches.delete(cacheKey);
  console.log(`${deleted ? '✅' : '❌'} Cache ${cacheKey} ${deleted ? 'deleted' : 'not found'}`);
  
  // Also try to delete related IndexedDB
  const databases = await indexedDB.databases();
  const llmDatabases = databases.filter(db => db.name && db.name.includes(modelId));
  
  for (const db of llmDatabases) {
    await indexedDB.deleteDatabase(db.name);
    console.log(`✅ Deleted IndexedDB: ${db.name}`);
  }
}

// Auto-detect and clear all corrupted caches
async function clearAllCorrupted() {
  const cacheNames = await caches.keys();
  const webLLmCacheNames = cacheNames.filter(name => name.startsWith('web-llm-'));
  
  let cleared = 0;
  
  for (const cacheName of webLLmCacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    let totalSize = 0;
    
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
    
    if (totalSize === 0 || totalSize < 1024 * 1024) {
      console.log(`Clearing corrupted cache: ${cacheName} (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
      await caches.delete(cacheName);
      cleared++;
    }
  }
  
  console.log(`\nCleared ${cleared} corrupted cache(s)`);
}

console.log('Cache investigation utilities loaded!');
console.log('Use investigateCache() to see details');
console.log('Use clearCorruptedCache(modelId) to clear specific model');
console.log('Use clearAllCorrupted() to clear all corrupted caches');

// Auto-run investigation
investigateCache();
