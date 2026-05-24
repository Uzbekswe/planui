# @uzbekswe/planui

[![npm version](https://img.shields.io/npm/v/@uzbekswe/planui)](https://www.npmjs.com/package/@uzbekswe/planui)
[![npm downloads](https://img.shields.io/npm/dm/@uzbekswe/planui)](https://www.npmjs.com/package/@uzbekswe/planui)
[![CI](https://github.com/Uzbekswe/planui/actions/workflows/ci.yml/badge.svg)](https://github.com/Uzbekswe/planui/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/npm/l/@uzbekswe/planui)](https://github.com/Uzbekswe/planui/blob/main/LICENSE)
[![Node.js >= 20](https://img.shields.io/node/v/@uzbekswe/planui)](https://nodejs.org)

**PlanUI adds structured review workflows to AI coding agents.**

Before an agent writes a single line of code, it surfaces the implementation plan as an interactive browser UI. You approve steps, answer questions, and strike anything you don't want — then click one button to send structured feedback back to the agent. Works with **Claude Code**, **Codex CLI**, and any MCP-compatible assistant.

![planui demo — dark mode step cards with sidebar TOC](https://raw.githubusercontent.com/Uzbekswe/planui/main/docs/screenshot-dark.png)

---

## Quick start (2 minutes)

### Prerequisites

- **Node.js 20 or higher** — check with `node --version`
- **Claude Code** — the CLI or desktop app ([install guide](https://docs.anthropic.com/en/docs/claude-code)) **or** **Codex CLI** — ([install guide](https://github.com/openai/codex))

### Step 1 — Install

Pick the latest stable version from the [releases page](https://github.com/Uzbekswe/planui/releases) and install it globally:

```bash
npm install -g @uzbekswe/planui@0.3.1
```

> **Why pin the version?** `@latest` executes whatever is newest on the registry without review. Pinning means you control exactly what runs on your machine. You can read the source at that tag before installing.

### Step 2 — Run setup

**For Claude Code:**
```bash
planui setup
```

This does three things and nothing else:
1. Adds a `planui` entry to `~/.claude.json` pointing to the exact server file you just installed
2. Copies the `/planui` slash command to `~/.claude/commands/planui.md`
3. Opens a welcome plan in your browser so you can see it working

**For Codex CLI:**
```bash
planui setup codex
```

Registers planui with `codex mcp add` and validates the registration before reporting success.

### Step 3 — Restart your assistant

Close and reopen Claude Code or Codex (or reload the window). The `planui` MCP server will appear in `/mcp`.

### Step 4 — Use it

**Claude Code:**
```
/planui add idempotency to /v2/refresh
```
or just say: **"use planui to plan this"**

**Codex CLI:**
```
use planui to plan: add idempotency to /v2/refresh
```

The agent explores your codebase, writes a structured plan, and automatically opens it as an interactive HTML page in your browser. Annotate the steps, answer any open questions, then click **Approve plan** or **Copy feedback** to send your response back.

---

## Verifying the install

After setup, run these to confirm everything is wired up:

```bash
planui version        # → 0.3.1
planui check-update   # → up to date (or shows if a new version exists)
planui doctor         # → shows registration status for all assistants
```

`planui doctor` shows whether each integration is registered, not installed, or broken:

```
  name      assistant       status
  ────────  ──────────────  ───────────────
  ✓ claude   Claude Code     registered
  – codex    Codex CLI       not-installed
```

To confirm the MCP server is registered with an absolute path (not `npx @latest`):

```bash
node -e "const c=require('fs').readFileSync(require('os').homedir()+'/.claude.json','utf8'); console.log(JSON.parse(c).mcpServers.planui)"
# → { type: 'stdio', command: '/absolute/path/node', args: ['/absolute/path/server.js'] }
```

---

## What you get

### Interactive step cards

Every step in the plan gets its own card with three action buttons:

| Button | Shortcut | What it does |
|--------|----------|--------------|
| ✓ Approve | `a` | Marks the step green; counts toward the progress bar |
| ~~ Strike | `s` | Marks the step for removal |
| ✎ Comment | `c` | Opens an inline textarea to type feedback |

Keyboard navigation: `j` / `↓` moves to the next step, `k` / `↑` moves to the previous one.

### Open Questions with chip options

If the plan includes an `## Open Questions` section, each question gets an inline answer field. Questions with multiple-choice options render as clickable chips instead of a free-text box. The **Approve plan** button is disabled until every question has an answer.

### Copy Feedback button

Assembles everything — question answers, struck steps, and inline comments — into a structured `planresponse` block. One click copies it to the clipboard. Paste it straight back into Claude.

```
```planresponse plan_abc123
modify

q1: Yes, add a migration for existing rows

feedback:
  Step 3 [remove]: We already handle this in the middleware
  Step 7 [feedback]: Use the v2 API endpoint, not v1
```
```

### Sticky sidebar TOC with scroll-spy

A collapsible table of contents tracks your scroll position and highlights the current step. Click any entry to jump to it.

### Progress bar

A thin accent-coloured bar at the top of the header fills as you approve or strike steps — visual at-a-glance progress.

### Theme switcher

- **Dark** (default) — GitHub-style dark
- **Midnight** — deeper black for OLED displays
- **Light** — clean white
- **System** — follows your OS preference automatically

Toggle with the sun/moon button in the top bar, or choose from the ⚙ settings menu. Preference is saved to `localStorage` per browser.

### Font and accent colour

The ⚙ settings menu also lets you switch between Sans (Inter), Serif, and Mono fonts, and pick an accent colour (Blue, Green, Purple, White).

### Plan archive

Every rendered plan is saved to `~/.claude/planui-archive/YYYY-MM-DDTHH-mm-ss-<slug>.html` as a fully self-contained file. Open any past plan offline — no server needed.

### Export annotated HTML

The **Export annotated** button downloads a snapshot of the current page with all your annotations baked in. Share it with teammates or keep it as a record.

### Version badge

Every rendered plan shows `@uzbekswe/planui@<version>` in the header, linked to the CHANGELOG. You always know which version produced which plan.

### Mermaid diagrams

Plans containing ` ```mermaid ` blocks load the renderer from jsDelivr on demand. Falls back to raw source if you're offline.

---

## Manual render

You can render any plan markdown file without Claude:

```bash
planui render path/to/plan.md
planui render path/to/plan.md "My Plan Title"
```

Useful for rendering saved plans, sharing with teammates, or testing a new plan format.

---

## Upgrading

```bash
# 1. Check what changed
#    https://github.com/Uzbekswe/planui/blob/main/CHANGELOG.md

# 2. Install the new version
npm install -g @uzbekswe/planui@0.4.0

# 3. Update the pinned MCP path and slash command
planui upgrade

# 4. Restart Claude Code
```

`planui check-update` will remind you when a newer version is available:

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

Removes the MCP server entry from `~/.claude.json` and deletes the `/planui` slash command. Your plan archive at `~/.claude/planui-archive/` is left intact.

---

## Plan markdown schema

The tool parses standard H2 headings. All sections are optional — nothing is required.

| H2 heading | Renders as |
|------------|-----------|
| `## Summary` / `## Overview` / `## TL;DR` | Prose card |
| `## Open Questions` / `## Questions` | Answer fields (bullet list = chip options; gates Approve) |
| `## Steps` / `## Plan` / `## Implementation` | Numbered step cards with annotation buttons |
| `## Risks` / `## Risk` | Risk cards with `[high]` / `[med]` / `[low]` severity badges |
| `## Preconditions` / `## Requirements` | Inline code chip list |
| `## Files` / `## Files Touched` | Inline code chip list |
| `## Stack Changes` / `## Dependencies` | Inline code chip list |
| `## Status` | Single line shown as a badge in the header |
| Any other H2 | Note card — nothing is lost |

### Steps with dependencies

```markdown
## Steps
1. **Guard duplicate calls** — add idempotency check at entry. `src/auth/refresh.ts`
2. **Update integration tests** (depends on 1) — replace mock with real fixture.
3. **Deploy and monitor** (depends on 2) — flag-gate; watch 4xx rate for 1h.
```

### Open questions with chip options

```markdown
## Open Questions
1. Should we backfill existing rows?
   - Yes, run a migration now
   - No, new rows only
   - Defer to next sprint
```

### Risks

```markdown
## Risks
- Sessions invalidate during dual-write window [med] — mitigated by 24h overlap.
- Flaky test on CI [low] — pre-existing, unrelated.
```

---

## Network calls

Only two, both opt-in:

| Call | When | Purpose |
|------|------|---------|
| `cdn.jsdelivr.net/npm/mermaid@10` | Plans with Mermaid blocks | Renders diagrams; falls back to raw source offline |
| `registry.npmjs.org/@uzbekswe/planui/latest` | Once per render, cached 24 h | Version check; result displayed as a banner, never acted on automatically |

No telemetry. No daemons. No open ports. The MCP server is stdio-only, spawned by Claude Code when needed and not otherwise running.

---

## Security model

`planui setup` does exactly these things:

1. **Writes to `~/.claude.json`** — one `mcpServers.planui` entry pointing to an absolute file path:
   ```json
   {
     "type": "stdio",
     "command": "/absolute/path/to/node",
     "args": ["/absolute/path/to/@uzbekswe/planui/dist/server.js"]
   }
   ```
   The path is frozen to the version you installed. It does not change to `npx @latest` on restart.

2. **Creates `~/.claude/commands/planui.md`** — the `/planui` slash command.

3. **Renders a welcome plan** — opens one HTML file in your browser.

Nothing else. No shell profile changes, no cron jobs, no background services.

To review the source before running:
- [`src/setup.ts`](https://github.com/Uzbekswe/planui/blob/v0.2.0/src/setup.ts) — what setup writes
- [`src/server.ts`](https://github.com/Uzbekswe/planui/blob/v0.2.0/src/server.ts) — the MCP server (stdio only, no ports)
- [`src/render.ts`](https://github.com/Uzbekswe/planui/blob/v0.2.0/src/render.ts) — writes HTML to `~/.claude/planui-archive/` only

---

## Why this instead of alternatives

| | `@uzbekswe/planui` | `@prathamux/planui` |
|---|---|---|
| Install command | Pinned version — inspect before running | `@latest` — executes whatever is newest |
| MCP registration | Absolute pinned path — frozen until `upgrade` | `npx @latest` — re-fetches every Claude restart |
| Version visibility | Badge on every plan + `planui version` CLI | None |
| Update control | Explicit `planui upgrade` after reviewing the diff | Silent auto-update |
| Plan archive | Timestamped HTML in `~/.claude/planui-archive/` | None |
| Theme support | Dark / Midnight / Light / System | Dark only |
| Feedback UX | "Copy Feedback" → structured `planresponse` block | Basic clipboard |
| Progress tracking | Progress bar + step count in header | None |
| Open questions | Chip options + gated Approve button | Text only |
| Plugin marketplace | `.claude-plugin/plugin.json` entry | None |
| CHANGELOG | From v0.1.0, kept-a-changelog format | None |
| Source history | Full git history, tagged releases | No public repo |

---

## Claude Code plugin marketplace

```
/plugin marketplace add Uzbekswe/planui
```

---

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change, then submit a pull request against `main`.

- Bug reports: [open an issue](https://github.com/Uzbekswe/planui/issues)
- Feature requests: [open an issue](https://github.com/Uzbekswe/planui/issues) with the `enhancement` label
- Security issues: email directly rather than opening a public issue

---

## License

Distributed under the **MIT License** — see [`LICENSE`](./LICENSE) for the full text.

Copyright © 2026 [Mukhammadali](https://github.com/Uzbekswe)
