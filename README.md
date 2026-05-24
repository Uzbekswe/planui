# @uzbekswe/planui

Interactive browser-based UI for Claude Code plan mode. When Claude generates a plan, `planui` opens it as a rich HTML page where you can annotate steps, answer open questions, and copy structured feedback back to Claude — all in one click.

**Current stable release: [v0.2.0](https://github.com/Uzbekswe/planui/tree/v0.2.0)**

---

## Install (inspect first, then run)

This tool modifies your `~/.claude.json` and installs a local MCP server. You should read the code before running it. Here's the recommended flow:

**Step 1 — Read the source at the exact version tag:**

```
https://github.com/Uzbekswe/planui/tree/v0.2.0
```

Key files to review:
- [`src/setup.ts`](https://github.com/Uzbekswe/planui/blob/v0.2.0/src/setup.ts) — what `setup` writes to your `~/.claude.json`
- [`src/server.ts`](https://github.com/Uzbekswe/planui/blob/v0.2.0/src/server.ts) — the MCP server (stdio only, no network ports)
- [`src/render.ts`](https://github.com/Uzbekswe/planui/blob/v0.2.0/src/render.ts) — writes HTML files to `~/.claude/planui-archive/` only

**Step 2 — Install the specific version you inspected:**

```bash
npx -y @uzbekswe/planui@0.2.0 setup
```

> **Why pin the version?** Running `@latest` means you execute whatever was most recently published — without reviewing it. Pinning to `@0.1.0` means the code you inspected above is exactly what runs.

**Step 3 — Restart Claude Code**, then use `/planui <task>` in any session.

---

## Upgrading

When a new version is released, the same inspect-first flow applies:

```bash
# 1. Check what's new
#    https://github.com/Uzbekswe/planui/blob/main/CHANGELOG.md

# 2. Read the diff between your installed version and the new one
#    https://github.com/Uzbekswe/planui/compare/v0.2.0...v0.3.0

# 3. Install the new version you've reviewed
npm install -g @uzbekswe/planui@0.3.0

# 4. Update the pinned MCP path and slash command
planui upgrade

# 5. Restart Claude Code
```

`planui check-update` will tell you when a newer version exists:

```bash
planui check-update
# → Update available: 0.2.0 → 0.3.0
#   Review diff: https://github.com/Uzbekswe/planui/compare/v0.2.0...v0.3.0
#   Run: npm install -g @uzbekswe/planui@0.3.0 && planui upgrade
```

---

## What it does

Instead of reading a wall of markdown in the terminal, you get:

- **Annotatable step cards** — approve (✓), strike (~~), or comment on each step
- **Open Questions** — inline answer fields; Approve is gated until all are answered
- **Copy Feedback button** — assembles all annotations into a structured `planresponse` block for pasting back to Claude
- **Export annotated HTML** — download a self-contained snapshot with all annotations baked in
- **Sidebar TOC with scroll-spy** — click any step heading to jump to it; active section highlights as you scroll
- **LocalStorage persistence** — annotation state (approvals, strikes, comments, answers) survives page refreshes per plan ID
- **Plan archive** — every rendered plan saved to `~/.claude/planui-archive/` with an ISO timestamp filename
- **Version badge** — every plan shows which version rendered it, links to this CHANGELOG
- **Themes** — dark / midnight / light, with font and accent colour selector
- **Mermaid diagrams** — loaded from CDN on demand, raw source fallback when offline
- **Keyboard shortcuts** — `j`/`k` navigate steps, `a` approve, `s` strike, `c` comment

---

## What it does NOT do

- Two external network calls only:
  - **Mermaid CDN** — only on plans that contain diagrams; raw source fallback if offline
  - **npm registry** (`registry.npmjs.org/@uzbekswe/planui/latest`) — version check after each render, cached 24 h (at most one call per day)
- No daemons, no open ports — MCP server uses stdio only (spawned by Claude Code, not always running)
- No telemetry
- No auto-updates — the MCP entry in `~/.claude.json` points to a specific absolute path and never changes unless you run `planui upgrade`

---

## Usage

In any Claude Code session:

```
/planui add idempotency to /v2/refresh
```

Claude explores your codebase, writes a structured plan, and calls `render_plan`. A browser tab opens. You review, annotate, and click **Approve plan** or **Copy feedback**. Paste the `planresponse` block back — Claude proceeds or revises.

### Render any plan markdown manually

```bash
planui render path/to/plan.md
planui render path/to/plan.md "My Plan Title"
```

### Uninstall

```bash
planui uninstall
# Your plan archive at ~/.claude/planui-archive/ is preserved
```

---

## Plan markdown schema

Use these H2 headers in the plan (all optional):

| Header | Renders as |
|--------|-----------|
| `## Summary` / `## Overview` / `## TL;DR` | Prose card |
| `## Open Questions` / `## Questions` | Inline answer fields (gates Approve) |
| `## Steps` / `## Plan` / `## Implementation` | Numbered step cards with annotation buttons |
| `## Risks` / `## Risk` | Risk cards with `[high]` / `[med]` / `[low]` severity badges |
| `## Preconditions` / `## Requirements` | Rail card bullet list |
| `## Files` / `## Files Touched` | Rail card bullet list |
| `## Stack Changes` / `## Dependencies` | Rail card bullet list |
| `## Status` | Single line shown as a badge in the header |
| Any other H2 | Note card (nothing is lost) |

### Steps

```markdown
## Steps
1. **Guard duplicate calls** — add idempotency check at entry. `src/auth/refresh.ts`
2. **Update integration tests** (depends on 1) — replace mock with real fixture. `tests/auth.test.ts`
3. **Deploy and monitor** (depends on 2) — flag-gate; watch 4xx rate for 1h.
```

### Risks

```markdown
## Risks
- Sessions invalidate during dual-write window [med] — mitigated by 24h overlap.
- Flaky test on CI [low] — pre-existing, unrelated.
```

---

## Security model

`planui setup` does exactly three things:

1. Adds one entry to `~/.claude.json` under `mcpServers.planui`:
   ```json
   {
     "type": "stdio",
     "command": "/absolute/path/to/node",
     "args": ["/absolute/path/to/dist/server.js"]
   }
   ```
   The path is the exact file on your disk from the version you installed. It never changes to `npx @latest`.

2. Copies `dist/template/planui.md` to `~/.claude/commands/planui.md` (the `/planui` slash command).

3. Renders a welcome plan to `~/.claude/planui-archive/` and opens it in your browser.

Nothing else. No background processes, no cron jobs, no shell profile changes.

---

## Why this instead of alternatives

| | `@uzbekswe/planui` | `@prathamux/planui` |
|---|---|---|
| Install command | Pinned version (`@0.1.0`) — inspect before running | `@latest` — executes whatever is newest |
| MCP registration | Absolute pinned path — frozen until `upgrade` | `npx @latest` — re-fetches every restart |
| Version visibility | Badge on every plan + `planui version` | None |
| Update control | Explicit `planui upgrade` after reviewing the diff | Silent auto-update |
| Plan archive | Timestamped HTML files in `~/.claude/planui-archive/` | None |
| Feedback UX | "Copy Feedback" button → structured markdown | Clipboard response grammar |
| Plugin marketplace | `.claude-plugin/plugin.json` | None |
| CHANGELOG | From v0.1.0 | None |
| Source history | Full git history, tagged releases | No public repo |

---

## Claude Code plugin marketplace

```
/plugin marketplace add Uzbekswe/planui
```

---

## License

MIT — [Mukhammadali](https://github.com/Uzbekswe)
