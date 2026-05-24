import { promises as fs } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import {
  resolveServerPath,
  resolveCommandTemplatePath,
  readJsonOrNull,
  writeJsonAtomic,
  pathExists,
  type IntegrationStatus,
  type McpEntry,
} from "./shared.js";
import type { IntegrationAdapter, IntegrationCapabilities, IntegrationDiagnostic } from "./index.js";

const HOME         = os.homedir();
const CLAUDE_JSON  = path.join(HOME, ".claude.json");
const COMMANDS_DIR = path.join(HOME, ".claude", "commands");
const COMMAND_FILE = path.join(COMMANDS_DIR, "planui.md");

const CAPABILITIES: IntegrationCapabilities = {
  slashCommands:    true,
  mcpRegistration:  true,
  promptTemplates:  true,
};

function buildMcpEntry(serverPath: string): McpEntry {
  return { type: "stdio", command: process.execPath, args: [serverPath], env: {} };
}

function entryMatchesCurrent(entry: McpEntry, serverPath: string): boolean {
  return entry.command === process.execPath &&
         Array.isArray(entry.args) &&
         entry.args[0] === serverPath;
}

async function readPlanUiEntry(): Promise<McpEntry | null | "malformed"> {
  const cfg = await readJsonOrNull(CLAUDE_JSON);
  if (!cfg) return null;
  const servers = (cfg.mcpServers ?? {}) as Record<string, unknown>;
  const entry = servers["planui"];
  if (!entry) return null;
  if (typeof entry !== "object" || !("command" in entry) || !("args" in entry)) {
    return "malformed";
  }
  return entry as McpEntry;
}

export const ClaudeAdapter: IntegrationAdapter = {
  name: "claude",
  displayName: "Claude Code",
  capabilities: CAPABILITIES,

  detect(): boolean {
    try {
      execFileSync("claude", ["--version"], { stdio: "ignore" });
      return true;
    } catch {
      // No claude binary; check for config file presence as a fallback
      try {
        const stat = require("node:fs").statSync(CLAUDE_JSON);
        return stat.isFile();
      } catch {
        return false;
      }
    }
  },

  async status(): Promise<IntegrationStatus> {
    const entry = await readPlanUiEntry();
    if (entry === null) {
      const installed = ClaudeAdapter.detect();
      return installed ? "not-registered" : "not-installed";
    }
    if (entry === "malformed") return "broken";
    const serverExists = await pathExists(entry.args[0]);
    if (!serverExists) return "broken";
    return "registered";
  },

  async diagnose(): Promise<IntegrationDiagnostic> {
    const entry = await readPlanUiEntry();
    if (entry === null) {
      const installed = ClaudeAdapter.detect();
      return {
        name:        ClaudeAdapter.name,
        displayName: ClaudeAdapter.displayName,
        status:      installed ? "not-registered" : "not-installed",
      };
    }
    if (entry === "malformed") {
      return {
        name:        ClaudeAdapter.name,
        displayName: ClaudeAdapter.displayName,
        status:      "broken",
        detail:      `mcpServers.planui in ${CLAUDE_JSON} is malformed`,
      };
    }
    const serverPath = entry.args[0] ?? "";
    if (!serverPath || !(await pathExists(serverPath))) {
      return {
        name:        ClaudeAdapter.name,
        displayName: ClaudeAdapter.displayName,
        status:      "broken",
        detail:      `registered server path not found: ${serverPath || "(empty)"}`,
      };
    }
    return {
      name:        ClaudeAdapter.name,
      displayName: ClaudeAdapter.displayName,
      status:      "registered",
    };
  },

  async register(serverPath: string): Promise<void> {
    const existing = await readJsonOrNull(CLAUDE_JSON);
    const servers  = ((existing ?? {}) as Record<string, Record<string, unknown>>).mcpServers ?? {};
    const current  = servers["planui"] as McpEntry | undefined;

    if (current && entryMatchesCurrent(current, serverPath)) return; // already correct

    // Try official claude CLI first
    try {
      execFileSync(
        "claude",
        ["mcp", "add", "planui", "-s", "user", "--", process.execPath, serverPath],
        { stdio: "ignore" }
      );
      return;
    } catch { /* fall through to direct edit */ }

    const cfg = existing ?? {};
    const mcpServers = ((cfg as Record<string, unknown>).mcpServers ?? {}) as Record<string, unknown>;
    mcpServers["planui"] = buildMcpEntry(serverPath);
    (cfg as Record<string, unknown>).mcpServers = mcpServers;
    await writeJsonAtomic(CLAUDE_JSON, cfg);
  },

  async remove(): Promise<void> {
    const cfg = await readJsonOrNull(CLAUDE_JSON);
    if (!cfg) return;
    const servers = (cfg.mcpServers ?? {}) as Record<string, unknown>;
    if (!servers["planui"]) return;
    delete servers["planui"];
    await writeJsonAtomic(CLAUDE_JSON, cfg);
  },

  async installSlashCommand(): Promise<"already" | "installed" | "updated"> {
    const src           = resolveCommandTemplatePath();
    const sourceContent = await fs.readFile(src, "utf8");
    await fs.mkdir(COMMANDS_DIR, { recursive: true });

    let existing: string | null = null;
    try { existing = await fs.readFile(COMMAND_FILE, "utf8"); } catch { /* not found */ }

    if (existing === sourceContent) return "already";

    const tmp = `${COMMAND_FILE}.planui.tmp`;
    await fs.writeFile(tmp, sourceContent, "utf8");
    await fs.rename(tmp, COMMAND_FILE);
    return existing === null ? "installed" : "updated";
  },

  promptTemplate(): string {
    return `
Use planui to create a structured implementation plan before making changes.

When given any non-trivial coding task:
  1. Explore the relevant codebase (read-only)
  2. Think through the approach
  3. Call render_plan() with a markdown plan that includes:

     ## Summary         — what and why, 1–3 sentences
     ## Open Questions  — decisions the human must make before work begins
                          (each bullet becomes an inline answer field;
                           the Approve button is disabled until all are answered)
     ## Steps           — numbered implementation steps
                          mark dependencies: "Step title (depends on 2, 3)"
     ## Risks           — potential issues with [high] / [med] / [low] severity
     ## Files Touched   — paths that will change (grouped by directory in the UI)

  4. Tell the user: "I've opened the plan in your browser. Review each step
     (approve or strike), answer any questions, then click Approve plan or
     Copy feedback and paste it back here."

After the user responds, look for a \`planresponse\` block:
  \`\`\`planresponse <planId>
  action: approve | modify | revise
  questions:
    q1: <answer>
  steps:
    Step 3 [remove]: reason
    Step 7 [feedback]: use v2 API [high]
  \`\`\`

Activation phrases:
  "use planui"
  "open planui for this"
  "plan with planui before coding"
  "render this as a planui plan"
`.trim();
  },
};

// Re-export resolveServerPath so setup.ts doesn't need to import shared directly
export { resolveServerPath };
