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
      handler = new ServiceWorkerMLCEngineHandler();
      console.log("Service Worker handler initialized");
      return (self as any).clients.claim();
    }).then(() => {
      console.info("Service Worker: Activated and Claimed");
    })
  );
});

// Add message listener for debugging with proper cleanup
self.addEventListener("message", (event) => {
  console.log("Service Worker received message:", event.data);
  if (handler && (handler as any).onMessage) {
    try {
      (handler as any).onMessage(event);
    } catch (error) {
      console.error("Service Worker message handler error:", error);
    }
  }
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
