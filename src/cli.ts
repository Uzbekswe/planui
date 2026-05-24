#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { extractPlan, TOOL_VERSION } from "./extract.js";
import { renderToHtml } from "./render.js";
import { savePlan } from "./archive.js";
import { checkForUpdate } from "./update.js";
import { runSetup, runSetupCodex, runUpgrade, runUninstall, runDoctor, runIntegrations } from "./setup.js";
import { ALL_INTEGRATIONS } from "./integrations/index.js";

function printUsage(): void {
  console.log(`
planui — structured review workflows for AI coding agents

Usage:
  planui setup                   Add planui to Claude Code (one-time install)
  planui setup codex             Add planui to Codex CLI
  planui upgrade                 Update MCP path + slash command after npm upgrade
  planui uninstall               Remove MCP server entry and slash command
  planui doctor                  Show registration status for all integrations
  planui integrations            List all supported integrations and their capabilities
  planui prompt [assistant]      Print recommended invocation template for an assistant
  planui render <file.md>        Render a plan markdown file in the browser
  planui version                 Print installed version
  planui check-update            Compare installed version against npm registry
  planui --help                  Show this help

Assistants: claude (default), codex

After setup, restart your assistant and use:
  Claude Code: /planui <task>   or  "use planui to plan: <task>"
  Codex CLI:   "use planui to plan: <task>"

Share with others (inspect first):
  https://github.com/Uzbekswe/planui/tree/v${TOOL_VERSION}
  npx -y @uzbekswe/planui@${TOOL_VERSION} setup
`.trim());
}

function openBrowser(url: string): void {
  const cmds: Record<string, string> = { darwin: "open", win32: "start", linux: "xdg-open" };
  const cmd = cmds[process.platform] ?? "xdg-open";
  const child = spawn(cmd, [url], { stdio: "ignore", detached: true });
  child.on("error", () => {});
  child.unref();
}

async function runRender(args: string[]): Promise<void> {
  const filePath = args[0];
  if (!filePath) {
    console.error("planui render: missing file path\nUsage: planui render <plan.md>");
    process.exit(1);
  }
  const abs      = path.resolve(filePath);
  const markdown = await fs.readFile(abs, "utf8");
  const title    = args[1] ?? path.basename(abs, path.extname(abs));
  const doc      = extractPlan(title, markdown);
  const html     = await renderToHtml(doc);
  const filepath = await savePlan(html, title, doc.renderedAt);
  const url      = `file://${filepath}`;
  console.log(url);
  openBrowser(url);
}

async function runCheckUpdate(): Promise<void> {
  console.log("Checking for updates…");
  try {
    const { current, latest, hasUpdate } = await checkForUpdate();
    if (hasUpdate) {
      console.log(`  Update available: ${current} → ${latest}`);
      console.log(`  Review diff: https://github.com/Uzbekswe/planui/compare/v${current}...v${latest}`);
      console.log(`  Run: npm install -g @uzbekswe/planui@${latest} && planui upgrade`);
    } else {
      console.log(`  Up to date: @uzbekswe/planui@${current}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  Could not reach npm registry: ${msg}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd  = argv[0];

  if (!cmd || cmd === "--help" || cmd === "-h") {
    printUsage();
    return;
  }

  switch (cmd) {
    case "setup":
      if (argv[1] === "codex") {
        await runSetupCodex();
      } else {
        await runSetup();
      }
      break;
    case "upgrade":      await runUpgrade();             break;
    case "uninstall":    await runUninstall();           break;
    case "doctor":       await runDoctor();              break;
    case "integrations": await runIntegrations();        break;
    case "prompt": {
      const assistantName = argv[1] || "claude";
      const adapter = ALL_INTEGRATIONS.find(a => a.name === assistantName);
      if (!adapter) {
        const names = ALL_INTEGRATIONS.map(a => a.name).join(", ");
        console.error(`Unknown assistant: ${assistantName}\nAvailable: ${names}`);
        process.exit(1);
      }
      console.log(adapter.promptTemplate());
      break;
    }
    case "render":       await runRender(argv.slice(1)); break;
    case "version":      console.log(TOOL_VERSION);     break;
    case "check-update": await runCheckUpdate();         break;
    default:
      // Convenience: planui <file.md>
      if (cmd.endsWith(".md") || cmd.includes("/") || cmd.includes("\\")) {
        await runRender(argv);
        break;
      }
      console.error(`Unknown command: ${cmd}\nRun planui --help for usage.`);
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`planui: ${msg}`);
  process.exit(1);
});
