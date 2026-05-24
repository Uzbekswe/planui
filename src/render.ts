import { promises as fs } from "node:fs";
import path from "node:path";
import { marked } from "marked";
import type { PlanDocument, PlanSection } from "./ir.js";

const TEMPLATE_DIR = path.join(__dirname, "template");

async function readTemplate(): Promise<{ html: string; css: string; js: string }> {
  const [html, css, js] = await Promise.all([
    fs.readFile(path.join(TEMPLATE_DIR, "template.html"), "utf8"),
    fs.readFile(path.join(TEMPLATE_DIR, "styles.css"), "utf8"),
    fs.readFile(path.join(TEMPLATE_DIR, "actions.js"), "utf8"),
  ]);
  return { html, css, js };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMd(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}

function renderMdInline(text: string): string {
  return marked.parseInline(text, { async: false }) as string;
}

function renderSection(sec: PlanSection): string {
  const id = `section-${sec.kind === "note" ? slugify(sec.heading) : sec.kind}`;
  const headingHtml = `<div class="section-heading">${escapeHtml(sec.heading || sec.kind)}</div>`;

  switch (sec.kind) {
    case "summary":
      return `
<section class="section" id="${id}" data-kind="summary">
  ${headingHtml}
  <div class="prose-card">${renderMd(sec.bodyMarkdown)}</div>
</section>`;

    case "steps": {
      if (!sec.steps?.length) {
        return `<section class="section" id="${id}" data-kind="steps">${headingHtml}<div class="prose-card">${renderMd(sec.bodyMarkdown)}</div></section>`;
      }
      const stepItems = sec.steps.map((step) => {
        const depBadge = step.dependsOn.length
          ? `<span class="step-dep-badge">blocked by step ${step.dependsOn.join(", ")}</span>`
          : "";
        const bodyHtml = step.bodyMarkdown.trim()
          ? `<div class="step-body"><div>${renderMd(step.bodyMarkdown)}</div></div>`
          : "";
        return `
<div class="step-card" id="step-${escapeHtml(step.id)}"
     data-step-id="${escapeHtml(step.id)}"
     data-step-index="${step.index}">
  <div class="step-header">
    <div class="step-num">${step.index}</div>
    <div class="step-title">${escapeHtml(step.title)}${depBadge}</div>
    <div class="step-actions">
      <button class="step-btn approve" title="Approve this step (a)" aria-label="Approve step ${step.index}">✓</button>
      <button class="step-btn strike" title="Strike this step (s)" aria-label="Strike step ${step.index}">~~</button>
      <button class="step-btn comment" title="Add comment (c)" aria-label="Comment on step ${step.index}">✎</button>
    </div>
  </div>
  ${bodyHtml}
  <div class="step-comment-area">
    <textarea placeholder="Add feedback for this step…" rows="2"></textarea>
  </div>
</div>`;
      }).join("\n");

      return `
<section class="section" id="${id}" data-kind="steps">
  ${headingHtml}
  <div class="step-list">${stepItems}</div>
</section>`;
    }

    case "questions": {
      if (!sec.questions?.length) {
        return `<section class="section" id="${id}" data-kind="questions">${headingHtml}<div class="prose-card">${renderMd(sec.bodyMarkdown)}</div></section>`;
      }
      const qItems = sec.questions.map((q) => `
<div class="question-card" data-qid="${escapeHtml(q.id)}">
  <div class="question-text">${escapeHtml(q.text)}</div>
  ${renderQuestionInput(q)}
</div>`).join("\n");
      return `
<section class="section" id="${id}" data-kind="questions">
  ${headingHtml}
  <div class="question-list">${qItems}</div>
</section>`;
    }

    case "risks": {
      if (!sec.risks?.length) {
        return `<section class="section" id="${id}" data-kind="risks">${headingHtml}<div class="prose-card">${renderMd(sec.bodyMarkdown)}</div></section>`;
      }
      const riskItems = sec.risks.map((r) => {
        const badge = r.severity
          ? `<span class="risk-badge risk-${r.severity}">${r.severity}</span>`
          : "";
        return `<div class="risk-card">${badge}<span>${escapeHtml(r.text)}</span></div>`;
      }).join("\n");
      return `
<section class="section" id="${id}" data-kind="risks">
  ${headingHtml}
  <div class="risk-grid">${riskItems}</div>
</section>`;
    }

    case "preconditions":
    case "files":
    case "stack": {
      const items = sec.bodyMarkdown
        .split("\n")
        .map((l) => l.replace(/^\s*[-*+]\s+/, "").trim())
        .filter(Boolean)
        .map((text) => `<div class="rail-item"><span>${renderMdInline(text)}</span></div>`)
        .join("\n");
      return `
<section class="section" id="${id}" data-kind="${sec.kind}">
  ${headingHtml}
  <div class="rail-list">${items || renderMd(sec.bodyMarkdown)}</div>
</section>`;
    }

    case "note":
    default:
      return `
<section class="section" id="${id}" data-kind="note">
  ${headingHtml}
  <div class="prose-card">${renderMd(sec.bodyMarkdown)}</div>
</section>`;
  }
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function parseChoices(markdown: string): string[] {
  return markdown
    .split("\n")
    .map(l => l.replace(/^\s*(?:[a-z]\)|[-*+•])\s+/i, "").trim())
    .filter(Boolean);
}

function renderQuestionInput(q: import("./ir.js").PlanQuestion): string {
  const choices = parseChoices(q.bodyMarkdown);
  if (choices.length >= 2) {
    const chips = choices.map(c =>
      `<label class="chip"><input type="radio" name="q-${escapeHtml(q.id)}" value="${escapeHtml(c)}" hidden>${escapeHtml(c)}</label>`
    ).join("");
    return `<div class="chip-group" role="group" aria-label="Options for: ${escapeHtml(q.text)}">${chips}</div>`;
  }
  const body = q.bodyMarkdown.trim()
    ? `<div class="prose-card" style="margin-bottom:8px;font-size:.85rem;">${renderMd(q.bodyMarkdown)}</div>`
    : "";
  return `${body}<textarea placeholder="Your answer…" rows="2"></textarea>`;
}

function sanitizeSentinels(html: string): string {
  // Prevent {{SENTINEL}} patterns in plan content from being treated as template tokens
  return html.replace(/\{\{/g, "&#123;&#123;");
}

export async function renderToHtml(doc: PlanDocument): Promise<string> {
  const { html: tmpl, css, js } = await readTemplate();

  const sectionsHtml = sanitizeSentinels(doc.sections.map(renderSection).join("\n"));

  const statusSection = doc.sections.find((s) => s.kind === "status");
  const statusBadge = statusSection?.statusText
    ? `<span id="status-badge">${escapeHtml(statusSection.statusText)}</span>`
    : "";

  const renderedDate = new Date(doc.renderedAt).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  // {{PLAN_JSON}} must be LAST: rawMarkdown may contain sentinel patterns like
  // {{ACTIONS_JS}} which would be consumed before the real replacement runs.
  return tmpl
    .replaceAll("{{TITLE}}", escapeHtml(doc.title))
    .replace("{{STYLES}}", css)
    .replace("{{ACTIONS_JS}}", js)
    .replace("{{STATUS_BADGE}}", statusBadge)
    .replace("{{TOOL_VERSION}}", escapeHtml(doc.toolVersion))
    .replace("{{SECTIONS_HTML}}", sectionsHtml)
    .replace("{{RENDERED_AT}}", escapeHtml(renderedDate))
    .replace("{{PLAN_ID}}", escapeHtml(doc.planId))
    .replace("{{PLAN_JSON}}", JSON.stringify(doc));
}
