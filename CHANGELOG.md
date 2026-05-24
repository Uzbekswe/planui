# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-05-24

### Added
- **Dual approval gate** — "Approve plan" button now requires all steps to be approved or struck, not just questions answered; tooltip explains exactly what's blocking
- **Questions-first ordering** — questions section always renders above steps regardless of plan markdown order
- **Section type badges** — coloured "Questions / Steps / Risks / Files / Dependencies" labels on each section heading; left-border accent lines distinguish section types visually
- **Questions indicator banner** — sticky yellow banner below the header shows answered/total progress; turns green when all questions answered; links to the questions section
- **File grouping** — `## Files` section groups paths by top-level directory using `<details>/<summary>` (open by default); count badge on each group
- **Bulk actions toolbar** — "Approve all / Strike all / Clear all" buttons above the step list; "Resolve remaining" in the action bar bulk-approves all pending steps
- **Priority picker** — H / M / L buttons on each step card; persisted in localStorage; included in Copy Feedback output
- **Segmented controls** — gear menu replaces `<select>` dropdowns with pill-button controls for theme, font, and accent colour (colour shown as swatches)
- **Focus mode** — "Focus" button in action bar hides resolved step bodies; approved steps dim, struck steps fade further; button activates with accent colour
- **3-way progress bar** — status line shows "N approved · M struck · P pending" instead of "N / total approved"
- **Pending step visual** — unreviewed step numbers show dashed yellow border to signal they need attention
- **Sidebar Q-badge** — Questions TOC entry shows unanswered count; count updates live as questions are answered
- **Structured feedback format** — "Copy Feedback" now outputs `action: approve/modify/revise`, `questions:` block, and `steps:` block with `[remove]`, `[feedback]`, and `[priority:X]` annotations
- **`diffStatus?` field on PlanStep** — groundwork for future plan diff/versioning feature
- **`version?` field on PlanDocument** — groundwork for future diff chaining

## [0.2.0] - 2026-05-24

### Fixed
- `@latest` references replaced with specific version numbers in all CLI output (`planui check-update`, `planui --help`, update banner) — consistent with the inspect-before-install security model documented in the README
- `plugin.json` `installInstructions` now directs users to review the release tag before installing, instead of using `@latest`
- `## Files`, `## Stack Changes`, and `## Preconditions` rail items now render inline markdown — backtick-wrapped paths (e.g. `` `src/server.ts` ``) appear as `<code>` chips instead of literal text with backticks
- README "What it does NOT do" now accurately documents both external network calls (Mermaid CDN and npm registry version check, cached 24 h)

### Added
- README "What it does" now lists Export annotated HTML, Sidebar TOC with scroll-spy, and LocalStorage annotation persistence (these features shipped in v0.1.0 but were not documented in the README)
- `planui check-update` and update banner now include a diff URL (`github.com/compare/vOLD...vNEW`) alongside the install command

## [0.1.0] - 2026-05-24

### Added
- `render_plan` MCP tool: renders AI-generated plans as self-contained interactive HTML pages
- Per-step Approve / Strike / Comment annotation buttons with LocalStorage persistence
- "Copy Feedback" button assembles all annotations into structured markdown for pasting back to Claude
- "Export annotated HTML" downloads the plan with annotation state embedded
- Plan archive: every rendered plan saved to `~/.claude/planui-archive/` with ISO timestamp filename
- Version badge on every rendered plan linking to this CHANGELOG
- Keyboard shortcuts: `j`/`k` navigate steps, `a` approve, `s` strike, `c` comment
- Sticky sidebar table of contents with scroll-to-step links
- Mermaid diagram support (loaded from CDN on demand; raw source fallback when offline)
- Dark / Midnight / Light themes with font and accent colour selector
- `planui setup`: installs MCP server with pinned absolute path (no silent auto-updates)
- `planui upgrade`: explicit user-initiated version update
- `planui uninstall`: removes MCP entry and slash command (plan archive preserved)
- `planui render <file>`: render any plan markdown file without Claude Code
- `planui version`: print installed version
- `planui check-update`: compare installed version against npm registry (24h cache)
- `/planui` slash command for Claude Code
- `.claude-plugin/plugin.json` for Claude Code plugin marketplace discovery
- GitHub Actions workflow: auto-publish to npm on `v*.*.*` tag push
- MIT License

[Unreleased]: https://github.com/Uzbekswe/planui/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/Uzbekswe/planui/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Uzbekswe/planui/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Uzbekswe/planui/releases/tag/v0.1.0
