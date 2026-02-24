import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { PolicyGroups, SurgeConfig } from "./surge-api.js";
import { getPolicyGroups } from "./surge-api.js";

const CACHE_PATH = "/Users/tangbo/.openclaw/workspace/.cache/surge-policy-groups.json";

let memoryCache: PolicyGroups | null = null;

async function saveCache(data: PolicyGroups): Promise<void> {
  await mkdir(dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(data), "utf-8");
}

async function loadCacheFromDisk(): Promise<PolicyGroups | null> {
  try {
    const raw = await readFile(CACHE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as PolicyGroups;
    return parsed;
  } catch {
    return null;
  }
}

export async function getPolicyGroupsCached(
  config: SurgeConfig,
  opts?: { forceRefresh?: boolean }
): Promise<PolicyGroups> {
  if (opts?.forceRefresh) {
    const fresh = await getPolicyGroups(config);
    memoryCache = fresh;
    await saveCache(fresh);
    return fresh;
  }

  if (memoryCache) return memoryCache;

  const disk = await loadCacheFromDisk();
  if (disk) {
    memoryCache = disk;
    return disk;
  }

  const fresh = await getPolicyGroups(config);
  memoryCache = fresh;
  await saveCache(fresh);
  return fresh;
}

export async function refreshPolicyGroupsCache(config: SurgeConfig): Promise<PolicyGroups> {
  return getPolicyGroupsCached(config, { forceRefresh: true });
}

export function clearPolicyGroupsMemoryCache(): void {
  memoryCache = null;
}

export const CACHE_FILE_PATH = CACHE_PATH;
