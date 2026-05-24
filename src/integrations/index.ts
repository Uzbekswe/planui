import { ClaudeAdapter } from "./claude.js";
import { CodexAdapter } from "./codex.js";

export type { IntegrationStatus } from "./shared.js";

export interface IntegrationCapabilities {
  slashCommands: boolean;
  mcpRegistration: boolean;
  promptTemplates: boolean;
}

export interface IntegrationDiagnostic {
  name: string;
  displayName: string;
  status: import("./shared.js").IntegrationStatus;
  detail?: string;
}

export interface IntegrationAdapter {
  name: string;
  displayName: string;
  capabilities: IntegrationCapabilities;
  // sync: only checks PATH / config file presence, no async I/O
  detect(): boolean;
  // async: reads filesystem to determine registration state
  status(): Promise<import("./shared.js").IntegrationStatus>;
  // async: full diagnostic with human-readable detail for broken/unknown states
  diagnose(): Promise<IntegrationDiagnostic>;
  register(serverPath: string): Promise<void>;
  remove(): Promise<void>;
  installSlashCommand(): Promise<"already" | "installed" | "updated" | void>;
  // Returns a full per-assistant invocation guide (onboarding, not just a phrase)
  promptTemplate(): string;
}

export const ALL_INTEGRATIONS: IntegrationAdapter[] = [ClaudeAdapter, CodexAdapter];
export { ClaudeAdapter, CodexAdapter };
