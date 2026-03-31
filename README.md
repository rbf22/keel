# Keel: Local-First Agentic Framework

Keel is a browser-only agent framework designed to transform an iPad into a self-contained AI workstation using WebGPU and WebLLM.

## Quick Start Example

This repository contains a working example of a "PadAgent Core" PWA. It runs a local LLM (SmolLM2-360M) entirely in your browser with agentic orchestration and Python execution.

### Features in this Example
- **WebGPU Inference**: Runs models locally on M-series iPads (or any WebGPU-capable browser) using WebLLM.
- **Python Runtime**: Integrated Pyodide-based execution environment for data analysis and calculations.
- **Data Visualization**: Built-in support for rendering tables (Pandas) and charts (Matplotlib) directly in the chat.
- **Agentic Orchestration**: Multi-agent framework with Manager, Researcher, Reviewer, and Observer personas.
- **PWA Support**: Installable on iPadOS via Safari's "Add to Home Screen".
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
5. **Initialize**: Tap "Initialize Local LLM". The first run will download ~400MB of model weights.
6. **Performance Test**: Once ready, try a complex request like "Analyze the last 5 logs and create a bar chart of log levels" to see agents and Python in action.

## Development Base
This is a base you can build on. You can extend `src/llm.ts` to support larger models or implement the "Agentic Orchestration" mentioned in the original vision.
