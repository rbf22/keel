# Keel: Local-First Agentic Framework

Keel is a browser-only agent framework designed to transform an iPad into a self-contained AI workstation using WebGPU and WebLLM.

## Quick Start Example

This repository contains a working example of a "PadAgent Core" PWA. It runs a local LLM (SmolLM2-135M) entirely in your browser.

### Features in this Example
- **WebGPU Inference**: Runs models locally on M-series iPads (or any WebGPU-capable browser).
- **PWA Support**: Installable on iPadOS via Safari's "Add to Home Screen".
- **Real-time Stats**: Track tokens/sec and decoding performance.
- **Offline Capable**: Once initialized, the model is cached in IndexedDB.

### How to Run Locally
1. Clone the repository.
2. Install dependencies: `npm install`
3. Start the dev server: `npm run dev`
4. Open the provided URL in a WebGPU-enabled browser (e.g., Chrome Desktop or Safari on iPadOS 17.4+).

### How to Host on GitHub Pages
1. Push this code to your GitHub repository.
2. The included GitHub Action (`.github/workflows/deploy.yml`) will automatically build and deploy the app.
3. In your GitHub Repository Settings, go to **Pages** and ensure the source is set to **GitHub Actions**.

### Testing on iPad
1. **Prerequisites**: iPad with M1 chip or newer is highly recommended. Ensure you are on iPadOS 17.4 or later.
2. **Access**: Navigate to your hosted GitHub Pages URL in Safari.
3. **Install**: Tap the **Share** button and select **"Add to Home Screen"**.
4. **Launch**: Open "Keel" from your Home Screen.
5. **Initialize**: Tap "Initialize Local LLM". The first run will download ~135MB of model weights.
6. **Performance Test**: Once ready, send a prompt like "Explain quantum physics in one sentence" and watch the "Stats" section for performance metrics.

## Development Base
This is a base you can build on. You can extend `src/llm.ts` to support larger models or implement the "Agentic Orchestration" mentioned in the original vision.
