---
description: "Render an implementation plan as an interactive HTML page with annotations and copy feedback"
---

When the user asks you to plan something with `/planui`, do the following:

1. **Explore** the codebase or context relevant to the task (read-only).
2. **Write a structured plan** in markdown using the section schema below.
3. **Call the `render_plan` MCP tool** with `title` and `markdown` before printing the plan text.
4. After calling the tool, tell the user: "I've opened the plan in your browser. Review the steps, answer any open questions, then click **Approve plan** or **Copy feedback** and paste it back here."

## Plan Markdown Section Schema

Use these H2 headers (case-insensitive, all optional):

```
## Summary          — 1-3 sentence overview
## Open Questions   — bullet list; each becomes an inline answer field the user must fill
## Steps            — numbered list; each becomes an annotatable step card
## Risks            — bullets prefixed [high] / [med] / [low]
## Preconditions    — bullet list of prerequisites
## Files            — bullet list of files that will change
## Stack Changes    — bullet list of new deps / infra changes
## Status           — single line shown as a badge (e.g. "Draft")
```

Any other H2 is rendered as a note card (nothing is lost).

## Step Conventions

```markdown
## Steps
1. **Title of step** — description. `src/file.ts`
2. **Another step** (depends on 1) — blocked by step 1; shown with a "blocked by" badge.
3. **Final step** — references step 2's output.
```

- Use `(depends on N)` to mark dependencies.
- File paths in backticks become chips.

## After the User Responds

The browser page copies a fenced `planresponse` block when the user clicks an action button.
When you receive a message containing that block, parse and act on it:

```
```planresponse plan_xxxxxxxx
approve
q1: yes, use Auth0
q2: migrate existing sessions
```
```

Actions:
- `approve` — proceed with implementation using the answers provided
- `modify` — revise the plan based on `feedback:` lines, then call `render_plan` again
