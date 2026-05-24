# Phase 1 Review System — Architecture Notes

This document records the behavioral contracts and semantic rules that govern the Phase 1 review UI. Future contributors must understand these before modifying `src/template/actions.js` or `src/render.ts`.

---

## Review State Machine

Each step card has exactly one of four states:

| State | Meaning | Resolved? |
|-------|---------|-----------|
| `""` (empty) | Not yet reviewed | **No** |
| `"commenting"` | Comment textarea is open | **No** |
| `"approved"` | Human explicitly approved | **Yes** |
| `"struck"` | Human struck (mark for removal) | **Yes** |

The `comments` map (`state.comments[stepId]`) is a **separate field** from the step state. A step can have comment text while its state is `""`, `"commenting"`, `"approved"`, or `"struck"`.

### Critical rule

> **A step with only comment text and no `"approved"` or `"struck"` state is NOT resolved.**

Comments are advisory feedback to Claude. They do not constitute a human review decision. This rule is intentional and must not be weakened.

---

## Canonical Resolution Predicate

All code that checks whether a step is resolved **must** go through `isStepResolved()`:

```js
// In src/template/actions.js
function isStepResolved(id) {
  const s = state.steps[id] || "";
  return s === "approved" || s === "struck";
}
```

Do not inline `s === "approved" || s === "struck"` elsewhere. Use this function.

---

## Dual Approval Gate

`updateApproveGating()` disables "Approve plan" until both conditions are met:

1. **All questions answered** — every `.question-card` has a non-empty answer
2. **All steps resolved** — every `.step-card` satisfies `isStepResolved()`

Both gates must pass simultaneously. There is no bypass.

This guarantees that an agent reading an "approved" response knows a human has:
- Answered every question explicitly raised
- Reviewed every implementation step (approve or strike)

---

## Feedback Format

`buildFeedback()` serialises the review state into a structured block:

```
```planresponse <planId>
action: approve | modify | revise

questions:
  q1: <answer>
  q2: <answer>

steps:
  Step 3 [remove]: optional comment
  Step 7 [feedback]: use the v2 API [high]
  Step 9 [priority:med]
` `` `
```

**Action values:**
- `approve` — all steps are `"approved"` (no struck, no revisions needed)
- `modify` — at least one step is `"struck"` (structural change requested)
- `revise` — steps remain in `"commenting"` or `""` state (human wants changes but hasn't categorised them)

**Steps section** only includes steps that have a `"struck"` state, a comment, or a priority set. Cleanly approved steps with no annotations are not listed.

---

## Persistence

State is persisted to `localStorage` under the key `planui-state-<planId>`.

Schema version is stored as `_v` in the serialised object:
- `_v` absent → v0 state (Phase 1 initial release) — treated as compatible
- `_v === 1` → current schema
- `_v > 1` → future incompatible schema → fresh state (annotations not carried over)

Bump `STATE_SCHEMA_VERSION` in `actions.js` if the shape of `state` changes in a breaking way.

---

## Keyboard Shortcuts

All key bindings are declared in the `KEYMAP` object at module scope in `actions.js`. To add or rebind a shortcut, edit `KEYMAP` — do not add `e.key === ...` checks inline.

```js
const KEYMAP = {
  navigate_down: ["j", "ArrowDown"],
  navigate_up:   ["k", "ArrowUp"],
  approve:       ["a"],
  strike:        ["s"],
  comment:       ["c"],
};
```

---

## Section Rendering Pipeline

```
PlanDocument (ir.ts types)
  └─ renderSection() per section, ordered by SECTION_ORDER
       ├─ case "files"  → renderGroupedItems() → <details> groups
       ├─ case "stack"  → renderGroupedItems() if paths present, else rail-list
       ├─ case "steps"  → bulk toolbar + priority picker per step
       └─ case "questions" → chip inputs or textarea
```

Questions always render above steps regardless of markdown order (`SECTION_ORDER` sorts at render time in `renderToHtml()`).

---

## What Phase 2 Should Not Touch

- The `isStepResolved` predicate and its semantics
- The dual-gate invariant in `updateApproveGating`
- The `STATE_SCHEMA_VERSION` bump protocol
- The `buildFeedback` output format (Claude parses this)
