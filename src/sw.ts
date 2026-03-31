/// <reference lib="webworker" />
import { ServiceWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

declare const self: ServiceWorkerGlobalScope;

let handler: ServiceWorkerMLCEngineHandler | undefined;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
  console.info("Service Worker: Activated and Claimed");
});

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (!handler) {
    handler = new ServiceWorkerMLCEngineHandler();
    console.info("Service Worker: Web-LLM Engine Activated");
  }
  handler.onmessage(event);
});
