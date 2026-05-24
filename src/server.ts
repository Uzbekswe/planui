#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "node:child_process";
import { extractPlan, TOOL_VERSION } from "./extract.js";
import { renderToHtml } from "./render.js";
import { savePlan } from "./archive.js";
import { asyncUpdateBanner } from "./update.js";

const TOOL_DESCRIPTION = `PlanUI adds structured review workflows to AI coding agents.

Use this tool to turn any multi-step implementation plan into an interactive browser UI where the human can approve, strike, comment, and prioritize steps before work begins.

WHEN TO USE:
  Before executing any non-trivial coding task — surface the plan, get human sign-off, then proceed.
  Works with Claude Code, Codex CLI, and any MCP-compatible assistant.

ACTIVATION PHRASES (humans use these to invoke you):
  "use planui"
  "open planui"
  "plan with planui before coding"
  "render this plan with planui"
  "show me the plan in planui"

INPUTS:
  title    — Short human-readable title (one line, no markdown)
  markdown — The full plan in markdown

PLAN FORMAT (all sections optional):
  ## Summary | ## Overview | ## TL;DR       — 1–3 sentence overview
  ## Open Questions | ## Questions          — each bullet → inline answer field
                                              (Approve button disabled until all answered)
  ## Steps | ## Plan | ## Implementation    — numbered list; each → annotatable step card
                                              mark dependencies: "Step title (depends on 2, 3)"
  ## Risks | ## Risk                        — [high] / [med] / [low] severity badges
  ## Preconditions | ## Requirements        — prerequisite checklist
  ## Files | ## Files Touched               — paths grouped by directory in the UI
  ## Stack Changes | ## Dependencies        — new deps / infra changes
  ## Status                                 — single line shown as header badge
  Any other H2                              — preserved as a note card

AFTER CALLING THIS TOOL:
  Tell the user: "I've opened the plan in your browser. Review each step
  (approve or strike), answer any open questions, then click Approve plan or
  Copy feedback and paste it back here."

  On the user's next message, look for a \`planresponse\` block:
  \`\`\`planresponse <planId>
  action: approve | modify | revise
  questions:
    q1: answer text
  steps:
    Step 3 [remove]: reason
    Step 7 [feedback]: use v2 API [high]
  \`\`\`

  action values:
    approve — all steps approved; proceed with implementation
    modify  — one or more steps struck; revise plan before proceeding
    revise  — human left comments but wants changes without fully categorizing them`;

function openBrowser(url: string): void {
  const cmds: Record<string, string> = {
    darwin: "open",
    win32:  "start",
    linux:  "xdg-open",
  };
  const cmd = cmds[process.platform] ?? "xdg-open";
  const child = spawn(cmd, [url], { stdio: "ignore", detached: true });
  child.on("error", () => { /* ignore — user can open manually */ });
  child.unref();
}

const server = new Server(
  { name: "planui", version: TOOL_VERSION },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "render_plan",
    description: TOOL_DESCRIPTION,
    inputSchema: {
      type: "object",
      properties: {
        title:    { type: "string", description: "Short plan title (one line)." },
        markdown: { type: "string", description: "Full plan markdown. See tool description for recognized sections." },
      },
      required: ["title", "markdown"],
    },
  }],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "render_plan") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const args = (request.params.arguments ?? {}) as Record<string, unknown>;
  const title    = typeof args.title    === "string" ? args.title.trim()    : "";
  const markdown = typeof args.markdown === "string" ? args.markdown.trim() : "";

  if (!title || !markdown) {
    throw new Error("render_plan requires both 'title' and 'markdown'.");
  }

  const doc      = extractPlan(title, markdown);
  const html     = await renderToHtml(doc);
  const filepath = await savePlan(html, title, doc.renderedAt);
  const fileUrl  = `file://${filepath}`;

  openBrowser(fileUrl);
  asyncUpdateBanner();

  const text = [
    `Plan rendered and saved.`,
    ``,
    `  File: ${filepath}`,
    `  Plan ID: ${doc.planId}`,
    `  Version: @uzbekswe/planui@${TOOL_VERSION}`,
    ``,
    `The page is opening in the user's browser. Ask them to:`,
    `  1. Review the steps and answer any open questions`,
    `  2. Click "Approve plan" or annotate steps and click "Copy feedback"`,
    `  3. Paste the \`planresponse\` block back into chat`,
  ].join("\n");

  return { content: [{ type: "text", text }] };
});

const transport = new StdioServerTransport();
server.connect(transport).catch((err: Error) => {
  process.stderr.write(`planui-mcp: fatal: ${err.message}\n`);
  process.exit(1);
});
