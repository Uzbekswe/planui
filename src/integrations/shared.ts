import { promises as fs } from "node:fs";
import path from "node:path";

export type IntegrationStatus = "registered" | "not-registered" | "not-installed" | "broken";

export interface McpEntry {
  type?: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// In compiled output, __dirname is dist/integrations/.
// Server and template files live one level up in dist/.
export function resolveServerPath(): string {
  return path.join(__dirname, "..", "server.js");
}

export function resolveCommandTemplatePath(): string {
  return path.join(__dirname, "..", "template", "planui.md");
}

export async function readJsonOrNull(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return null;
    if (err instanceof SyntaxError) {
      throw new Error(`${filePath} contains invalid JSON. Fix it manually, then re-run setup.`);
    }
    throw err;
  }
}

export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const tmp = `${filePath}.planui.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
