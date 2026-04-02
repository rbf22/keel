// Debug script to examine IndexedDB databases and their indexes
console.log("=== IndexedDB Debug Script ===");

// Function to examine all databases
async function examineAllDatabases() {
  console.log("\n1. Checking available databases:");
  
  // List all database names
  const databases = await indexedDB.databases();
  console.log("Available databases:", databases);
  
  for (const dbInfo of databases) {
    if (dbInfo.name) {
      await examineDatabase(dbInfo.name);
    }
  }
}

// Function to examine a specific database
function examineDatabase(dbName) {
  console.log(`\n=== Examining database: ${dbName} ===`);
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    
    request.onerror = () => {
      console.error(`Failed to open ${dbName}:`, request.error);
      resolve();
    };
    
    request.onsuccess = () => {
      const db = request.result;
      
      console.log(`Database version: ${db.version}`);
      console.log(`Object stores: ${Array.from(db.objectStoreNames).join(', ')}`);
      
      // Examine each object store
      const promises = [];
      for (const storeName of db.objectStoreNames) {
        promises.push(examineObjectStore(db, storeName));
      }
      
      Promise.all(promises).then(() => {
        db.close();
        resolve();
      });
    };
    
    request.onupgradeneeded = () => {
      console.log(`Database ${dbName} needs upgrade`);
      resolve();
    };
  });
}

// Function to examine an object store and its indexes
async function examineObjectStore(db, storeName) {
  console.log(`\n--- Object Store: ${storeName} ---`);
  
  const transaction = db.transaction([storeName], 'readonly');
  const store = transaction.objectStore(storeName);
  
  // Get all indexes
  console.log("Indexes:");
  for (const indexName of store.indexNames) {
    const index = store.index(indexName);
    console.log(`  - ${indexName} (keyPath: ${index.keyPath}, unique: ${index.unique})`);
  }
  
  // Count records
  const countRequest = store.count();
  await new Promise(resolve => {
    countRequest.onsuccess = () => {
      console.log(`Record count: ${countRequest.result}`);
      resolve();
    };
  });
  
  // Get first few records to see structure
  const getAllRequest = store.getAll();
  await new Promise(resolve => {
    getAllRequest.onsuccess = () => {
      const records = getAllRequest.result;
      console.log(`Sample records (first 3):`);
      records.slice(0, 3).forEach((record, i) => {
        console.log(`  Record ${i + 1}:`, record);
      });
      
      if (records.length > 3) {
        console.log(`  ... and ${records.length - 3} more records`);
      }
      
      resolve();
    };
  });
  
  transaction.commit?.();
}

// Function to check storage usage
async function checkStorageUsage() {
  console.log("\n=== Storage Usage ===");
  
  const nav = navigator;
  if (nav.storage && nav.storage.estimate) {
    const estimate = await nav.storage.estimate();
    console.log("Storage estimate:", {
      usage: estimate.usage,
      quota: estimate.quota,
      usageDetails: estimate.usageDetails,
      quotaDetails: estimate.quotaDetails
    });
    
    if (estimate.usage && estimate.quota) {
      const usagePercent = (estimate.usage / estimate.quota * 100).toFixed(2);
      console.log(`Usage: ${usagePercent}% (${(estimate.usage / 1024 / 1024).toFixed(2)} MB / ${(estimate.quota / 1024 / 1024).toFixed(2)} MB)`);
    }
  } else {
    console.log("Storage estimate not available");
  }
}

// Function to specifically check model storage
async function checkModelStorage() {
  console.log("\n=== Model Storage Specific Check ===");
  
  return new Promise((resolve) => {
    const request = indexedDB.open('KeelModels');
    
    request.onerror = () => {
      console.error("Failed to open KeelModels:", request.error);
      resolve();
    };
    
    request.onsuccess = () => {
      const db = request.result;
      
      if (!db.objectStoreNames.contains('models')) {
        console.log("No 'models' object store found in KeelModels");
        db.close();
        resolve();
        return;
      }
      
      const transaction = db.transaction(['models'], 'readonly');
      const store = transaction.objectStore('models');
      
      // Check all models
      const getAllRequest = store.getAll();
      getAllRequest.onsuccess = () => {
        const models = getAllRequest.result;
        console.log(`Found ${models.length} models in KeelModels:`);
        
        models.forEach((model, i) => {
          console.log(`  Model ${i + 1}:`, {
            modelId: model.modelId,
            size: model.size,
            status: model.status,
            downloadDate: model.downloadDate,
            progress: model.progress
          });
        });
        
        // Calculate total size
        const totalSize = models.reduce((sum, model) => sum + (model.size || 0), 0);
        console.log(`Total model size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
        
        db.close();
        resolve();
      };
      
      getAllRequest.onerror = () => {
        console.error("Failed to get models:", getAllRequest.error);
        db.close();
        resolve();
      };
    };
  });
}

// Run all checks
async function runAllChecks() {
  await checkStorageUsage();
  await examineAllDatabases();
  await checkModelStorage();
}

// Execute the debug script
runAllChecks().then(() => {
  console.log("\n=== Debug script completed ===");
}).catch(error => {
  console.error("Debug script error:", error);
});
