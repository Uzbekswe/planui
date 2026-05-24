# @uzbekswe/planui

Interactive browser-based UI for Claude Code plan mode. When Claude generates a plan, `planui` opens it as a rich HTML page where you can annotate steps, answer open questions, and copy structured feedback back to Claude — all in one click.

```bash
npx -y @uzbekswe/planui@latest setup
```

Then restart Claude Code and use `/planui <task>` in any session.

---

## What it does

Instead of reading a wall of markdown in the terminal, you get:

- **Annotatable step cards** — approve (✓), strike (~~), or comment on each step
- **Open Questions** — inline answer fields; Approve is gated until all are answered
- **Copy Feedback button** — assembles all annotations into a structured `planresponse` block for pasting back to Claude
- **Plan archive** — every rendered plan saved to `~/.claude/planui-archive/` with an ISO timestamp filename
- **Version badge** — every plan shows which version rendered it, links to this CHANGELOG
- **Themes** — dark / midnight / light, with font and accent colour selector
- **Mermaid diagrams** — loaded from CDN on demand, raw source fallback when offline
- **Keyboard shortcuts** — `j`/`k` navigate steps, `a` approve, `s` strike, `c` comment

---

## Install

```bash
# Install globally
npm install -g @uzbekswe/planui@latest

# Register the MCP server and /planui slash command
planui setup

# Restart Claude Code, then use /planui in any session
```

Or skip the global install and run directly:

```bash
npx -y @uzbekswe/planui@latest setup
```

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

### Check for updates

```bash
planui check-update
```

### Upgrade after installing a new version

```bash
npm install -g @uzbekswe/planui@latest
planui upgrade
# Restart Claude Code
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

## Why this instead of alternatives

| | `@uzbekswe/planui` | `@prathamux/planui` |
|---|---|---|
| MCP registration | Absolute pinned path — frozen until `upgrade` | `npx @latest` — re-fetches every restart |
| Version visibility | Badge on every plan + `planui version` | None |
| Update control | Explicit `planui upgrade` | Silent auto-update |
| Plan archive | Timestamped HTML files in `~/.claude/planui-archive/` | None |
| Feedback UX | "Copy Feedback" button → structured markdown | Clipboard response grammar |
| Plugin marketplace | `.claude-plugin/plugin.json` | None |
| CHANGELOG | From v0.1.0 | None |
| Source | [github.com/Uzbekswe/planui](https://github.com/Uzbekswe/planui) | No public repo history |

---

## Claude Code plugin marketplace

```
/plugin marketplace add Uzbekswe/planui
```

---

## License

MIT — [Mukhammadali](https://github.com/Uzbekswe)
