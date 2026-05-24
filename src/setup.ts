import { promises as fs } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { TOOL_VERSION } from "./extract.js";
import { extractPlan } from "./extract.js";
import { renderToHtml } from "./render.js";
import { savePlan } from "./archive.js";
import { spawn } from "node:child_process";

const HOME           = os.homedir();
const CLAUDE_JSON    = path.join(HOME, ".claude.json");
const COMMANDS_DIR   = path.join(HOME, ".claude", "commands");
const COMMAND_FILE   = path.join(COMMANDS_DIR, "planui.md");

// __dirname in the compiled dist/setup.js always points to the package's own
// dist/ folder, regardless of how it was installed (global npm, npx, npm link).
// This is simpler and more reliable than require.resolve for a self-referencing binary.
function resolveServerPath(): string {
  return path.join(__dirname, "server.js");
}

function resolveCommandTemplatePath(): string {
  return path.join(__dirname, "template", "planui.md");
}

async function readJsonOrNull(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return null;
    if (err instanceof SyntaxError) {
      throw new Error(`~/.claude.json contains invalid JSON. Fix it manually, then re-run setup.`);
    }
    throw err;
  }
}

async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const tmp = `${filePath}.planui.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

interface McpEntry {
  type?: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

function buildMcpEntry(serverPath: string): McpEntry {
  return {
    type: "stdio",
    command: process.execPath,   // absolute path to the Node binary
    args:    [serverPath],
    env:     {},
  };
}

function entryMatchesCurrent(entry: McpEntry, serverPath: string): boolean {
  return entry.command === process.execPath &&
         Array.isArray(entry.args) &&
         entry.args[0] === serverPath;
}

async function registerMcp(serverPath: string): Promise<"already" | "cli" | "direct"> {
  const existing = await readJsonOrNull(CLAUDE_JSON);

  // Check if already registered with the correct pinned path
  const servers = (existing as Record<string, Record<string, unknown>>)?.mcpServers ?? {};
  const current = servers["planui"] as McpEntry | undefined;
  if (current && entryMatchesCurrent(current, serverPath)) {
    return "already";
  }

  // Try official claude CLI first
  try {
    execFileSync(
      "claude",
      ["mcp", "add", "planui", "-s", "user", "--", process.execPath, serverPath],
      { stdio: "ignore" }
    );
    return "cli";
  } catch {
    // fall through to direct JSON edit
  }

  // Direct atomic JSON edit
  const cfg = existing ?? {};
  const mcpServers = ((cfg as Record<string, unknown>).mcpServers ?? {}) as Record<string, unknown>;
  mcpServers["planui"] = buildMcpEntry(serverPath);
  (cfg as Record<string, unknown>).mcpServers = mcpServers;
  await writeJsonAtomic(CLAUDE_JSON, cfg);
  return "direct";
}

async function removeMcp(): Promise<boolean> {
  const cfg = await readJsonOrNull(CLAUDE_JSON);
  if (!cfg) return false;
  const servers = (cfg as Record<string, unknown>).mcpServers as Record<string, unknown> | undefined;
  if (!servers || !servers["planui"]) return false;
  delete servers["planui"];
  await writeJsonAtomic(CLAUDE_JSON, cfg);
  return true;
}

async function installSlashCommand(): Promise<"already" | "installed" | "updated"> {
  const src = resolveCommandTemplatePath();
  const sourceContent = await fs.readFile(src, "utf8");
  await fs.mkdir(COMMANDS_DIR, { recursive: true });

  let existing: string | null = null;
  try { existing = await fs.readFile(COMMAND_FILE, "utf8"); } catch { /* not found */ }

  if (existing === sourceContent) return "already";

  const tmp = `${COMMAND_FILE}.planui.tmp`;
  await fs.writeFile(tmp, sourceContent, "utf8");
  await fs.rename(tmp, COMMAND_FILE);
  return existing === null ? "installed" : "updated";
}

async function removeSlashCommand(): Promise<boolean> {
  try { await fs.unlink(COMMAND_FILE); return true; } catch { return false; }
}

function openBrowser(url: string): void {
  const cmds: Record<string, string> = { darwin: "open", win32: "start", linux: "xdg-open" };
  const cmd = cmds[process.platform] ?? "xdg-open";
  const child = spawn(cmd, [url], { stdio: "ignore", detached: true });
  child.on("error", () => {});
  child.unref();
}

async function renderAndOpenWelcome(): Promise<void> {
  try {
    const wPath    = path.join(__dirname, "template", "welcome.md");
    const markdown = await fs.readFile(wPath, "utf8");
    const doc      = extractPlan("Welcome to planui", markdown);
    const html     = await renderToHtml(doc);
    const filepath = await savePlan(html, "Welcome to planui", doc.renderedAt);
    openBrowser(`file://${filepath}`);
    console.log(`  ✓ Welcome plan opened in browser`);
  } catch {
    console.log(`  • Welcome plan skipped (template not found)`);
  }
}

// ── Public commands ───────────────────────────────────────────────────────────

export async function runSetup(): Promise<void> {
  console.log(`\nplanui setup — @uzbekswe/planui@${TOOL_VERSION}\n`);

  let serverPath: string;
  try {
    serverPath = resolveServerPath();
  } catch {
    console.error(
      `  ✗ Could not resolve @uzbekswe/planui package path.\n` +
      `    Make sure you ran: npm install -g @uzbekswe/planui@latest`
    );
    process.exit(1);
  }

  console.log(`  Node:       ${process.execPath}`);
  console.log(`  Server:     ${serverPath}`);

  const mcpResult = await registerMcp(serverPath);
  if (mcpResult === "already")  console.log(`  ✓ MCP server "planui" already registered (pinned path unchanged)`);
  if (mcpResult === "cli")      console.log(`  ✓ MCP server "planui" registered via claude CLI`);
  if (mcpResult === "direct")   console.log(`  ✓ MCP server "planui" registered (direct ~/.claude.json edit)`);

  const cmdResult = await installSlashCommand();
  if (cmdResult === "already")   console.log(`  ✓ Slash command /planui already installed`);
  if (cmdResult === "installed") console.log(`  ✓ Slash command /planui installed at ${COMMAND_FILE}`);
  if (cmdResult === "updated")   console.log(`  ⚠ Slash command /planui updated at ${COMMAND_FILE}`);

  await renderAndOpenWelcome();

  console.log(`\n  Restart Claude Code, then use /planui <task> in any session.\n`);
}

export async function runUpgrade(): Promise<void> {
  console.log(`\nplanui upgrade — @uzbekswe/planui@${TOOL_VERSION}\n`);

  let serverPath: string;
  try {
    serverPath = resolveServerPath();
  } catch {
    console.error(`  ✗ Could not resolve package path. Run: npm install -g @uzbekswe/planui@latest first.`);
    process.exit(1);
  }

  const cfg = await readJsonOrNull(CLAUDE_JSON);
  const current = ((cfg as Record<string, Record<string, unknown>>)?.mcpServers?.["planui"]) as McpEntry | undefined;
  const expectedEntry = buildMcpEntry(serverPath);

  if (current && entryMatchesCurrent(current, serverPath)) {
    console.log(`  ✓ MCP path already points to current version (${serverPath})`);
  } else {
    await registerMcp(serverPath);
    console.log(`  ✓ MCP path updated → ${serverPath}`);
  }

  const cmdResult = await installSlashCommand();
  if (cmdResult === "already")   console.log(`  ✓ Slash command already up to date`);
  if (cmdResult === "updated")   console.log(`  ✓ Slash command updated`);
  if (cmdResult === "installed") console.log(`  ✓ Slash command re-installed`);

  console.log(`\n  Restart Claude Code to pick up changes.\n`);
  void expectedEntry; // suppress unused warning
}

export async function runUninstall(): Promise<void> {
  console.log(`\nplanui uninstall\n`);

  const mcpRemoved = await removeMcp();
  console.log(mcpRemoved ? `  ✓ MCP server "planui" removed from ~/.claude.json` : `  • MCP server "planui" was not registered`);

  const cmdRemoved = await removeSlashCommand();
  console.log(cmdRemoved ? `  ✓ Slash command /planui removed` : `  • Slash command /planui was not installed`);

  console.log(`\n  Plan archive preserved at ~/.claude/planui-archive/`);
  console.log(`  Restart Claude Code to apply changes.\n`);
}
