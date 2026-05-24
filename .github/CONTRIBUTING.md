# Contributing to @uzbekswe/planui

Thank you for your interest in contributing!

## Before opening a PR

Please open an issue first for significant changes. Small fixes (typos, docs) can go straight to a PR.

## Development setup

```bash
git clone https://github.com/Uzbekswe/planui
cd planui
npm install
npm run build
npm test
```

## Commit format

Use [Conventional Commits](https://www.conventionalcommits.org/) — this drives automated versioning and changelog generation via release-please:

| Prefix | Meaning | Version bump |
|--------|---------|--------------|
| `feat:` | New feature | Minor (0.2.0 → 0.3.0) |
| `fix:` | Bug fix | Patch (0.2.0 → 0.2.1) |
| `docs:` | Docs only | — |
| `chore:` | Build / tooling | — |
| `feat!:` / `fix!:` | Breaking change | Major (0.2.0 → 1.0.0) |

Examples:

```
feat: add dark mode toggle to plan renderer
fix: handle empty plan content without crashing
docs: clarify install flow in README
chore: update dependencies
```

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run typecheck` | Type-check without emitting |
| `npm test` | Run smoke tests |
| `npm run dev` | Watch mode |

## Submitting

- One PR per feature or fix
- Reference the related issue: `Fixes #123`
- Ensure CI passes before requesting review
- Update `CHANGELOG.md` under `[Unreleased]` if your change is user-facing
