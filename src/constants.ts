/**
 * Application-wide constants
 */

// Service Worker timeouts
export const SW_ACTIVATION_TIMEOUT = 30000; // 30 seconds
export const SW_CONTROLLER_CLAIM_TIMEOUT = 5000; // 5 seconds

// LLM Engine timeouts
export const LLM_ENGINE_INIT_TIMEOUT = 600000; // 10 minutes
export const LLM_ABSOLUTE_TIMEOUT = 900000; // 15 minutes
export const LLM_INITIAL_PROGRESS_TIMEOUT = 30000; // 30 seconds

// Python runtime
export const PYTHON_CLEANUP_DELAY = 100; // milliseconds

// VFS pagination
export const VFS_PAGE_SIZE = 20;

// LLM generation
export const LLM_GENERATION_DELAY = 250; // milliseconds

// Model detection thresholds
export const MODEL_VRAM_THRESHOLDS = {
  SMALL_MODEL: 800, // MB
  MEDIUM_MODEL: 2000, // MB
  HIGH_MEMORY_THRESHOLD: 8, // GB
  MEDIUM_MEMORY_THRESHOLD: 4, // GB
  HIGH_BUFFER_SIZE: 1024, // MB
  MEDIUM_BUFFER_SIZE: 512, // MB
} as const;

// Logging
export const LOG_MAX_ENTRIES = 200; // Maximum log entries to keep in DOM

// UI timeouts
export const UI_BUTTON_RESET_DELAY = 2000; // milliseconds for button text reset
