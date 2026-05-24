## Summary

Welcome to **planui** — your personal plan-mode UI for Claude Code. This is what a rendered plan looks like. Try the buttons below to see how annotation works.

## Open Questions

- What kind of projects will you mostly use planui for?
- Do you prefer the dark or midnight theme? (check the ⚙ gear icon)

## Steps

1. **Run `planui setup`** — installs the MCP server and `/planui` slash command into Claude Code.
2. **Restart Claude Code** — needed to pick up the new MCP server.
3. **Try `/planui <task>`** in any Claude Code session — Claude will call `render_plan` and open a page like this.
4. **Annotate and approve** — use the buttons on each step, fill in open questions, then click Approve or Copy feedback.
5. **Paste the `planresponse` block back** — Claude reads it and proceeds or revises the plan.

## Risks

- Forgetting to restart Claude Code after setup [low] — the MCP won't appear until restarted.

## Files

- `~/.claude.json` — MCP server entry added (absolute pinned path, not npx)
- `~/.claude/commands/planui.md` — /planui slash command
- `~/.claude/planui-archive/` — every rendered plan is saved here

## Status

Welcome
