/// <reference lib="webworker" />
import { ServiceWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

let handler: ServiceWorkerMLCEngineHandler;

self.addEventListener("install", () => {
  console.info("Service Worker: Install event");
  (self as any).skipWaiting();
});

self.addEventListener("activate", function (event) {
  handler = new ServiceWorkerMLCEngineHandler();
  console.log("Service Worker is ready");
  event.waitUntil((self as any).clients.claim());
  console.info("Service Worker: Activated and Claimed");
});
