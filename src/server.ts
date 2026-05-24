#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "node:child_process";
import { extractPlan, TOOL_VERSION } from "./extract.js";
import { renderToHtml } from "./render.js";
import { savePlan } from "./archive.js";
import { asyncUpdateBanner } from "./update.js";

const TOOL_DESCRIPTION = `Render a plan as an interactive, annotatable HTML page the user can review in their browser.

Use this tool whenever you have produced a multi-step plan, a non-trivial change proposal, or any structured implementation plan — instead of printing a wall of markdown into chat.

INPUTS:
  title    — Short human-readable title (one line, no markdown)
  markdown — The full plan in markdown

RECOGNIZED H2 SECTIONS (case-insensitive, all optional):
  ## Summary | ## Overview | ## TL;DR       — short prose intro
  ## Open Questions | ## Questions          — each bullet becomes an inline answer field
  ## Steps | ## Plan | ## Implementation    — numbered list; each item becomes an annotatable step card
  ## Risks | ## Risk                        — bullet list; prefix [high] / [med] / [low] for severity badge
  ## Preconditions | ## Requirements        — bullet list rail card
  ## Files | ## Files Touched               — bullet list rendered as monospace chips
  ## Stack Changes | ## Dependencies        — bullet list rail card
  ## Status                                 — single line shown as a badge in the header
  Any other H2 is preserved as a note card.

STEP CONVENTIONS:
  - Use a numbered list: 1. 2. 3.
  - Mark dependencies: "Step title (depends on 2, 3)" — those steps show a "blocked by" badge.
  - Reference files in backticks: \`src/server.ts\`

RISK SEVERITY:
  Prefix or inline: "[high] data loss risk", "[med] flaky test", "[low] minor UX nit"

AFTER CALLING THIS TOOL:
  Tell the user: "I've rendered the plan in your browser. Review the steps, answer any open questions, annotate or approve steps, then click 'Copy feedback' and paste it back here."

  On the user's next message, look for a fenced \`planresponse\` block:
  \`\`\`planresponse <plan_id>
  approve            ← proceed with all steps
  q1: answer text    ← answers to open questions
  \`\`\`
  OR:
  \`\`\`planresponse <plan_id>
  modify
  q1: answer text
  feedback:
    Step 2 [remove]: description
    Step 3 [feedback]: please add error handling
  \`\`\`

  Parse the action ("approve" or "modify") and act accordingly.`;

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
