# Assistant Integrations

This document covers the architecture of the integration layer, the adapter interface contract, and how to add support for new AI assistants.

---

## Dependency Boundary

**`integrations → core`. Never `core → integrations`.**

Core rendering and planning logic (`ir.ts`, `extract.ts`, `render.ts`, `server.ts`) must never import from `src/integrations/`. The server's `render_plan` tool is assistant-agnostic by design — it accepts markdown and returns a file path. No integration code touches it.

This boundary is what allows new adapters to be added without touching the rendering pipeline.

---

## Integration Adapter Interface

Every assistant is represented by an `IntegrationAdapter` object defined in `src/integrations/index.ts`:

```typescript
interface IntegrationAdapter {
  name: string;                    // CLI name (e.g. "codex")
  displayName: string;             // Human-readable (e.g. "Codex CLI")
  capabilities: IntegrationCapabilities;
  detect(): boolean;               // sync: checks PATH / config existence
  status(): Promise<IntegrationStatus>;
  diagnose(): Promise<IntegrationDiagnostic>;
  register(serverPath: string): Promise<void>;
  remove(): Promise<void>;
  installSlashCommand(): Promise<void>;
  promptTemplate(): string;        // full invocation guide for this assistant
}
```

### Capabilities

```typescript
interface IntegrationCapabilities {
  slashCommands: boolean;     // can install slash/custom commands
  mcpRegistration: boolean;   // can register as MCP server
  promptTemplates: boolean;   // has a recommended invocation template
}
```

Orchestration code in `setup.ts` uses capabilities to gate behavior:

```typescript
// Good — capability-driven
if (adapter.capabilities.slashCommands) {
  await adapter.installSlashCommand();
}

// Avoid — name-based branching leaks assistant knowledge into orchestration
if (adapter.name === "claude") { ... }
```

### Status values

| Value | Meaning |
|-------|---------|
| `"registered"` | Planui is registered and server path resolves |
| `"not-registered"` | Assistant is installed but planui is not registered |
| `"not-installed"` | Assistant binary / config not found |
| `"broken"` | Registered but paths are stale, config is malformed, or executable is missing |

`planui doctor` exits with code 1 only when at least one integration is `"broken"`. The other statuses are not errors — a user may simply not use Codex.

### Diagnostic separation

`diagnose()` returns a structured `IntegrationDiagnostic` object. `setup.ts` collects diagnostics and renders them in a separate step. This separation means a future `--json` flag on `planui doctor` can reuse the same collection logic without coupling it to console I/O.

```typescript
// Collect
const diagnostics = await Promise.all(ALL_INTEGRATIONS.map(a => a.diagnose()));
// Render (separate concern)
renderDiagnosticTable(diagnostics);
```

---

## Current Adapters

### Claude Code (`src/integrations/claude.ts`)

| | |
|-|-|
| Capabilities | slash commands, MCP registration, prompt templates |
| Config file | `~/.claude.json` under `mcpServers.planui` |
| Registration | tries `claude mcp add`, falls back to direct JSON edit |
| Slash command | copies `dist/template/planui.md` to `~/.claude/commands/planui.md` |
| Broken detection | entry exists but `args[0]` (server path) is missing from disk |

### Codex CLI (`src/integrations/codex.ts`)

| | |
|-|-|
| Capabilities | MCP registration, prompt templates (no slash commands) |
| Config file | `~/.codex/config.json` under `mcpServers.planui` |
| Registration | `codex mcp add planui -- <node> <server>` |
| Post-registration validation | re-reads config; verifies executable and server paths exist |
| Broken detection | command path or server path missing after registration |

---

## Adding a New Integration

1. **Create `src/integrations/<name>.ts`**
   - Implement all `IntegrationAdapter` fields
   - Set `capabilities` accurately — it drives all capability-gated behavior
   - Implement `diagnose()` to return structured `IntegrationDiagnostic`; keep this separate from any console output
   - Add post-`register()` validation that throws with a descriptive message on failure

2. **Import and add to `ALL_INTEGRATIONS` in `src/integrations/index.ts`**
   ```typescript
   import { MyAdapter } from "./myassistant.js";
   export const ALL_INTEGRATIONS: IntegrationAdapter[] = [ClaudeAdapter, CodexAdapter, MyAdapter];
   ```

3. **Do not touch `src/render.ts`, `src/extract.ts`, `src/ir.ts`, or `src/server.ts`** — the dependency boundary must be preserved.

4. **Add `promptTemplate()`** — return a full invocation guide, not a one-liner. This is shown by `planui prompt <name>` and is the primary onboarding path for users of that assistant.

5. **Update `README.md`** — add a setup tab for the new assistant and a row in the quick-start table.

---

## Shared Utilities (`src/integrations/shared.ts`)

- `resolveServerPath()` — returns absolute path to `dist/server.js` (up one level from `dist/integrations/`)
- `resolveCommandTemplatePath()` — returns path to `dist/template/planui.md`
- `readJsonOrNull(filePath)` — reads and parses JSON; returns `null` on ENOENT, throws on malformed JSON
- `writeJsonAtomic(filePath, data)` — writes via `.planui.tmp` then renames
- `pathExists(p)` — `fs.access` wrapped as a boolean
- `IntegrationStatus` type — shared across all adapters
- `McpEntry` interface — the MCP server entry shape
