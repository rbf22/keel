# keel
keel is a simple browser only agent framework.

This project aims to create a Local-First Agentic Framework specifically for iPadOS, utilizing the browser as a complete infrastructure to bypass native app restrictions. By combining Progressive Web App (PWA) technology with WebLLM, the system will function as an autonomous "Control Plane" that coordinates tasks, manages memory, and executes logic entirely on-device, calling external APIs only for high-compute reasoning or live data.
Product Description: "PadAgent Core"
PadAgent Core is a browser-based, installable framework that transforms an iPad into a self-contained AI workstation. Unlike cloud-dependent agents, PadAgent Core prioritizes privacy and offline availability by running its "heartbeat" logic locally. It allows developers and power users to build, test, and deploy multi-step agentic workflows without needing a laptop or a native IDE.
Key Features:
Zero-Install PWA: Installs via Safari’s "Add to Home Screen" to provide a fullscreen, app-like experience with offline access.
On-Device "Thinking": Integrated WebLLM support for running models like Phi-3 or Llama 3 locally via WebGPU, enabling offline intent recognition and planning.
Hybrid Execution: A "router" that automatically toggles between local SLMs (Small Language Models) for simple tasks and high-power cloud APIs (e.g., GPT-4o, Claude 3.5) for complex reasoning.
Local State Engine: Uses the Origin Private File System (OPFS) to store agent memory, vector embeddings, and configuration files securely on the iPad.
Agentic Orchestration: A node-based or code-first workflow engine to define "Perceive-Reason-Act" loops for autonomous task completion.
Development Requirements
1. Core Infrastructure (The PWA)
Service Worker: Must implement a caching strategy (e.g., Cache-First) to ensure the framework and core UI load without an internet connection.
Web App Manifest: Required for iPadOS "installability," including a 512x512 icon, standalone display mode, and a defined start_url.
HTTPS Hosting: Mandatory for all PWA features and WebGPU access.
2. Local Intelligence (WebLLM Integration)
WebGPU Compatibility Check: Implement a script to verify WebGPU support on the user's iPad (M-series chips highly recommended).
Model Management: A downloader UI to fetch and store quantized model weights (WASM/WebGPU format) in the browser's persistent cache.
In-Browser Inference Engine: Integration of the WebLLM SDK to handle OpenAI-compatible local chat completions.
3. Agentic Logic & Tooling
Task Planner: A JavaScript-based orchestrator that breaks down user requests into multi-step execution plans.
State & Memory Management: An IndexedDB or SQLite-WASM implementation for persistent long-term memory across sessions.
Tool Interface: A standardized API for the agent to call external functions (e.g., Fetch API for web data, local JS functions for calculations).
4. iPad-Specific Optimization
Responsive UI: Use CSS Grid/Flexbox to ensure the interface adapts to iPad multitasking modes (Split View and Slide Over).
Touch-First Interaction: Design all workflow nodes and buttons for high-precision touch/Apple Pencil input.
Resource Throttling: Logic to pause heavy local inference when the browser tab is backgrounded to prevent iPadOS from terminating the process.

