import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const ARCHIVE_DIR = path.join(os.homedir(), ".claude", "planui-archive");

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoToFileSafe(iso: string): string {
  // "2026-05-24T13:45:00.000Z" → "2026-05-24T13-45-00"
  return iso.slice(0, 19).replace(/:/g, "-");
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function savePlan(
  html: string,
  title: string,
  renderedAt: string
): Promise<string> {
  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
  const ts = isoToFileSafe(renderedAt);
  const slug = slugify(title);
  const filename = `${ts}-${slug}.html`;
  const filepath = path.join(ARCHIVE_DIR, filename);
  // Atomic write
  const tmp = `${filepath}.tmp`;
  await fs.writeFile(tmp, html, "utf8");
  await fs.rename(tmp, filepath);
  return filepath;
}

export function archiveDir(): string {
  return ARCHIVE_DIR;
}
