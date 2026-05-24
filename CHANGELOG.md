# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/Uzbekswe/planui/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Uzbekswe/planui/releases/tag/v0.1.0
