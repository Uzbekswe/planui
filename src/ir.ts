// Pure TypeScript interfaces — no logic, no imports.

export interface PlanStep {
  id: string;
  index: number;        // 1-based position in the steps list
  title: string;
  bodyMarkdown: string;
  dependsOn: number[];  // indices of steps this step depends on
  diffStatus?: "new" | "modified" | "unchanged" | "removed";
}

export interface PlanQuestion {
  id: string;           // q1, q2, …
  text: string;
  bodyMarkdown: string; // includes any choice options
}

export interface PlanRisk {
  text: string;
  severity: "high" | "med" | "low" | null;
}

export interface PlanSection {
  kind:
    | "summary"
    | "questions"
    | "steps"
    | "risks"
    | "preconditions"
    | "files"
    | "stack"
    | "status"
    | "note";
  heading: string;      // original heading text
  bodyMarkdown: string; // raw markdown for note/summary/preconditions/files/stack
  steps?: PlanStep[];
  questions?: PlanQuestion[];
  risks?: PlanRisk[];
  statusText?: string;
}

export interface PlanDocument {
  title: string;
  sections: PlanSection[];
  rawMarkdown: string;
  renderedAt: string;   // ISO-8601
  toolVersion: string;  // injected at compile time
  planId: string;       // unique slug for this render
  version?: number;     // for future diff chaining
}

export interface Prefs {
  theme?: "dark" | "midnight" | "light";
  font?: "sans" | "serif" | "mono";
  color?: "blue" | "green" | "purple" | "white";
}

export interface RenderResult {
  html: string;
  archivePath: string;
  planId: string;
}
