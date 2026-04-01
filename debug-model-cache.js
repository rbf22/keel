// Run this in the browser console to debug model caching
(async () => {
  console.log("=== WebLLM Model Cache Debug ===");
  
  // List all caches
  const cacheNames = await caches.keys();
  const webLLmCacheNames = cacheNames.filter(name => name.startsWith('web-llm-'));
  
  console.log("All cache names:", cacheNames);
  console.log("WebLLM cache names:", webLLmCacheNames);
  
  // Check each WebLLM cache
  for (const cacheName of webLLmCacheNames) {
    console.log(`\n--- Cache: ${cacheName} ---`);
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    console.log("Keys in cache:", keys.map(k => k.url));
    
    let totalSize = 0;
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
    console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  }
  
  // Clear all WebLLM caches (uncomment to clear)
  /*
  console.log("\n=== Clearing all WebLLM caches ===");
  for (const cacheName of webLLmCacheNames) {
    await caches.delete(cacheName);
    console.log(`Cleared: ${cacheName}`);
  }
  console.log("All caches cleared!");
  */
})();
