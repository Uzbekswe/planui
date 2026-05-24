import { promises as fs } from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { TOOL_VERSION } from "./extract.js";

const CACHE_FILE = path.join(os.homedir(), ".claude", "planui-update-cache.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REGISTRY_URL = "https://registry.npmjs.org/@uzbekswe/planui/latest";
const FETCH_TIMEOUT_MS = 3000;

interface CacheEntry {
  checkedAt: string;
  latest: string;
}

async function readCache(): Promise<CacheEntry | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    const entry = JSON.parse(raw) as CacheEntry;
    const age = Date.now() - new Date(entry.checkedAt).getTime();
    return age < CACHE_TTL_MS ? entry : null;
  } catch {
    return null;
  }
}

async function writeCache(latest: string): Promise<void> {
  try {
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    const entry: CacheEntry = { checkedAt: new Date().toISOString(), latest };
    await fs.writeFile(CACHE_FILE, JSON.stringify(entry), "utf8");
  } catch {
    // non-fatal
  }
}

function fetchLatestVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(REGISTRY_URL, { timeout: FETCH_TIMEOUT_MS }, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      res.on("end", () => {
        try {
          const data = JSON.parse(body) as { version?: string };
          if (data.version) resolve(data.version);
          else reject(new Error("No version in registry response"));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("Registry request timed out")); });
    req.on("error", reject);
  });
}

export interface UpdateCheckResult {
  current: string;
  latest: string;
  hasUpdate: boolean;
}

function semverGt(a: string, b: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [aMaj, aMin, aPat] = parse(a);
  const [bMaj, bMin, bPat] = parse(b);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  return aPat > bPat;
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const current = TOOL_VERSION;
  let latest: string;

  const cached = await readCache();
  if (cached) {
    latest = cached.latest;
  } else {
    latest = await fetchLatestVersion();
    await writeCache(latest);
  }

  // Only report an update when the registry version is strictly newer
  return { current, latest, hasUpdate: semverGt(latest, current) };
}

// Non-blocking update banner: logs to stderr if update available, then resolves.
export function asyncUpdateBanner(): void {
  checkForUpdate()
    .then(({ hasUpdate, latest, current }) => {
      if (hasUpdate) {
        process.stderr.write(
          `\n  planui update available: ${current} → ${latest}\n  Review: https://github.com/Uzbekswe/planui/compare/v${current}...v${latest}\n  Run: npm install -g @uzbekswe/planui@${latest} && planui upgrade\n\n`
        );
      }
    })
    .catch(() => {
      // Silently ignore — network unavailable or registry down
    });
}
