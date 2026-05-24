import { marked } from "marked";
import type {
  PlanDocument,
  PlanQuestion,
  PlanRisk,
  PlanSection,
  PlanStep,
} from "./ir.js";

// Injected by tsc via tsconfig paths or replaced at build time.
// Falls back to package version at runtime via require('../package.json').
let _toolVersion = "0.1.0";
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _toolVersion = require("../package.json").version as string;
} catch {
  // use default
}
export const TOOL_VERSION = _toolVersion;

// Heading aliases → canonical section kind
const HEADING_MAP: Record<string, PlanSection["kind"]> = {
  summary: "summary",
  overview: "summary",
  "tl;dr": "summary",
  tldr: "summary",
  "open questions": "questions",
  questions: "questions",
  steps: "steps",
  plan: "steps",
  implementation: "steps",
  "implementation steps": "steps",
  risks: "risks",
  risk: "risks",
  preconditions: "preconditions",
  requirements: "preconditions",
  prerequisites: "preconditions",
  files: "files",
  "files touched": "files",
  "affected files": "files",
  "stack changes": "stack",
  "changes to stack": "stack",
  dependencies: "stack",
  "new tools": "stack",
  status: "status",
};

function classifyHeading(text: string): PlanSection["kind"] {
  return HEADING_MAP[text.toLowerCase().trim()] ?? "note";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function genPlanId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "plan_";
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// Parse severity tag from risk text: [high], [med], [medium], [low]
function parseRiskSeverity(text: string): PlanRisk {
  const match = text.match(/\[(high|med(?:ium)?|low)\]/i);
  if (!match) return { text, severity: null };
  const raw = match[1].toLowerCase();
  const severity = raw === "medium" ? "med" : (raw as "high" | "med" | "low");
  return { text: text.replace(match[0], "").trim(), severity };
}

// Parse step title for (depends on N) or (depends_on: N, M) annotations
function parseStepDependencies(title: string): { clean: string; deps: number[] } {
  const match = title.match(/\(depends(?:_on)?:?\s*([\d,\s]+)\)/i);
  if (!match) return { clean: title, deps: [] };
  const deps = match[1]
    .split(/[,\s]+/)
    .map((n) => parseInt(n, 10))
    .filter((n) => !isNaN(n));
  return { clean: title.replace(match[0], "").trim(), deps };
}

// Parse numbered-list items from a markdown body string
function parseListItems(markdown: string): string[] {
  return markdown
    .split("\n")
    .map((l) => l.replace(/^\s*[-*+]\s+/, "").replace(/^\s*\d+\.\s+/, "").trim())
    .filter(Boolean);
}

// Parse Open Questions — each bullet may contain sub-bullets for radio/checkbox options
function parseQuestions(markdown: string): PlanQuestion[] {
  const lines = markdown.split("\n");
  const questions: PlanQuestion[] = [];
  let current: { text: string; body: string[] } | null = null;
  let qIndex = 0;

  for (const line of lines) {
    const topLevel = line.match(/^\s*[-*+]\s+(.+)/);
    const nested = line.match(/^\s{2,}[-*+]\s+(.+)/);
    if (topLevel && !nested) {
      if (current) {
        qIndex++;
        questions.push({
          id: `q${qIndex}`,
          text: current.text,
          bodyMarkdown: current.body.join("\n"),
        });
      }
      current = { text: topLevel[1].trim(), body: [] };
    } else if (nested && current) {
      current.body.push(line);
    } else if (current && line.trim()) {
      current.body.push(line);
    }
  }
  if (current) {
    qIndex++;
    questions.push({
      id: `q${qIndex}`,
      text: current.text,
      bodyMarkdown: current.body.join("\n"),
    });
  }
  return questions;
}

// Parse step list items — numbered list, each item may have a multi-line body
function parseSteps(markdown: string): PlanStep[] {
  const lines = markdown.split("\n");
  const steps: PlanStep[] = [];
  let current: { title: string; body: string[] } | null = null;

  for (const line of lines) {
    const numbered = line.match(/^\s*(\d+)\.\s+(.+)/);
    if (numbered) {
      if (current) {
        const { clean, deps } = parseStepDependencies(current.title);
        steps.push({
          id: slugify(clean),
          index: steps.length + 1,
          title: clean,
          bodyMarkdown: current.body.join("\n").trim(),
          dependsOn: deps,
        });
      }
      current = { title: numbered[2].trim(), body: [] };
    } else if (current && line.trim()) {
      current.body.push(line);
    }
  }
  if (current) {
    const { clean, deps } = parseStepDependencies(current.title);
    steps.push({
      id: slugify(clean),
      index: steps.length + 1,
      title: clean,
      bodyMarkdown: current.body.join("\n").trim(),
      dependsOn: deps,
    });
  }
  return steps;
}

function parseRisks(markdown: string): PlanRisk[] {
  return parseListItems(markdown).map(parseRiskSeverity);
}

// Split raw markdown into (heading, body) pairs using marked lexer tokens
function splitIntoSections(
  markdown: string
): Array<{ heading: string; body: string }> {
  const tokens = marked.lexer(markdown);
  const sections: Array<{ heading: string; body: string }> = [];
  let bodyLines: string[] = [];
  let currentHeading = "";

  for (const token of tokens) {
    if (token.type === "heading" && token.depth === 2) {
      if (currentHeading || bodyLines.length) {
        sections.push({ heading: currentHeading, body: bodyLines.join("\n").trim() });
      }
      currentHeading = (token as { type: string; text: string }).text;
      bodyLines = [];
    } else {
      bodyLines.push((token as { raw: string }).raw ?? "");
    }
  }
  if (currentHeading || bodyLines.length) {
    sections.push({ heading: currentHeading, body: bodyLines.join("\n").trim() });
  }
  return sections;
}

export function extractPlan(title: string, markdown: string): PlanDocument {
  const raw = splitIntoSections(markdown);
  const sections: PlanSection[] = [];

  for (const { heading, body } of raw) {
    if (!heading && !body.trim()) continue;

    const kind = classifyHeading(heading);
    const base: PlanSection = { kind, heading, bodyMarkdown: body };

    if (kind === "steps") {
      base.steps = parseSteps(body);
    } else if (kind === "questions") {
      base.questions = parseQuestions(body);
    } else if (kind === "risks") {
      base.risks = parseRisks(body);
    } else if (kind === "status") {
      base.statusText = parseListItems(body)[0] ?? body.split("\n")[0]?.trim();
    }

    sections.push(base);
  }

  return {
    title,
    sections,
    rawMarkdown: markdown,
    renderedAt: new Date().toISOString(),
    toolVersion: TOOL_VERSION,
    planId: genPlanId(),
  };
}
