import { loadPyodide, type PyodideInterface } from "pyodide";

let pyodide: PyodideInterface;

async function init() {
  try {
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/",
    });

    await pyodide.loadPackage(["pandas", "numpy", "matplotlib", "seaborn"]);

    // Define helper functions in Python
    await pyodide.runPythonAsync(`
import json
import base64
from js import postMessage

def display_table(df):
    """
    Display a pandas DataFrame as a table in the output.
    """
    try:
        if hasattr(df, 'to_json'):
            data = df.to_json(orient="records")
            postMessage(json.dumps({"type": "table", "data": json.loads(data)}))
        else:
            postMessage(json.dumps({"type": "log", "message": f"display_table expected a pandas DataFrame, got {type(df).__name__}"}))
    except Exception as e:
        postMessage(json.dumps({"type": "error", "message": f"Error displaying table: {str(e)}"}))

def display_chart(figure=None):
    """
    Display a matplotlib figure or the current figure.
    """
    import matplotlib.pyplot as plt
    import io
    
    try:
        if figure is None:
            figure = plt.gcf()
        
        buf = io.BytesIO()
        figure.savefig(buf, format='png', bbox_inches='tight')
        buf.seek(0)
        img_str = base64.b64encode(buf.read()).decode('utf-8')
        postMessage(json.dumps({"type": "chart", "data": f"data:image/png;base64,{img_str}"}))
        plt.close(figure)
    except Exception as e:
        postMessage(json.dumps({"type": "error", "message": f"Error displaying chart: {str(e)}"}))

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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    self.postMessage(JSON.stringify({ type: "error", message: `Failed to initialize Pyodide: ${errorMessage}` }));
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      self.postMessage(JSON.stringify({ type: "error", message: errorMessage }));
    }
  }
};

init();
