import { execFileSync } from "node:child_process";
import {
  pathExists,
  type IntegrationStatus,
} from "./shared.js";
import type { IntegrationAdapter, IntegrationCapabilities, IntegrationDiagnostic } from "./index.js";

// Codex MCP entry shape from `codex mcp list --json`
interface CodexMcpEntry {
  name: string;
  enabled: boolean;
  transport: {
    type: string;
    command: string;
    args: string[];
  };
}

const CAPABILITIES: IntegrationCapabilities = {
  slashCommands:    false,  // Codex uses a different command system
  mcpRegistration:  true,
  promptTemplates:  true,
};

function detectCodexBinary(): boolean {
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", ["codex"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function getCodexMcpEntry(): CodexMcpEntry | null | "error" {
  try {
    const output = execFileSync("codex", ["mcp", "list", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const servers = JSON.parse(output) as CodexMcpEntry[];
    return servers.find(s => s.name === "planui") ?? null;
  } catch {
    return "error";
  }
}

async function validateRegistration(serverPath: string): Promise<void> {
  const entry = getCodexMcpEntry();

  if (entry === "error") {
    throw new Error(
      `Could not read Codex MCP registration after install.\n` +
      `Run: codex mcp list   to verify, then retry if missing.`
    );
  }

  if (entry === null) {
    throw new Error(
      `Registration appeared to succeed but planui entry was not found in Codex MCP config.\n` +
      `Run: codex mcp list   to verify, then retry.`
    );
  }

  const cmd = entry.transport.command;
  if (!(await pathExists(cmd))) {
    throw new Error(
      `Registration recorded command path does not exist: ${cmd}\n` +
      `This may indicate a PATH mismatch. Re-run: planui setup codex`
    );
  }

  const registeredServerPath = entry.transport.args[0] ?? "";
  if (!registeredServerPath || !(await pathExists(registeredServerPath))) {
    throw new Error(
      `Registration recorded server path does not exist: ${registeredServerPath || "(empty)"}\n` +
      `Expected: ${serverPath}\n` +
      `Re-run: planui setup codex`
    );
  }
}

export const CodexAdapter: IntegrationAdapter = {
  name: "codex",
  displayName: "Codex CLI",
  capabilities: CAPABILITIES,

  detect(): boolean {
    return detectCodexBinary();
  },

  async status(): Promise<IntegrationStatus> {
    if (!detectCodexBinary()) return "not-installed";
    const entry = getCodexMcpEntry();
    if (entry === "error") return "not-registered"; // can't determine, assume not registered
    if (entry === null) return "not-registered";
    const serverExists = await pathExists(entry.transport.args[0] ?? "");
    const cmdExists    = await pathExists(entry.transport.command ?? "");
    if (!serverExists || !cmdExists) return "broken";
    return "registered";
  },

  async diagnose(): Promise<IntegrationDiagnostic> {
    if (!detectCodexBinary()) {
      return { name: CodexAdapter.name, displayName: CodexAdapter.displayName, status: "not-installed" };
    }
    const entry = getCodexMcpEntry();
    if (entry === "error" || entry === null) {
      return { name: CodexAdapter.name, displayName: CodexAdapter.displayName, status: "not-registered" };
    }
    const cmdPath    = entry.transport.command ?? "";
    const serverPath = entry.transport.args[0] ?? "";
    if (!cmdPath || !(await pathExists(cmdPath))) {
      return {
        name: CodexAdapter.name, displayName: CodexAdapter.displayName,
        status: "broken",
        detail: `registered command path not found: ${cmdPath || "(empty)"}`,
      };
    }
    if (!serverPath || !(await pathExists(serverPath))) {
      return {
        name: CodexAdapter.name, displayName: CodexAdapter.displayName,
        status: "broken",
        detail: `registered server path not found: ${serverPath || "(empty)"}`,
      };
    }
    return { name: CodexAdapter.name, displayName: CodexAdapter.displayName, status: "registered" };
  },

  async register(serverPath: string): Promise<void> {
    if (!detectCodexBinary()) {
      throw new Error(
        `Codex CLI not found in PATH.\n` +
        `Install it first: https://github.com/openai/codex`
      );
    }

    // codex mcp add <name> -- <command> [args...]
    execFileSync(
      "codex",
      ["mcp", "add", "planui", "--", process.execPath, serverPath],
      { stdio: "inherit" }
    );

    // Validate the registration actually landed before reporting success
    await validateRegistration(serverPath);
  },

  async remove(): Promise<void> {
    if (!detectCodexBinary()) return;
    try {
      execFileSync("codex", ["mcp", "remove", "planui"], { stdio: "ignore" });
    } catch { /* ignore if not registered */ }
  },

  // Codex has no slash command system; intentional no-op
  async installSlashCommand(): Promise<void> {
    return;
  },

  promptTemplate(): string {
    return `
Use planui before starting any multi-step coding task.

Before writing code:
  1. Think through the implementation approach
  2. Call render_plan() to open an interactive plan in the browser
  3. Structure the plan with checkpoints for human decisions:

     ## Summary         — what and why
     ## Open Questions  — key decisions the human must answer
                          (renders as inline answer fields)
     ## Steps           — numbered implementation steps
                          use "(depends on N)" to show dependencies
     ## Risks           — potential issues tagged [high] / [med] / [low]
     ## Files Touched   — files that will change

  4. Wait for the human to review and return a planresponse block
     before writing any code

The planresponse block:
  \`\`\`planresponse <planId>
  action: approve | modify | revise
  questions:
    q1: <answer>
  steps:
    Step 3 [remove]: not needed
    Step 5 [feedback]: use the async path [high]
  \`\`\`

Activation phrases:
  "use planui"
  "render a plan with planui first"
  "show me the plan in planui before coding"
`.trim();
  },
};
