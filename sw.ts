/// <reference lib="webworker" />
import { ServiceWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

// Inject manifest for PWA
(self as any).__WB_MANIFEST = [];

let handler: ServiceWorkerMLCEngineHandler | null = null;

// Cleanup function to prevent memory leaks
function cleanup() {
  if (handler) {
    // Clean up any resources held by the handler
    handler = null;
  }
}

self.addEventListener("install", () => {
  console.info("Service Worker: Install event");
  (self as any).skipWaiting();
});

self.addEventListener("activate", function (event) {
  console.log("Service Worker activating");
  
  // Initialize handler without clearing caches
  (event as any).waitUntil(
    Promise.resolve().then(() => {
      console.log("Service Worker: About to initialize ServiceWorkerMLCEngineHandler");
      handler = new ServiceWorkerMLCEngineHandler();
      console.log("Service Worker: Handler created successfully");
      console.log("Service Worker handler initialized");
      console.log("Service Worker: Handler type:", typeof handler);
      console.log("Service Worker: Handler constructor name:", handler.constructor.name);
      console.log("Service Worker: Handler methods:", Object.getOwnPropertyNames(handler));
      console.log("Service Worker: Handler prototype methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(handler)));
      return (self as any).clients.claim();
    }).then(() => {
      console.info("Service Worker: Activated and Claimed");
      // Add a heartbeat to confirm SW is running
      setInterval(() => {
        console.log("Service Worker heartbeat - still running");
      }, 10000);
    }).catch(error => {
      console.error("Service Worker: Failed to initialize handler:", error);
    })
  );
});

// Add message listener for debugging with proper cleanup
self.addEventListener("message", (event) => {
  const receiveTime = Date.now();
  console.log("Service Worker received message:", {
    data: event.data,
    dataType: typeof event.data,
    dataKeys: event.data ? Object.keys(event.data) : null,
    origin: event.origin,
    timestamp: new Date().toISOString(),
    receiveTime
  });
  
  // Log specific message types
  if (event.data?.kind) {
    console.log(`Service Worker: Message kind = ${event.data.kind}`, {
      uuid: event.data.uuid,
      hasContent: !!event.data.content,
      contentType: typeof event.data.content
    });
    
    if (event.data.kind === 'init') {
      console.log("Service Worker: INIT message details", {
        modelId: event.data.content?.model_id,
        hasAppConfig: !!event.data.content?.app_config,
        appConfigModelCount: event.data.content?.app_config?.model_list?.length,
        hasInitProgressCallback: !!event.data.content?.initProgressCallback
      });
    }
  }
  
  if (handler) {
    console.log("Service Worker: Handler exists", {
      handlerType: typeof handler,
      handlerExists: !!handler,
      timestamp: Date.now()
    });
    
    // Check if handler itself is callable (some implementations use the handler as the listener)
    if ((handler as any).handleEvent || typeof (handler as any) === 'function') {
      console.log("Service Worker: Handler is callable, invoking directly", {
        timestamp: Date.now()
      });
      try {
        const handlerStartTime = performance.now();
        (handler as any)(event);
        const handlerEndTime = performance.now();
        console.log("Service Worker: Handler invoked successfully", {
          duration: handlerEndTime - handlerStartTime,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error("Service Worker: Handler invocation error:", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: Date.now()
        });
      }
    } else if ((handler as any).onMessage) {
      console.log("Service Worker: Handler has onMessage method, calling it", {
        timestamp: Date.now()
      });
      try {
        const handlerStartTime = performance.now();
        (handler as any).onMessage(event);
        const handlerEndTime = performance.now();
        console.log("Service Worker: handler.onMessage completed successfully", {
          duration: handlerEndTime - handlerStartTime,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error("Service Worker: message handler error:", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: Date.now()
        });
      }
    } else {
      console.error("Service Worker: Handler is neither callable nor has onMessage method!", {
        handlerType: typeof handler,
        handlerProperties: Object.getOwnPropertyNames(handler),
        handlerPrototype: Object.getOwnPropertyNames(Object.getPrototypeOf(handler)),
        timestamp: Date.now()
      });
    }
  } else {
    console.error("Service Worker: No handler available!", {
      timestamp: Date.now()
    });
  }
  
  // Log message processing completion
  console.log("Service Worker: Message processing completed", {
    totalProcessingTime: Date.now() - receiveTime,
    timestamp: Date.now()
  });
});

// Add error handling
self.addEventListener("error", (event) => {
  console.error("Service Worker error:", event.error);
});

self.addEventListener("unhandledrejection", (event) => {
  console.error("Service Worker unhandled rejection:", event.reason);
});

// Cleanup on termination
self.addEventListener("beforeunload", () => {
  cleanup();
});

// Export cleanup for external use if needed
export { cleanup };
