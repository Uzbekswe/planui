---
description: "Render an implementation plan as an interactive HTML page with step annotations, question answer fields, and structured feedback output"
---

When invoked with `/planui` or when the user says "use planui" / "plan with planui" / "open planui for this", do the following:

1. **Explore** the codebase or context relevant to the task (read-only).
2. **Write a structured plan** in markdown using the section schema below.
3. **Call the `render_plan` MCP tool** with `title` and `markdown` before printing the plan text.
4. After calling the tool, tell the user: "I've opened the plan in your browser. Review each step (approve or strike), answer any open questions, then click **Approve plan** or **Copy feedback** and paste it back here."

## Plan Markdown Section Schema

Use these H2 headers (case-insensitive, all optional):

```
## Summary          — 1-3 sentence overview
## Open Questions   — bullet list; each becomes an inline answer field the user must fill
                      (the Approve button is disabled until every question has an answer)
## Steps            — numbered list; each becomes an annotatable step card
## Risks            — bullets prefixed [high] / [med] / [low]
## Preconditions    — bullet list of prerequisites
## Files            — bullet list of files that will change (grouped by directory)
## Stack Changes    — bullet list of new deps / infra changes
## Status           — single line shown as a header badge (e.g. "Draft")
```

Any other H2 is rendered as a note card — nothing is lost.

## Step Conventions

```markdown
## Steps
1. **Title of step** — description. `src/file.ts`
2. **Another step** (depends on 1) — blocked by step 1; shown with a "blocked by" badge.
3. **Final step** (depends on 2) — references step 2's output.
```

- Use `(depends on N)` to mark dependencies.
- File paths in backticks become chips.
- Keep step titles short (used in the sidebar TOC and progress bar).

## After the User Responds

The browser page copies a fenced `planresponse` block when the user clicks an action button.
When you receive a message containing that block, parse and act on it:

```
```planresponse plan_xxxxxxxx
action: approve
questions:
  q1: yes, use Auth0
  q2: migrate existing sessions
```
```

```
```planresponse plan_xxxxxxxx
action: modify
questions:
  q1: no, use JWT
steps:
  Step 3 [remove]: already handled in middleware
  Step 7 [feedback]: use the v2 API endpoint [high]
  Step 9 [priority:med]
```
```

Action values:
- `approve` — all steps were approved; proceed with implementation using the answers provided
- `modify` — one or more steps were struck; revise the plan then call `render_plan` again
- `revise` — human wants changes but hasn't fully categorised them; re-discuss then re-plan

## Activation Phrases

This command activates when the user says any of:
- `/planui <task>`
- "use planui"
- "open planui for this"
- "plan with planui before coding"
- "render this plan with planui"
