import { loadPyodide, type PyodideInterface } from "pyodide";

let pyodide: PyodideInterface;

interface PyodideFS {
  mkdir(path: string): void;
  writeFile(path: string, data: string | Uint8Array, options?: { encoding?: string; flags?: string }): void;
  analyzePath(path: string): { exists: boolean };
}

async function init() {
  try {
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/",
    });

    await pyodide.loadPackage(["pandas", "numpy"]);

    // Define helper functions in Python
    await pyodide.runPythonAsync(`
import json
from js import postMessage

def download_file(filename, content):
    postMessage(json.dumps({"type": "download", "filename": filename, "content": content}))

def log(message):
    postMessage(json.dumps({"type": "log", "message": str(message)}))

# Redirect stdout and stderr
import sys
import io

class WebOutput:
    def write(self, s):
        if s.strip():
            log(s)
    def flush(self):
        pass

sys.stdout = WebOutput()
sys.stderr = WebOutput()

# Restrict dangerous modules
for mod in ['os', 'subprocess', 'socket', 'multiprocessing']:
    sys.modules[mod] = None

# Inject helpers into global namespace
import builtins
builtins.download_file = download_file
builtins.log = log
    `);

    self.postMessage(JSON.stringify({ type: "ready" }));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    self.postMessage(JSON.stringify({ type: "error", message: `Failed to initialize Pyodide: ${errorMessage}` }));
  }
}

self.onmessage = async (event) => {
  const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
  const { type, code, resources } = data;

  if (type === "execute") {
    if (!pyodide) {
      self.postMessage(JSON.stringify({ type: "error", message: "Pyodide not initialized" }));
      return;
    }

    try {
      // Write resources to VFS if provided (Level 3 disclosure)
      if (resources && typeof resources === 'object') {
        const writeErrors: string[] = [];
        for (const [path, content] of Object.entries(resources)) {
          try {
            // Sanitize path to prevent directory traversal
            if (path.includes('..') || path.startsWith('/')) {
              throw new Error(`Invalid resource path: ${path}`);
            }

            // Ensure parent directories exist
            const parts = path.split('/');
            if (parts.length > 1) {
              let currentPath = '';
              for (let i = 0; i < parts.length - 1; i++) {
                currentPath += (i === 0 ? '' : '/') + parts[i];
                try {
                  // Check if directory exists first to avoid unnecessary catch
                  const fs = pyodide.FS as unknown as PyodideFS;
                  if (fs.analyzePath) {
                    const stat = fs.analyzePath(currentPath);
                    if (!stat.exists) {
                      fs.mkdir(currentPath);
                    }
                  } else {
                    fs.mkdir(currentPath);
                  }
                } catch (e) {
                  // Fallback if mkdir fails (e.g. already exists)
                }
              }
            }
            pyodide.FS.writeFile(path, content);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`Failed to write resource ${path} to VFS:`, msg);
            writeErrors.push(`${path}: ${msg}`);
          }
        }

        if (writeErrors.length > 0) {
          self.postMessage(JSON.stringify({ 
            type: "error", 
            message: `Failed to prepare some resources:\n${writeErrors.join('\n')}` 
          }));
          return;
        }
      }

      await pyodide.runPythonAsync(code);
      self.postMessage(JSON.stringify({ type: "complete" }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      self.postMessage(JSON.stringify({ type: "error", message: errorMessage }));
    }
  }
};

init();
