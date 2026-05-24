# @uzbekswe/planui

[![npm version](https://img.shields.io/npm/v/@uzbekswe/planui)](https://www.npmjs.com/package/@uzbekswe/planui)
[![CI](https://github.com/Uzbekswe/planui/actions/workflows/ci.yml/badge.svg)](https://github.com/Uzbekswe/planui/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/npm/l/@uzbekswe/planui)](https://github.com/Uzbekswe/planui/blob/main/LICENSE)
[![Node.js >= 20](https://img.shields.io/node/v/@uzbekswe/planui)](https://nodejs.org)

**PlanUI adds structured review workflows to AI coding agents.**

Before an agent writes a single line of code, it surfaces the implementation plan as an interactive browser UI. You approve steps, answer open questions, and strike anything you don't want — then click one button to send structured feedback back to the agent.

Works with **Claude Code**, **Codex CLI**, and any MCP-compatible assistant.

![planui demo — dark mode step cards with sidebar TOC](https://raw.githubusercontent.com/Uzbekswe/planui/main/docs/screenshot-dark.png)

---

## Quick start

### Prerequisites

- **Node.js 20 or higher** — `node --version`
- One of: **Claude Code** ([install](https://docs.anthropic.com/en/docs/claude-code)) · **Codex CLI** ([install](https://github.com/openai/codex))

### Install

```bash
npm install -g @uzbekswe/planui@0.3.1
```

> **Why pin the version?** Pinning means you control exactly what runs on your machine. Inspect the source at the tag before installing — no `@latest` surprises.

### Setup

**Claude Code:**
```bash
planui setup
# → registers MCP server, installs /planui slash command, opens welcome plan
```

**Codex CLI:**
```bash
planui setup codex
# → registers via `codex mcp add`, validates paths before reporting success
```

### Restart your assistant

Close and reopen Claude Code or Codex. The `planui` MCP server appears in `/mcp`.

### Use it

**Claude Code** — slash command:
```
/planui add idempotency to the /v2/refresh endpoint
```

**Any assistant** — natural language:
```
use planui to plan: add idempotency to /v2/refresh
```

The agent explores the codebase, writes a structured plan, and opens it as an interactive HTML page. Annotate steps, answer questions, then click **Approve plan** or **Copy feedback**.

---

## CLI reference

| Command | Description |
|---------|-------------|
| `planui setup` | Register with Claude Code + install `/planui` slash command |
| `planui setup codex` | Register with Codex CLI |
| `planui upgrade` | Update pinned MCP path + slash command after `npm upgrade` |
| `planui uninstall` | Remove MCP server entry and slash command |
| `planui doctor` | Show registration status for all integrations |
| `planui integrations` | List supported assistants and their capabilities |
| `planui prompt [assistant]` | Print full invocation guide for an assistant |
| `planui render <file.md>` | Render any plan markdown file in the browser |
| `planui version` | Print installed version |
| `planui check-update` | Compare installed version against npm registry |

```bash
planui doctor
#   ✓ claude   Claude Code     registered
#   ✓ codex    Codex CLI       registered

planui prompt codex
# Prints full per-assistant invocation template with activation phrases
```

---

## What you get

### Per-step review controls

Every step card has annotation buttons plus keyboard shortcuts:

| Button | Key | Effect |
|--------|-----|--------|
| ✓ Approve | `a` | Marks step green; counts toward progress bar |
| ~~ Strike | `s` | Marks step for removal; included in feedback |
| ✎ Comment | `c` | Opens inline textarea for feedback text |
| H / M / L | — | Set step priority; persisted + included in feedback |

Navigate: `j` / `↓` next step · `k` / `↑` previous step

### Dual approval gate

**Approve plan** is disabled until:
1. Every open question has an answer
2. Every step has been explicitly approved or struck

A step with only a comment does **not** count as reviewed. This guarantee means an agent reading an "approved" response knows a human reviewed every step.

### Bulk actions

- **Approve all** / **Strike all** / **Clear all** — resolve the whole plan in one click
- **Resolve remaining** — approve all still-pending steps, leave struck ones alone
- **Focus mode** — hides resolved step bodies so you can see what's left

### Open questions with chip options

Questions render as inline answer fields. Bullet-list questions render as clickable chips. The Approve button stays disabled until all are answered.

### Structured feedback format

**Copy feedback** outputs a machine-readable `planresponse` block:

```
```planresponse plan_abc123
action: modify

questions:
  q1: Yes, add a migration for existing rows

steps:
  Step 3 [remove]: already handled in the auth middleware
  Step 7 [feedback]: use the v2 API endpoint, not v1 [high]
  Step 9 [priority:med]
```
```

Actions: `approve` (all steps approved) · `modify` (steps struck) · `revise` (comments but no strikes)

### Progress bar + status

The header shows a live `N approved · M struck · P pending` count with a fill bar. Unreviewed steps show a dashed yellow border so nothing slips through.

### Sidebar TOC with scroll-spy

Collapsible table of contents tracks scroll position. Questions entry shows a live unanswered-count badge.

### Themes and appearance

Dark (default) · Midnight (OLED) · Light · System — with Sans / Serif / Mono fonts and Blue / Green / Purple / White accent.

### Plan archive

Every rendered plan is saved to `~/.claude/planui-archive/YYYY-MM-DDTHH-mm-ss-<slug>.html` as a fully self-contained file. Open any past plan offline.

### Mermaid diagrams

Plans with ` ```mermaid ` blocks load the renderer from jsDelivr on demand. Falls back to raw source if offline.

---

## Supported integrations

| Assistant | Setup command | Slash command | Status |
|-----------|--------------|---------------|--------|
| Claude Code | `planui setup` | `/planui <task>` | ✓ Full support |
| Codex CLI | `planui setup codex` | — | ✓ Full support |

```bash
planui integrations
#   ✓ claude   Claude Code     registered       slash-commands: yes
#   ✓ codex    Codex CLI       registered       slash-commands: no
```

`planui doctor` detects broken registrations (stale server paths, malformed config, missing executables) and exits non-zero only when something needs fixing.

See [ASSISTANT_INTEGRATIONS.md](./ASSISTANT_INTEGRATIONS.md) for the adapter interface contract and instructions for adding new assistants.

---

## Plan markdown schema

All H2 sections are optional — nothing is required.

| Section heading | Renders as |
|-----------------|-----------|
| `## Summary` / `## Overview` / `## TL;DR` | Prose card |
| `## Open Questions` / `## Questions` | Answer fields (chip options if bulleted; gates Approve) |
| `## Steps` / `## Plan` / `## Implementation` | Annotatable step cards with approve/strike/comment/priority |
| `## Risks` / `## Risk` | Risk cards with `[high]` / `[med]` / `[low]` severity badges |
| `## Preconditions` / `## Requirements` | Checklist rail |
| `## Files` / `## Files Touched` | Paths grouped by directory |
| `## Stack Changes` / `## Dependencies` | Dependency rail |
| `## Status` | Single-line badge in the header |
| Any other H2 | Note card — content preserved |

### Example plan

```markdown
## Summary
Add idempotency to the /v2/refresh endpoint to prevent duplicate token grants.

## Open Questions
1. Should we backfill existing duplicate grants?
   - Yes, run a migration now
   - No, new requests only
   - Defer to next sprint

## Steps
1. **Add idempotency key column** — migration on `refresh_grants`. `db/migrations/`
2. **Guard duplicate calls** (depends on 1) — check key at entry point. `src/auth/refresh.ts`
3. **Update integration tests** (depends on 2) — replace mock with real fixture. `test/`

## Risks
- Sessions invalidate during dual-write window [med] — mitigated by 24h overlap.
- Migration lock on large table [low] — run during off-peak window.

## Files Touched
- `src/auth/refresh.ts`
- `db/migrations/0042_idempotency_key.sql`
- `test/auth/refresh.integration.test.ts`
```

---

## Architecture

```
User prompt
  │
  ▼
Agent (Claude Code / Codex / any MCP client)
  │  calls render_plan(title, markdown)
  ▼
src/server.ts          — MCP stdio server (spawned by assistant, no open ports)
  │
  ├─ src/extract.ts    — parses markdown into PlanDocument (ir.ts types)
  ├─ src/render.ts     — renders PlanDocument → self-contained HTML
  └─ src/archive.ts    — saves HTML to ~/.claude/planui-archive/
       │
       └── opens file:// URL in browser
             │
             ▼
         template/     — self-contained review UI (vanilla JS, no dependencies)
           ├─ template.html  — structural layout, sentinel slots
           ├─ styles.css     — dark/light/midnight themes
           └─ actions.js     — review state machine, approval gating, feedback builder

src/integrations/      — assistant adapter layer (dependency: integrations → core only)
  ├─ shared.ts         — McpEntry type, JSON helpers, IntegrationStatus
  ├─ index.ts          — IntegrationAdapter interface, capability model
  ├─ claude.ts         — Claude Code adapter
  └─ codex.ts          — Codex CLI adapter
```

**Dependency rule:** `src/integrations/` imports from core. Core (`server.ts`, `render.ts`, `extract.ts`) never imports from integrations. This keeps the rendering pipeline assistant-agnostic.

**No daemons. No open ports. No telemetry.** The MCP server is stdio-only, spawned by the assistant when needed.

---

## Network calls

| Call | When | Purpose |
|------|------|---------|
| `cdn.jsdelivr.net/npm/mermaid@10` | Plans with Mermaid blocks | Render diagrams; falls back to raw source offline |
| `registry.npmjs.org/@uzbekswe/planui/latest` | Once per render, 24h cache | Version check banner; never acted on automatically |

---

## Security

`planui setup` does exactly three things:

1. **Writes to `~/.claude.json`** — one `mcpServers.planui` entry with an absolute pinned path:
   ```json
   { "type": "stdio", "command": "/absolute/node", "args": ["/absolute/server.js"] }
   ```
2. **Creates `~/.claude/commands/planui.md`** — the `/planui` slash command.
3. **Renders a welcome plan** — opens one HTML file in your browser.

The path is frozen to the version you installed. It does not silently update to `@latest` on restart.

No shell profile changes. No cron jobs. No background services.

Review the source before running:
- [`src/setup.ts`](https://github.com/Uzbekswe/planui/blob/v0.3.1/src/setup.ts) — what setup writes
- [`src/server.ts`](https://github.com/Uzbekswe/planui/blob/v0.3.1/src/server.ts) — the MCP server (stdio only)
- [`src/render.ts`](https://github.com/Uzbekswe/planui/blob/v0.3.1/src/render.ts) — writes HTML to archive only

Report security issues by email rather than opening a public issue. See [SECURITY.md](./.github/SECURITY.md).

---

## Manual render

Render any plan markdown file without an assistant:

```bash
planui render path/to/plan.md
planui render path/to/plan.md "Custom Title"
```

---

## Upgrading

```bash
# 1. Review what changed
#    https://github.com/Uzbekswe/planui/blob/main/CHANGELOG.md

# 2. Install the new version
npm install -g @uzbekswe/planui@<new-version>

# 3. Update the pinned MCP path + slash command
planui upgrade

# 4. Restart your assistant
```

`planui check-update` shows when a new version is available:
```
Update available: 0.3.1 → 0.4.0
Review: https://github.com/Uzbekswe/planui/compare/v0.3.1...v0.4.0
Run: npm install -g @uzbekswe/planui@0.4.0 && planui upgrade
```

---

## Uninstalling

```bash
planui uninstall
```

Removes the MCP entry and slash command. Plan archive at `~/.claude/planui-archive/` is preserved.

---

## Development

```bash
git clone https://github.com/Uzbekswe/planui.git
cd planui
npm install

npm run build        # compile TypeScript → dist/
npm run typecheck    # type-check without emit
npm test             # run all tests (node:test, no Jest)
npm run dev          # watch mode
```

### Testing

Tests live in `test/`. No external test framework — uses Node's built-in `node:test`.

```bash
npm test
# ✔ version prints a semver string
# ✔ --help exits 0 and mentions core commands
# ✔ unknown command exits non-zero
# ✔ isStepResolved (5 cases)
# ✔ approval gating (7 cases including comment-only blocking)
# ✔ feedback action (5 cases)
# 20 tests, 0 failures
```

The `test/review-semantics.test.js` suite protects the Phase 1 review invariants. See [PHASE1_REVIEW_SYSTEM.md](./PHASE1_REVIEW_SYSTEM.md) for the behavioral contracts.

### Adding a new assistant integration

See [ASSISTANT_INTEGRATIONS.md](./ASSISTANT_INTEGRATIONS.md) — covers the `IntegrationAdapter` interface, capability model, dependency boundary rules, and a step-by-step guide.

---

## Roadmap

- **Phase 3** — plan diffing: `diffStatus` and `version` fields on steps are already in `ir.ts`, ready to be wired up
- Collaborative review (multi-user annotation)
- Plan history browser in the archive UI

---

## Contributing

Contributions welcome. Open an issue first to discuss the change, then submit a PR against `main`.

- Bug reports: [open an issue](https://github.com/Uzbekswe/planui/issues)
- Feature requests: [open an issue](https://github.com/Uzbekswe/planui/issues) with the `enhancement` label
- Security issues: email directly (see [SECURITY.md](./.github/SECURITY.md))

---

## License

**MIT** — see [LICENSE](./LICENSE).

Copyright © 2026 [Mukhammadali](https://github.com/Uzbekswe)
