import { loadPyodide, type PyodideInterface } from "pyodide";

let pyodide: PyodideInterface;

async function init() {
  try {
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.0/full/",
    });

    await pyodide.loadPackage(["pandas", "numpy"]);

    // Define helper functions in Python
    await pyodide.runPythonAsync(`
import json
from js import postMessage

def display_table(df):
    # Convert dataframe to JSON records
    try:
        if hasattr(df, 'to_json'):
            data = df.to_json(orient="records")
            postMessage(json.dumps({"type": "table", "data": json.loads(data)}))
        else:
            postMessage(json.dumps({"type": "log", "message": "display_table expected a pandas DataFrame"}))
    except Exception as e:
        postMessage(json.dumps({"type": "error", "message": f"Error displaying table: {str(e)}"}))

def display_chart(spec):
    # spec is a dictionary (Vega-Lite)
    postMessage(json.dumps({"type": "chart", "spec": spec.to_py() if hasattr(spec, 'to_py') else spec}))

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
builtins.display_table = display_table
builtins.display_chart = display_chart
builtins.download_file = download_file
builtins.log = log
    `);

    self.postMessage(JSON.stringify({ type: "ready" }));
  } catch (error: any) {
    self.postMessage(JSON.stringify({ type: "error", message: `Failed to initialize Pyodide: ${error.message}` }));
  }
}

self.onmessage = async (event) => {
  const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
  const { type, code } = data;

  if (type === "execute") {
    if (!pyodide) {
      self.postMessage(JSON.stringify({ type: "error", message: "Pyodide not initialized" }));
      return;
    }

    try {
      await pyodide.runPythonAsync(code);
      self.postMessage(JSON.stringify({ type: "complete" }));
    } catch (error: any) {
      self.postMessage(JSON.stringify({ type: "error", message: error.message }));
    }
  }
};

init();
