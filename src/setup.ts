import { spawn } from "node:child_process";
import { TOOL_VERSION } from "./extract.js";
import { extractPlan } from "./extract.js";
import { renderToHtml } from "./render.js";
import { savePlan } from "./archive.js";
import { ClaudeAdapter, CodexAdapter, ALL_INTEGRATIONS } from "./integrations/index.js";
import { resolveServerPath } from "./integrations/claude.js";
import type { IntegrationDiagnostic, IntegrationStatus } from "./integrations/index.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function openBrowser(url: string): void {
  const cmds: Record<string, string> = { darwin: "open", win32: "start", linux: "xdg-open" };
  const cmd = cmds[process.platform] ?? "xdg-open";
  const child = spawn(cmd, [url], { stdio: "ignore", detached: true });
  child.on("error", () => {});
  child.unref();
}

async function renderAndOpenWelcome(): Promise<void> {
  try {
    const path     = await import("node:path");
    const fs       = await import("node:fs/promises");
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

function statusIcon(s: IntegrationStatus): string {
  switch (s) {
    case "registered":     return "✓";
    case "not-registered": return "·";
    case "not-installed":  return "–";
    case "broken":         return "!";
  }
}

function renderDiagnosticTable(diagnostics: IntegrationDiagnostic[]): boolean {
  let hasBroken = false;
  for (const d of diagnostics) {
    const icon = statusIcon(d.status);
    const pad  = d.name.padEnd(8);
    console.log(`  ${icon} ${pad} ${d.displayName.padEnd(14)} ${d.status}`);
    if (d.detail) console.log(`      ! ${d.detail}`);
    if (d.status === "broken") hasBroken = true;
  }
  return hasBroken;
}

// ── Public commands ───────────────────────────────────────────────────────────

export async function runSetup(): Promise<void> {
  console.log(`\nplanui setup (Claude Code) — @uzbekswe/planui@${TOOL_VERSION}\n`);

  const serverPath = resolveServerPath();
  console.log(`  Node:   ${process.execPath}`);
  console.log(`  Server: ${serverPath}`);

  await ClaudeAdapter.register(serverPath);
  const diag = await ClaudeAdapter.diagnose();
  if (diag.status === "registered") {
    console.log(`  ✓ MCP server "planui" registered`);
  } else {
    console.log(`  ✗ Registration failed: ${diag.detail ?? diag.status}`);
    process.exit(1);
  }

  if (ClaudeAdapter.capabilities.slashCommands) {
    const result = await ClaudeAdapter.installSlashCommand();
    if (result === "already")   console.log(`  ✓ Slash command /planui already up to date`);
    if (result === "installed") console.log(`  ✓ Slash command /planui installed`);
    if (result === "updated")   console.log(`  ⚠ Slash command /planui updated`);
  }

  await renderAndOpenWelcome();
  console.log(`\n  Restart Claude Code, then use /planui <task> in any session.\n`);
}

export async function runSetupCodex(): Promise<void> {
  console.log(`\nplanui setup codex — @uzbekswe/planui@${TOOL_VERSION}\n`);

  const serverPath = resolveServerPath();
  console.log(`  Node:   ${process.execPath}`);
  console.log(`  Server: ${serverPath}`);

  try {
    await CodexAdapter.register(serverPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n  ✗ ${msg}\n`);
    process.exit(1);
  }

  const diag = await CodexAdapter.diagnose();
  if (diag.status === "registered") {
    console.log(`  ✓ MCP server "planui" registered with Codex CLI`);
  } else {
    console.log(`  ✗ Post-registration validation failed: ${diag.detail ?? diag.status}`);
    process.exit(1);
  }

  if (!CodexAdapter.capabilities.slashCommands) {
    console.log(`  · Slash commands not applicable for Codex (uses different command system)`);
  }

  console.log(`\n  Restart Codex, then tell it: "use planui to plan: <task>"\n`);
}

export async function runDoctor(): Promise<void> {
  console.log(`\nplanui doctor — @uzbekswe/planui@${TOOL_VERSION}\n`);

  // Collect diagnostics first (structured), then render — keeps these layers separate
  // so future --json output can reuse the same collection without coupling to console I/O
  const diagnostics = await Promise.all(ALL_INTEGRATIONS.map(a => a.diagnose()));

  console.log(`  name      assistant       status`);
  console.log(`  ────────  ──────────────  ───────────────`);
  const hasBroken = renderDiagnosticTable(diagnostics);

  console.log();
  if (hasBroken) {
    console.log(`  One or more integrations are broken. Run planui setup [assistant] to repair.\n`);
    process.exitCode = 1;
  } else {
    console.log(`  All integrations healthy.\n`);
  }
}

export async function runIntegrations(): Promise<void> {
  console.log(`\nSupported integrations — @uzbekswe/planui@${TOOL_VERSION}\n`);

  const diagnostics = await Promise.all(ALL_INTEGRATIONS.map(a => a.diagnose()));

  console.log(`  name      assistant       status          slash-commands`);
  console.log(`  ────────  ──────────────  ──────────────  ──────────────`);
  for (const d of diagnostics) {
    const adapter  = ALL_INTEGRATIONS.find(a => a.name === d.name)!;
    const slash    = adapter.capabilities.slashCommands ? "yes" : "no";
    const icon     = statusIcon(d.status);
    console.log(`  ${icon} ${d.name.padEnd(8)} ${d.displayName.padEnd(14)}  ${d.status.padEnd(16)} ${slash}`);
  }
  console.log();
}

export async function runUpgrade(): Promise<void> {
  console.log(`\nplanui upgrade — @uzbekswe/planui@${TOOL_VERSION}\n`);

  const serverPath = resolveServerPath();
  await ClaudeAdapter.register(serverPath);
  console.log(`  ✓ MCP path updated → ${serverPath}`);

  if (ClaudeAdapter.capabilities.slashCommands) {
    const result = await ClaudeAdapter.installSlashCommand();
    if (result === "already")   console.log(`  ✓ Slash command already up to date`);
    if (result === "updated")   console.log(`  ✓ Slash command updated`);
    if (result === "installed") console.log(`  ✓ Slash command re-installed`);
  }

  console.log(`\n  Restart Claude Code to pick up changes.\n`);
}

export async function runUninstall(): Promise<void> {
  console.log(`\nplanui uninstall\n`);

  await ClaudeAdapter.remove();
  console.log(`  ✓ MCP server "planui" removed from Claude Code config`);

  if (ClaudeAdapter.capabilities.slashCommands) {
    try {
      const fs = await import("node:fs/promises");
      const os = await import("node:os");
      const path = await import("node:path");
      await fs.unlink(path.join(os.homedir(), ".claude", "commands", "planui.md"));
      console.log(`  ✓ Slash command /planui removed`);
    } catch {
      console.log(`  · Slash command /planui was not installed`);
    }
  }

  console.log(`\n  Plan archive preserved at ~/.claude/planui-archive/`);
  console.log(`  Restart Claude Code to apply changes.\n`);
}
