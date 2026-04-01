import { skillsEngine } from "./skills/engine";

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

export const TOOLS: Record<string, Tool> = {
  "vfs_write": {
    name: "vfs_write",
    description: "Write a file to the Keel Virtual Filesystem (keel://).",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "The path starting with keel://resources/, keel://agent/, etc." },
        content: { type: "string", description: "Full content of the file." },
        l0: { type: "string", description: "Abstract (~100 tokens summary)." },
        l1: { type: "string", description: "Overview (~2000 tokens summary)." }
      },
      required: ["path", "content"]
    }
  },
  "vfs_read": {
    name: "vfs_read",
    description: "Read a file from the Keel Virtual Filesystem.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "The path starting with keel://" },
        level: { type: "string", enum: ["L0", "L1", "L2"], description: "Detail level: L0 (Abstract), L1 (Overview), L2 (Full)." }
      },
      required: ["path"]
    }
  },
  "vfs_ls": {
    name: "vfs_ls",
    description: "List files in a directory in the Keel Virtual Filesystem.",
    parameters: {
      type: "object",
      properties: {
        prefix: { type: "string", description: "The path prefix to list (e.g., keel://resources/)" }
      },
      required: ["prefix"]
    }
  },
  "memory_update": {
    name: "memory_update",
    description: "Add or update a piece of long-term memory.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["profile", "preferences", "entities", "events", "cases", "patterns"] },
        content: { type: "string", description: "The memory content." },
        tags: { type: "array", items: { type: "string" } }
      },
      required: ["category", "content"]
    }
  },
  "web_fetch": {
    name: "web_fetch",
    description: "Fetch the content of a website (simulated in Keel via internal proxy or fetch).",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to fetch." }
      },
      required: ["url"]
    }
  },
  "execute_python": {
    name: "execute_python",
    description: "Execute Python code in the sandbox. Use for data analysis, math, and visualization.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "The Python code to run." }
      },
      required: ["code"]
    }
  }
};

export function getSkillsContext(): string {
  const toolsPrompt = Object.values(TOOLS).map(t => {
    return `TOOL: ${t.name}\nDescription: ${t.description}\nParameters: ${JSON.stringify(t.parameters)}`;
  }).join("\n\n");

  const skillsPrompt = skillsEngine.getSkillsDescription();

  return `
### AVAILABLE TOOLS
To use a tool, respond with:
CALL: tool_name
ARGUMENTS: { "arg1": "val1" }

Tools:
${toolsPrompt}

### AVAILABLE SKILLS
Skills are automatically selected and executed based on task requirements.

${skillsPrompt}

Use the appropriate skill for your task or call tools directly when needed.
`;
}
